import type { Cost } from "../model/ability";
import type { Bot, BotMemory, BotSetup, PlayerKnowledge } from "../model/bot";
import type { GameStateView } from "../model/game-state-view";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type {
    DeckListEntry,
    PlayerActionDescription,
    PlayerAnswer,
    PlayerCard,
    PlayerDecisionAnswer,
    PlayerRequest,
    PlayerUpdate,
} from "../model/player-interaction";
import type { Strategy } from "../model/strategy";
import { SeededRandom } from "../player/random";
import { analyzeDeck, mechanics, printedNames } from "./analysis";
import { fitChoice } from "./choice";
import { stance } from "./intent";
import { boardValue, defaultTuning, evaluate, keepValue, matchesPrinted, type Tuning } from "./evaluate";
import { augment, rewind, TurnHistory, type TurnRecord } from "./history";
import type { CardFacts, Hypothesis, Insight, SimulationSearch } from "./insight";
import { Knowledge } from "./knowledge";
import { revise } from "./revise";
import { sampleFill } from "./sampling";

/** Supplied by trusted search infrastructure. Bot policy never builds positions itself. */
export type InsightFactory = (view: GameStateView, viewer: PlayerNumber, hypothesis?: Hypothesis) => Insight;

type ActionOption = Extract<PlayerRequest, { type: "Action" }>["actions"][number];

/** A follow-up answer chosen while simulating the current action, matched by request shape. */
interface Planned {
    signature: string;
    answer: PlayerAnswer;
}

/**
 * Plays each promising action in the same sampled worlds, finishes the turn and
 * the next player's reply with a cheap policy, and scores the positions reached
 * with its current Strategy. Follow-up decisions reuse the simulated line when
 * the live request matches it.
 */
export class HeuristicBot implements Bot {
    private readonly knowledge: Knowledge;
    private readonly base: Strategy;
    private strategy: Strategy;
    private readonly difficulty: SeededRandom;
    private readonly sampling: SeededRandom;
    private readonly history = new TurnHistory();
    private readonly player: PlayerNumber;
    private plan: Planned[] = [];
    private revised?: number;
    private opponents = new Map<PlayerNumber, Strategy>();
    /** Simulated worlds per decision and how many resumed the turn with its history. */
    readonly stats = { worlds: 0, replayed: 0, decisions: 0 };
    /** For traces and reports: each searched turn action's candidates with their scores. */
    /** Evaluation weights for paired comparisons. Not part of BotSetup or Strategy. */
    tuning: Tuning = defaultTuning;
    explain?: (candidates: readonly { action: PlayerActionDescription; score: number; chosen: boolean; outcome?: Insight }[]) => void;

    constructor(
        private readonly setup: BotSetup,
        private readonly insight: InsightFactory,
    ) {
        const randomness = setup.settings.randomness ?? 0;
        if (!(randomness >= 0 && randomness <= 1)) throw new Error("randomness must be between 0 and 1");
        const { nodes, samples } = setup.settings.search;
        if (!(nodes >= 0 && samples >= 0 && Number.isInteger(nodes) && Number.isInteger(samples)))
            throw new Error("Search limits must be nonnegative integers");
        this.player = setup.player;
        this.knowledge = new Knowledge(setup.player, setup.deck, setup.opponents);
        this.base = setup.strategy ?? analyzeDeck(setup.deck, setup.opponents);
        this.strategy = this.base;
        // Separate streams: changing difficulty never changes sampled worlds.
        this.difficulty = new SeededRandom(setup.settings.seed ^ 0x5bd1e995);
        this.sampling = new SeededRandom(setup.settings.seed ^ 0x2545f491);
    }

    get memory(): BotMemory {
        return { players: this.knowledge.all(), strategy: this.strategy };
    }

    observe(update: PlayerUpdate): void {
        this.knowledge.update(update);
        this.history.record(update, this.knowledge.all());
    }

    decide(state: GameStateView, request: PlayerRequest): PlayerAnswer {
        if (request.type === "Action" && this.revised !== state.turn.number) this.revise(state);
        const custom = this.strategy.choose?.(state, request);
        if (custom) return custom;
        if (request.type === "Action") {
            this.plan = [];
            return this.act(state, request);
        }
        const insight = this.insight(state, this.player, { current: { view: augment(state, this.knowledge.all()) ?? state } });
        const planned = this.plan[0];
        const ranked = this.candidates(insight, request, this.player);
        if (planned && planned.signature === signature(request)) {
            this.plan.shift();
            // Hidden handles are request-local, so a simulated answer is matched by shape.
            const shape = handleless(planned.answer);
            const live = ranked.find((answer) => handleless(answer) === shape);
            if (live) return live;
            if (offered(planned.answer, request)) return planned.answer;
        }
        this.plan = [];
        return this.pick(ranked.map((answer, index) => ({ answer, score: -index })));
    }

    /** Once per turn: revise own priorities and re-derive opposing plans from what has been seen. */
    private revise(state: GameStateView): void {
        this.revised = state.turn.number;
        const memory = this.knowledge.all();
        const insight = this.insight(state, this.player);
        this.strategy = revise(this.base, insight, this.player, memory);
        this.opponents = new Map();
        for (const other of insight.players()) if (other !== this.player) this.opponents.set(other, analyzeDeck(opposingList(memory[other])));
    }

    private strategyFor(player: PlayerNumber): Strategy {
        return player === this.player ? this.strategy : (this.opponents.get(player) ?? this.strategy);
    }

    /** The same sampled worlds are used for every candidate in this decision. */
    private worlds(state: GameStateView): Insight[] {
        const memory = this.knowledge.all();
        const current = augment(state, memory) ?? state;
        const record = this.history.turn;
        const start = record && state.turn.player === this.player ? rewind(record) : undefined;
        const samples = this.setup.settings.search.samples;
        return Array.from({ length: Math.max(1, samples) }, () =>
            this.insight(state, this.player, {
                current: { view: current, ...(samples ? { fill: sampleFill(current, memory, this.sampling) } : {}) },
                ...(start && record
                    ? {
                          turn: {
                              start: { view: start, ...(samples ? { fill: sampleFill(start, memory, this.sampling) } : {}) },
                              steps: record.steps,
                              actions: intentions(record),
                          },
                      }
                    : {}),
            }),
        );
    }

    private act(state: GameStateView, request: Extract<PlayerRequest, { type: "Action" }>): PlayerAnswer {
        const alter = request.actions.filter((entry) => entry.action.type === "Alter Hand");
        if (alter.length) return { type: "Action", option: this.mulligan(this.insight(state, this.player), alter) };
        // A single legal action needs no search.
        if (request.actions.length === 1) return { type: "Action", option: request.actions[0].option };
        const nodes = this.setup.settings.search.nodes;
        const strategy = this.strategy;
        if (nodes <= 0) {
            const insight = this.insight(state, this.player, { current: { view: augment(state, this.knowledge.all()) ?? state } });
            const base = evaluate(insight, this.player, strategy, undefined, undefined, this.tuning);
            const scored = request.actions.map((option) => ({
                answer: { type: "Action", option: option.option } as PlayerAnswer,
                option,
                score: option.action.type === "End Turn" ? base : base + this.estimate(insight, option, this.player, strategy, request.actions),
            }));
            return this.choose(scored);
        }
        const worlds = this.worlds(state);
        const main = worlds[0];
        const end = request.actions.find((entry) => entry.action.type === "End Turn");
        const roots = this.roots(main, request.actions);
        const options = end ? [...roots, end] : roots;
        const search: SimulationSearch = {
            candidates: (here, inner, player) => this.candidates(here, inner, player),
            evaluate: (here, timing, winners) => evaluate(here, this.player, strategy, timing, winners, this.tuning),
            nodes: Math.max(1, Math.floor(nodes / (options.length * worlds.length))),
            width: 3,
            reply: true,
        };
        const scored: { answer: PlayerAnswer; score: number; option: ActionOption; line?: Planned[]; outcome?: Insight }[] = [];
        for (const option of options) {
            const results = worlds.map((world) => world.simulate(option.action, option.cost, search));
            const found = results.filter((result) => result !== undefined);
            if (!found.length) continue;
            const scores = found.map((result) => result.score);
            const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
            // Caution weighs the worst sampled world against the average.
            const score = (1 - strategy.caution) * mean + strategy.caution * Math.min(...scores);
            scored.push({
                answer: { type: "Action", option: option.option },
                score,
                option,
                line: found[0].line.map((entry) => ({ signature: signature(entry.request), answer: entry.answer })),
                outcome: found[0].insight,
            });
        }
        this.stats.decisions++;
        this.stats.worlds += worlds.length;
        this.stats.replayed += worlds.filter((world) => world.replayed).length;
        if (!scored.length) return { type: "Action", option: (end ?? request.actions[0]).option };
        const choice = this.choose(scored);
        const chosen = scored.find((entry) => entry.answer === choice);
        this.explain?.(scored.map((entry) => ({ action: entry.option.action, score: entry.score, chosen: entry === chosen, outcome: entry.outcome })));
        this.plan = chosen?.line ? [...chosen.line] : [];
        return choice;
    }

    /** Prefers ending the turn unless an action clearly improves on it. */
    private choose(scored: readonly { answer: PlayerAnswer; score: number; option: ActionOption }[]): PlayerAnswer {
        const end = scored.find((entry) => entry.option.action.type === "End Turn");
        const useful = end ? scored.filter((entry) => entry === end || entry.score > end.score + 1) : scored;
        return this.pick(useful.length ? useful : scored);
    }

    /** The most promising actions by static estimate, keeping the best of every action type. */
    private roots(insight: Insight, actions: readonly ActionOption[]): ActionOption[] {
        const ranked = actions
            .filter((entry) => entry.action.type !== "End Turn")
            .map((option) => ({ option, score: this.estimate(insight, option, this.player, this.strategy, actions) }))
            .sort((a, b) => b.score - a.score);
        const chosen = ranked.slice(0, this.tuning.roots);
        // Also try the best of each kind of action the estimate ranked low.
        for (const entry of ranked) if (!chosen.some((other) => other.option.action.type === entry.option.action.type)) chosen.push(entry);
        return chosen.map((entry) => entry.option);
    }

    /** Cheap static estimate used without search, for root selection and for rollouts. */
    private estimate(insight: Insight, option: ActionOption, player: PlayerNumber, strategy: Strategy, actions: readonly ActionOption[]): number {
        const action = option.action;
        const facts = "card" in action && action.card ? insight.facts(action.card) : undefined;
        const inkwell = insight.inkwell(player);
        switch (action.type) {
            case "Ink": {
                if (!facts) return 0;
                if (inkwell >= strategy.resources.targetInk) return -40;
                const keep = keepValue(facts.definition, inkwell, strategy);
                // Ink comes first, so this turn can spend it, unless the card is itself a play available now.
                const playable = actions.some((other) => other.action.type === "Play" && "card" in other.action && sameCard(other.action.card, action.card));
                return 300 - keep - (playable ? 150 : 0);
            }
            case "Play":
            case "Shift": {
                if (!facts) return 0;
                let value = boardValue(facts, strategy) - keepValue(facts.definition, inkwell, strategy) + 20 - price(option.cost, facts, strategy);
                // The base stops counting as a separate body once it is underneath.
                if (action.type === "Shift")
                    for (const base of action.onto) {
                        const under = insight.facts(base);
                        if (under) value -= boardValue(under, strategy);
                    }
                return value;
            }
            case "Quest": {
                if (!facts) return 0;
                const threats = insight
                    .players()
                    .filter((other) => other !== player)
                    .flatMap((other) => insight.board(other));
                const danger = threats.some(
                    (attacker) =>
                        insight.challenge(attacker.card, facts.card).toDefender >= facts.willpower - facts.damage &&
                        insight.threatens(attacker.card, facts.card),
                );
                return facts.lore * 100 - (danger ? boardValue(facts, strategy) * 0.7 * (0.6 + strategy.caution * 0.4) : 0);
            }
            case "Challenge": {
                const attacker = insight.facts(action.attacker),
                    defender = insight.facts(action.defender);
                if (!attacker || !defender) return 0;
                const { toDefender, toAttacker } = insight.challenge(action.attacker, action.defender);
                const kills = toDefender >= defender.willpower - defender.damage ? boardValue(defender, strategy) : toDefender * 10;
                const dies = toAttacker >= attacker.willpower - attacker.damage ? boardValue(attacker, strategy) : toAttacker * 5;
                return kills - dies;
            }
            case "Sing":
                return 50;
            case "Activate":
                return 30 - price(option.cost, facts, strategy);
            default:
                return -5;
        }
    }

    /** Puts back cards that do not develop early, keeping enough inkable cards. */
    private mulligan(insight: Insight, options: readonly ActionOption[]): number {
        const hand = (insight.view.players[this.player]?.hand ?? []) as readonly (CardIdentifier | null)[];
        const cards = hand.flatMap((card) => {
            const facts = card ? insight.facts(card) : undefined;
            return facts ? [facts] : [];
        });
        const inkable = cards.filter((facts) => facts.inkable).length;
        // Cheap answers are not a curve. In particular, damage scaled by our
        // characters and songs need bodies before they can do useful work.
        const develops = (facts: CardFacts): boolean => {
            const card = facts.definition;
            return card.cost <= 3 && (card.type !== "Action" || (card.cost <= 2 && (mechanics(card).draw || mechanics(card).ramp)));
        };
        const early = cards.filter(develops).length;
        const back = new Set<string>();
        const sorted = [...cards].sort((a, b) => b.definition.cost - a.definition.cost);
        let keptInkable = inkable;
        for (const facts of sorted) {
            const expensive = facts.definition.cost >= 5;
            const preserved = this.strategy.resources.preserve.some((entry) => entry.importance >= 0.7 && matchesPrinted(facts.definition, entry.cards));
            if (preserved && develops(facts)) continue;
            if (expensive && (early < 3 || cards.filter((other) => other.definition.cost >= 5).length > 1)) {
                if (facts.inkable && keptInkable <= 3) continue;
                back.add(`${facts.card.fullName}#${facts.card.i}`);
                if (facts.inkable) keptInkable--;
            }
        }
        // With too little development, redraw surplus reactive spells as well.
        // Keep one answer and two inkable cards, not a fistful of uncastable songs.
        if (early < 2) {
            const answers = cards
                .filter((facts) => facts.definition.type === "Action" && !develops(facts) && !back.has(`${facts.card.fullName}#${facts.card.i}`))
                .sort((a, b) => a.definition.cost - b.definition.cost);
            for (const facts of answers.slice(1)) {
                if (facts.inkable && keptInkable <= 2) continue;
                back.add(`${facts.card.fullName}#${facts.card.i}`);
                if (facts.inkable) keptInkable--;
            }
        }
        const target = [...back].sort().join("|");
        const match = options.find((entry) => {
            const action = entry.action;
            return (
                action.type === "Alter Hand" &&
                action.cards
                    .map((card) => `${card.fullName}#${card.i}`)
                    .sort()
                    .join("|") === target
            );
        });
        return (match ?? options.find((entry) => entry.action.type === "Alter Hand" && entry.action.cards.length === 0) ?? options[0]).option;
    }

    /**
     * Ranked answers for any player's request. Search compares several of them
     * by their outcomes. Rollouts and decisions without search play the first.
     */
    candidates(insight: Insight, request: PlayerRequest, player: PlayerNumber): PlayerAnswer[] {
        const decision = (answer: PlayerDecisionAnswer): PlayerAnswer => ({ type: "Decision", answer });
        const strategy = this.strategyFor(player);
        const worth = (card: PlayerCard): number => {
            if (!isIdentifier(card)) return 0;
            const facts = insight.facts(card);
            if (!facts) return 0;
            if (facts.zone === "Play") return (facts.controller === player ? 1 : 1.2) * boardValue(facts, strategy);
            return keepValue(facts.definition, insight.inkwell(player), strategy);
        };
        const ownHandOrDeck = (card: PlayerCard): boolean => {
            if (!isIdentifier(card)) return true;
            const facts = insight.facts(card);
            return !!facts && facts.controller === player && facts.zone !== "Play";
        };
        switch (request.type) {
            case "Action": {
                // When the offered quests reach victory, questing comes before anything else.
                const finish = finishing(insight, request.actions, player);
                // End Turn scores zero, so only actions estimated as improvements come first.
                const scored = request.actions.map((entry) => ({
                    answer: { type: "Action", option: entry.option } as PlayerAnswer,
                    score:
                        entry.action.type === "End Turn"
                            ? 0
                            : entry.action.type === "Alter Hand"
                              ? entry.action.cards.length
                                  ? -1
                                  : 1
                              : finish && entry.action.type === "Quest"
                                ? 1_000_000
                                : this.estimate(insight, entry, player, strategy, request.actions),
                }));
                return scored.sort((a, b) => b.score - a.score).map((entry) => entry.answer);
            }
            case "Choose Cards": {
                // Helpful effects go to our best cards, harmful ones to theirs. Without a stated
                // effect, discards and costs from hand lose the least valuable cards.
                const first = request.cards.find(isIdentifier);
                const helps = stance(request.effect, first && insight.facts(first)?.zone);
                const losing = !helps && request.cards.every(ownHandOrDeck);
                const aim = (card: PlayerCard): number => {
                    if (!helps || !isIdentifier(card)) return worth(card);
                    const ours = insight.facts(card)?.controller === player;
                    return ours === helps > 0 ? worth(card) : -worth(card);
                };
                const ranked = [...request.cards].sort((a, b) => (losing ? worth(a) - worth(b) : aim(b) - aim(a)));
                const counts = [...new Set([Math.min(request.max, ranked.length), request.min])].filter(
                    (count) => count >= request.min && count <= ranked.length,
                );
                const answers: PlayerAnswer[] = [];
                for (const count of counts) answers.push(decision({ type: "Choose Cards", cards: fitChoice(request, ranked, count) }));
                if (Math.min(request.max, ranked.length) === 1 && request.min <= 1)
                    for (const card of ranked.slice(1)) answers.push(decision({ type: "Choose Cards", cards: [card] }));
                return answers;
            }
            case "Order Cards": {
                const ranked = [...request.cards].sort((a, b) => worth(b) - worth(a));
                return [decision({ type: "Order Cards", cards: ranked }), decision({ type: "Order Cards", cards: [...ranked].reverse() })];
            }
            case "Choose Player": {
                const ranked = [...request.players].sort((a, b) => Number(a === player) - Number(b === player));
                return ranked.map((chosen) => decision({ type: "Choose Player", player: chosen }));
            }
            case "Choose Mode":
                return request.options.map((option) => decision({ type: "Choose Mode", mode: option.mode }));
            case "Choose Amount": {
                const amounts = [...new Set([request.max, request.min, Math.floor((request.min + request.max) / 2)])];
                return amounts.map((amount) => decision({ type: "Choose Amount", amount }));
            }
            case "Choose Trigger":
                return request.options.map((option) => decision({ type: "Choose Trigger", option: option.option }));
            case "Choose Replacement":
                return request.options.map((option) => decision({ type: "Choose Replacement", option: option.option }));
            case "Pay Cost": {
                const pay = request.payments.map((payment) => decision({ type: "Pay Cost", pay: true, payment }));
                return request.optional || !pay.length ? [...pay, decision({ type: "Pay Cost", pay: false })] : pay;
            }
            case "Optional":
                return [decision({ type: "Optional", accept: true }), decision({ type: "Optional", accept: false })];
            case "Optional Cost Rule":
                return [decision({ type: "Optional Cost Rule", accept: true }), decision({ type: "Optional Cost Rule", accept: false })];
            case "Name Card":
                return this.names(player).map((name) => decision({ type: "Name Card", name }));
            case "Distribute Damage Removal": {
                const ranked = [...request.cards].sort((a, b) => worth(b.card) - worth(a.card));
                let left = request.max;
                const amounts = ranked.map((entry) => {
                    const facts = insight.facts(entry.card);
                    const amount = Math.min(left, entry.max, facts?.damage ?? entry.max);
                    left -= amount;
                    return { card: entry.card, amount };
                });
                return [decision({ type: "Distribute Damage Removal", amounts })];
            }
        }
    }

    /** Names seen from opponents first, then the bot's own list, for naming effects. */
    private names(player: PlayerNumber): string[] {
        const names: string[] = [];
        const memory = this.knowledge.all();
        for (const [seat, knowledge] of Object.entries(memory))
            if (Number(seat) !== player) for (const card of knowledge?.seenCards ?? []) names.push(...printedNames(card.fullName));
        for (const entry of this.setup.deck) names.push(...printedNames(entry.fullName));
        return [...new Set(names)].slice(0, 4);
    }

    /** Highest score with stable ties, or a deliberately weaker choice at the configured rate. */
    private pick(scored: readonly { answer: PlayerAnswer; score: number }[]): PlayerAnswer {
        if (!scored.length) throw new Error("No candidate answer");
        const ordered = [...scored].map((entry, index) => ({ ...entry, index })).sort((a, b) => b.score - a.score || a.index - b.index);
        const randomness = this.setup.settings.randomness ?? 0;
        if (randomness > 0 && this.difficulty.next() < randomness) {
            const weaker = ordered.filter((entry) => entry.score < ordered[0].score);
            if (weaker.length) return weaker[this.difficulty.int(weaker.length)].answer;
        }
        return ordered[0].answer;
    }
}

/**
 * What an action gives up besides ink, which refreshes every turn: cards discarded
 * or returned, characters exerted instead of questing, damage and lore.
 */
function price(costs: readonly Cost[], source: CardFacts | undefined, strategy: Strategy): number {
    let total = 0;
    for (const cost of costs) {
        const count = cost.type === "Choose Cards" ? cost.count : 1;
        for (const part of cost.type === "Choose Cards" ? cost.cost : [cost])
            switch (part.type) {
                case "Exert":
                    total += part.cards === "Self" ? (source?.definition.type === "Character" ? source.lore * 60 : 0) : count * 60;
                    break;
                case "Banish":
                    total += part.cards === "Self" && source ? boardValue(source, strategy) : count * 150;
                    break;
                case "Discard":
                    total += count * 90;
                    break;
                case "Move Card":
                    total += part.cards === "Self" && source?.zone === "Play" ? boardValue(source, strategy) : count * 70;
                    break;
                case "Deal Damage":
                    total += typeof part.amount === "number" ? part.amount * 15 * count : 30;
                    break;
                case "Lose Lore":
                    total += typeof part.amount === "number" ? part.amount * 100 : 100;
                    break;
            }
    }
    return total;
}

/** Whether questing with every character offered a quest reaches the player's victory lore. */
function finishing(insight: Insight, actions: readonly ActionOption[], player: PlayerNumber): boolean {
    let lore = insight.lore(player);
    for (const entry of actions) if (entry.action.type === "Quest") lore += insight.facts(entry.action.card)?.lore ?? 0;
    return lore >= insight.victoryLore(player);
}

/** The resolution's publicly observed intentions, in order. */
function intentions(record: TurnRecord): PlayerActionDescription[] {
    return record.observations.flatMap((observation) => (observation.type === "Action" ? [observation.action] : []));
}

/** A permitted list, or the cards seen so far, as the basis for an opposing plan. */
function opposingList(knowledge: PlayerKnowledge | undefined): DeckListEntry[] {
    if (knowledge?.deck) return [...knowledge.deck.cards];
    const counts = new Map<string, number>();
    for (const card of knowledge?.seenCards ?? []) counts.set(card.fullName, (counts.get(card.fullName) ?? 0) + 1);
    return [...counts].map(([fullName, count]) => ({ fullName, count }));
}

function sameCard(a: CardIdentifier, b: CardIdentifier): boolean {
    return a.fullName === b.fullName && a.i === b.i;
}

function isIdentifier(card: PlayerCard): card is CardIdentifier {
    return typeof card === "object" && card !== null && "fullName" in card;
}

function handleless(value: unknown): string {
    return JSON.stringify(value, (field, inner) => (field === "hidden" ? "?" : inner));
}

/** Request shape without hidden handles, used to match simulated follow-ups to live ones. */
function signature(request: PlayerRequest): string {
    return JSON.stringify(request, (field, value) => (field === "hidden" ? "?" : field === "payments" ? undefined : value));
}

/**
 * Whether a planned answer refers only to what the live request offers. Simulated
 * worlds can contain sampled cards that do not exist in the real game.
 */
function offered(answer: PlayerAnswer, request: PlayerRequest): boolean {
    if (handleless(answer).includes('"?"')) return false;
    if (answer.type === "Decision" && answer.answer.type === "Pay Cost") return false;
    const available = new Set(cardKeys(request));
    return cardKeys(answer).every((card) => available.has(card));
}

function cardKeys(value: unknown, result: string[] = []): string[] {
    if (Array.isArray(value)) for (const entry of value) cardKeys(entry, result);
    else if (value && typeof value === "object") {
        if (isIdentifier(value as PlayerCard)) result.push(`${(value as CardIdentifier).fullName}#${(value as CardIdentifier).i}`);
        else for (const entry of Object.values(value)) cardKeys(entry, result);
    }
    return result;
}
