import { fitChoice } from "../bot/choice";
import type { Cost, Keyword } from "../model/ability";
import type { Card } from "../model/card";
import type { GameState } from "../model/game-state";
import type { CardZonePlayerView, GameStateView } from "../model/game-state-view";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { PlayerActionDescription } from "../model/player-interaction";
import type { PlayerAction, TurnRequest, TurnStep } from "../model/turn";
import type { TurnStepView } from "../model/turn-view";
import type { CardFacts, Hypothesis, Insight, SimulationResult, SimulationSearch, WorldFill } from "../bot/insight";
import { getCard } from "../cards";
import { canChallenge } from "../engine/actions";
import { continueTurn, startTurn } from "../engine/engine";
import { InvalidInput } from "../engine/invalid-input";
import type { Resolution } from "../engine/resolution";
import { CardTable, Rules, type CardLocation, type EngineOptions } from "../engine/rules";
import { cardKey } from "../player/locations";
import { compareCards, projectState, sight, type Sight } from "../player/projection";
import { actionCost, describeAction, projectRequest } from "../player/requests";

/** Stands in for any card whose identity the viewer cannot see. It has no abilities and cannot be played or inked. */
export const HIDDEN_CARD = "Hidden Card";
const PLACEHOLDER_BASE = 1_000_000_000;

const placeholder: Card = { type: "Item", fullName: HIDDEN_CARD, names: [HIDDEN_CARD], colors: [], cost: 99, inkwell: false, subtypes: [] };

export const hypotheticalOptions: EngineOptions = { card: (name) => (name === HIDDEN_CARD ? placeholder : getCard(name)) };

/** Longest rollout, in accepted inputs, before it is evaluated where it stands. */
const ROLLOUT_GUARD = 400;

/**
 * Builds a complete position from a view alone. Hidden entries take sampled
 * names in order, then become distinct inert placeholders. Nothing is copied
 * from the authoritative position.
 */
export function hypothesize(view: GameStateView, fill: WorldFill = {}): GameState {
    let next = 0;
    // Engine identifiers are nonnegative. Hypothetical cards use a range real setup never assigns.
    const make = (name = HIDDEN_CARD): CardIdentifier => ({ fullName: getCard(name) ? name : HIDDEN_CARD, i: PLACEHOLDER_BASE + ++next });
    const players: GameState["players"] = {};
    for (const [seat, position] of Object.entries(view.players)) {
        if (!position) continue;
        const names = fill[Number(seat) as PlayerNumber];
        const take = (zone: number | readonly (CardIdentifier | null)[], source: readonly string[] = []): CardIdentifier[] => {
            let used = 0;
            const entries = typeof zone === "number" ? Array<null>(zone).fill(null) : zone;
            return entries.map((card) => card ?? make(source[used++]));
        };
        const { deck, hand, inkwell, play, removed, ...rest } = position;
        players[Number(seat) as PlayerNumber] = {
            ...rest,
            deck: take(deck, names?.deck),
            hand: take(hand, names?.hand),
            inkwell: inkwell.map((ink) => ({ card: ink.card ?? make(), exerted: ink.exerted })),
            play: play.map(({ under, ...state }) => ({ ...state, ...(under ? { under: under.map((entry) => ({ ...entry, card: entry.card ?? make() })) } : {}) })),
            ...(removed !== undefined ? { removed: take(removed) } : {}),
        };
    }
    return { turn: view.turn, players };
}

/**
 * The current decision point in a hypothetical world. Every exploration branches
 * from the root, which itself never receives input.
 */
interface Opening {
    readonly replayed: boolean;
    readonly root: Resolution;
}

/**
 * Replays the visible inputs of the current resolution from a hypothetical start.
 * Hidden payloads are filled only where any answer is equivalent for the result
 * (trigger order, shuffle order). The replay is used only when the final position
 * shows the viewer exactly what it currently sees.
 */
export function replayTurn(
    start: GameState,
    steps: readonly TurnStepView[],
    viewer: PlayerNumber,
    actual: GameStateView,
    actions: readonly PlayerActionDescription[] = [],
): { prefix: TurnStep[]; position: GameState; live: Resolution } | undefined {
    let live: Resolution;
    try {
        live = startTurn(start, hypotheticalOptions);
    } catch {
        return undefined;
    }
    const prefix: TurnStep[] = [];
    let intention = 0;
    for (const seen of steps) {
        // Every intention is also observed publicly, so an omitted one is known by its description.
        const described = seen.type === "Action" ? actions[intention++] : undefined;
        const step = concrete(seen, live, described);
        if (!step) return undefined;
        try {
            live.submit(step);
        } catch {
            return undefined;
        }
        prefix.push(step);
    }
    const request = live.request,
        position = live.position;
    if (request?.type !== "Action" || request.player !== viewer || !position) return undefined;
    return consistent(position, viewer, actual) ? { prefix, position, live } : undefined;
}

function concrete(seen: TurnStepView, live: Resolution, described?: PlayerActionDescription): TurnStep | undefined {
    const request = live.request;
    if (!request) return undefined;
    if (seen.type === "Random") {
        if (request.type === "Shuffle") return { type: "Random", outcome: { type: "Shuffle", cards: request.cards } };
        if (request.type !== "Random Cards") return undefined;
        const cards = seen.outcome.type === "Random Cards" && seen.outcome.cards ? seen.outcome.cards : request.cards.slice(0, request.count);
        return { type: "Random", outcome: { type: "Random Cards", cards } };
    }
    if (seen.type === "Action") {
        if (request.type !== "Action") return undefined;
        if (seen.action) return { type: "Action", action: seen.action };
        const rules = live.rules;
        const action = described && rules ? request.actions.find((candidate) => JSON.stringify(describeAction(candidate, rules)) === JSON.stringify(described)) : undefined;
        return action && { type: "Action", action };
    }
    if (request.type === "Action" || request.type === "Shuffle" || request.type === "Random Cards") return undefined;
    if (seen.answer) return { type: "Decision", answer: seen.answer };
    if (request.type === "Choose Trigger" && request.options[0]) return { type: "Decision", answer: { type: "Choose Trigger", trigger: request.options[0].reference } };
    if (request.type === "Choose Replacement" && request.options[0]) return { type: "Decision", answer: { type: "Choose Replacement", replacement: request.options[0].reference } };
    // A hidden payment names facedown ink. Any legal payment exerting the same amount looks the same.
    if (request.type === "Pay Cost" && live.position && live.rules) {
        const player = typeof request.player === "number" ? request.player : request.player.together[0];
        const projected = projectRequest(request, live.rules, visibleTo(live.rules, player), identity);
        const payment = projected.request.type === "Pay Cost" ? projected.request.payments[0] : undefined;
        if (!payment) return undefined;
        try {
            return projected.toStep({ type: "Decision", answer: { type: "Pay Cost", pay: true, payment } });
        } catch {
            return undefined;
        }
    }
    // A choice among cards hidden from the viewer: in a hypothetical world any of them is
    // equally plausible. The final consistency check rejects a choice with visible effects.
    if ((request.type === "Choose Cards" || request.type === "Order Cards") && live.position && live.rules) {
        const player = typeof request.player === "number" ? request.player : request.player.together[0];
        const projected = projectRequest(request, live.rules, visibleTo(live.rules, player), identity);
        const offered = projected.request;
        try {
            if (offered.type === "Order Cards") return projected.toStep({ type: "Decision", answer: { type: "Order Cards", cards: offered.cards } });
            if (offered.type === "Choose Cards") return projected.toStep({ type: "Decision", answer: { type: "Choose Cards", cards: fitChoice(offered, offered.cards, Math.max(offered.min, Math.min(offered.max, 1))) } });
        } catch {
            return undefined;
        }
    }
    return undefined;
}

/** Whether the viewer would see exactly this view in the hypothetical position. */
export function consistent(position: GameState, viewer: PlayerNumber, actual: GameStateView): boolean {
    const visible = new Set<string>();
    for (const card of shown(actual)) visible.add(cardKey(card));
    const base = sight(position, viewer);
    const projected = projectState(position, (card) => base(card) || visible.has(cardKey(card)));
    return JSON.stringify(canonical(projected)) === JSON.stringify(canonical(actual));
}

/**
 * Cards discarded together enter the discard in their hand's hidden order, which a
 * view never shows, so discards are compared as collections. No effect reads discard order.
 */
function canonical(view: GameStateView): GameStateView {
    const players: GameStateView["players"] = {};
    for (const [seat, position] of Object.entries(view.players))
        if (position) players[Number(seat) as PlayerNumber] = { ...position, discard: [...position.discard].sort(compareCards) };
    return { ...view, players };
}

function shown(view: GameStateView): CardIdentifier[] {
    const result: CardIdentifier[] = [];
    for (const position of Object.values(view.players)) {
        if (!position) continue;
        for (const zone of [position.deck, position.hand, position.removed ?? 0]) if (typeof zone !== "number") for (const card of zone) if (card) result.push(card);
        result.push(...position.discard);
        for (const ink of position.inkwell) if (ink.card) result.push(ink.card);
        for (const card of position.play) {
            result.push(card.card);
            for (const under of card.under ?? []) if (under.card) result.push(under.card);
        }
    }
    return result;
}

/** A card's current characteristics. Rarely read ones are computed when asked. */
class Facts implements CardFacts {
    readonly definition: Card;
    readonly controller: PlayerNumber;
    readonly owner: PlayerNumber;
    readonly zone: CardFacts["zone"];
    readonly strength: number;
    readonly willpower: number;
    readonly lore: number;
    readonly damage: number;
    readonly exerted: boolean;
    readonly drying: boolean;
    readonly granted: number;
    private readonly keywords = new Map<Keyword, number>();

    constructor(
        readonly card: CardIdentifier,
        place: CardLocation,
        private readonly rules: Rules,
    ) {
        const definition = (this.definition = rules.definition(card));
        const state = place.state;
        this.controller = place.player;
        this.owner = state?.owner ?? place.player;
        this.zone = place.zone;
        this.strength = definition.type === "Character" ? rules.characteristic(card, "Strength") : 0;
        this.willpower = definition.type === "Character" || definition.type === "Location" ? rules.characteristic(card, "Willpower") : 0;
        this.lore = definition.type === "Character" || definition.type === "Location" ? rules.characteristic(card, "Lore") : 0;
        this.damage = state?.damage ?? 0;
        this.exerted = state?.exerted ?? false;
        this.drying = state?.drying ?? false;
        this.granted = place.zone === "Play" ? rules.grants(card).length : 0;
    }

    get cost(): number {
        return this.zone === "Play" ? this.definition.cost : this.rules.cost(this.card);
    }

    get inkable(): boolean {
        return this.rules.inkable(this.card);
    }

    keyword(keyword: Keyword): number {
        let value = this.keywords.get(keyword);
        if (value === undefined) this.keywords.set(keyword, (value = this.rules.keyword(this.card, keyword)));
        return value;
    }
}

/** Trusted implementation of Insight over a hypothetical position. */
export class HypotheticalInsight implements Insight {
    private readonly rules: Rules;
    private readonly cache = new CardTable<CardFacts | undefined>();
    private readonly readied = new Map<PlayerNumber, Rules>();
    private projected?: GameStateView;
    private opening?: Opening;

    /** state must already be hypothetical, never an authoritative position. */
    constructor(
        readonly state: GameState,
        readonly viewer: PlayerNumber,
        private readonly hypothesis?: Hypothesis,
        private readonly actual?: GameStateView,
        /** A live resolution's queries for this exact position, which include its turn history. */
        rules?: Rules,
    ) {
        this.rules = rules?.position === state ? rules : new Rules(state, hypotheticalOptions.card);
    }

    static fromView(view: GameStateView, viewer: PlayerNumber, hypothesis?: Hypothesis): HypotheticalInsight {
        const current = hypothesis?.current ?? { view };
        return new HypotheticalInsight(hypothesize(current.view, current.fill), viewer, hypothesis, view);
    }

    get view(): GameStateView {
        return (this.projected ??= projectState(this.state, visibleTo(this.rules, this.viewer)));
    }

    get replayed(): boolean {
        return this.open().replayed;
    }

    players(): readonly PlayerNumber[] {
        return this.rules.players();
    }

    lore(player: PlayerNumber): number {
        return this.state.players[player]?.lore ?? 0;
    }

    inkwell(player: PlayerNumber): number {
        return this.state.players[player]?.inkwell.length ?? 0;
    }

    /** Nothing in a hypothetical world has been looked at, so only the viewer's own hand is seen, in view order. */
    hand(player: PlayerNumber): CardZonePlayerView {
        const cards = this.state.players[player]?.hand ?? [];
        return player === this.viewer && cards.length ? [...cards].sort(compareCards) : cards.length;
    }

    facts(card: CardIdentifier): CardFacts | undefined {
        if (card.fullName === HIDDEN_CARD) return undefined;
        if (this.cache.has(card)) return this.cache.get(card);
        const place = this.rules.locate(card);
        const facts = place ? new Facts(card, place, this.rules) : undefined;
        this.cache.set(card, facts);
        return facts;
    }

    board(player: PlayerNumber): readonly CardFacts[] {
        return (this.state.players[player]?.play ?? []).flatMap((state) => {
            const facts = this.facts(state.card);
            return facts ? [facts] : [];
        });
    }

    victoryLore(player: PlayerNumber): number {
        return this.rules.victoryLore(player);
    }

    threatens(attacker: CardIdentifier, defender: CardIdentifier): boolean {
        const controller = this.facts(attacker)?.controller;
        if (controller === undefined) return false;
        let rules = this.readied.get(controller);
        if (!rules) {
            const position = this.state.players[controller]!;
            const ready: GameState = {
                ...this.state,
                turn: { number: this.state.turn.number + 1, player: controller },
                players: { ...this.state.players, [controller]: { ...position, play: position.play.map((state) => ({ ...state, exerted: false, drying: false })) } },
            };
            rules = new Rules(ready, hypotheticalOptions.card);
            this.readied.set(controller, rules);
        }
        try {
            return canChallenge(rules, attacker, defender);
        } catch {
            return false;
        }
    }

    challenge(attacker: CardIdentifier, defender: CardIdentifier): { toDefender: number; toAttacker: number } {
        const a = this.facts(attacker),
            d = this.facts(defender);
        if (!a || !d) return { toDefender: 0, toAttacker: 0 };
        return {
            toDefender: Math.max(0, a.strength + a.keyword("Challenger") - d.keyword("Resist")),
            toAttacker: d.definition.type === "Character" ? Math.max(0, d.strength - a.keyword("Resist")) : 0,
        };
    }

    /**
     * Reaches the current decision point once per world. A verified replay of the
     * resolution keeps turn-local history. Otherwise the turn continues from the
     * current position without it.
     */
    private open(): Opening {
        if (this.opening) return this.opening;
        const turn = this.hypothesis?.turn;
        if (turn && this.actual && this.state.turn.player === this.viewer) {
            const start = hypothesize(turn.start.view, turn.start.fill);
            const replay = replayTurn(start, turn.steps, this.viewer, this.actual, turn.actions);
            if (replay) return (this.opening = { replayed: true, root: replay.live });
        }
        return (this.opening = { replayed: false, root: continueTurn(this.state, hypotheticalOptions) });
    }

    simulate(action: PlayerActionDescription, cost: readonly Cost[], search: SimulationSearch): SimulationResult | undefined {
        const opening = this.open();
        let nodes = 0;
        const reopen = (extra: readonly TurnStep[]): Resolution => {
            const live = opening.root.branch();
            if (!live) throw new Error("The current decision point cannot branch");
            for (const step of extra) live.submit(step);
            nodes += extra.length;
            return live;
        };
        let root: Resolution;
        try {
            root = reopen([]);
        } catch {
            return undefined;
        }
        const request = root.request;
        if (request?.type !== "Action" || request.player !== this.viewer || !root.rules) return undefined;
        const engine = match(request.actions, root.rules, action, cost);
        if (!engine) return undefined;
        const viewer = this.viewer;
        const evaluate = (position: GameState): Insight => new HypotheticalInsight(position, viewer);

        /** Plays answers for whoever is asked, preferring the first valid candidate. */
        const answer = (live: Resolution, request: TurnRequest): TurnStep | undefined => {
            if (request.type === "Shuffle") return { type: "Random", outcome: { type: "Shuffle", cards: request.cards } };
            if (request.type === "Random Cards") return { type: "Random", outcome: { type: "Random Cards", cards: request.cards.slice(0, request.count) } };
            const player = typeof request.player === "number" ? request.player : request.player.together[0];
            const position = live.position,
                rules = live.rules;
            if (!position || !rules) return undefined;
            const projected = projectRequest(request, rules, visibleTo(rules, player), identity);
            for (const candidate of search.candidates(new HypotheticalInsight(position, player, undefined, undefined, rules), projected.request, player)) {
                try {
                    return projected.toStep(candidate);
                } catch (error) {
                    if (!(error instanceof InvalidInput)) return undefined;
                }
            }
            return undefined;
        };

        /**
         * Finishes the turn and optionally the reply, then scores the position reached.
         * Every rollout reaches the same point, so explored alternatives compare fairly.
         */
        const rollout = (live: Resolution): { score: number; insight: Insight } | undefined => {
            let reply = false;
            for (let guard = 0; guard < ROLLOUT_GUARD; guard++) {
                const outcome = live.outcome;
                if (outcome) {
                    const position = live.result ?? live.position!;
                    const insight = evaluate(position);
                    return { score: search.evaluate(insight, { player: position.turn.player, starting: !!live.result }, outcome.winners), insight };
                }
                const request = live.request;
                if (!request) {
                    const result = live.result;
                    if (!result) return undefined;
                    // A finished turn leaves the next player about to start theirs.
                    const between = { player: result.turn.player, starting: true };
                    if (reply || !search.reply) {
                        const insight = evaluate(result);
                        return { score: search.evaluate(insight, between), insight };
                    }
                    try {
                        live = startTurn(result, hypotheticalOptions);
                    } catch {
                        const insight = evaluate(result);
                        return { score: search.evaluate(insight, between), insight };
                    }
                    reply = true;
                    continue;
                }
                const step = answer(live, request);
                if (!step) return undefined;
                try {
                    live.submit(step);
                } catch {
                    return undefined;
                }
                nodes++;
            }
            const position = live.position ?? live.result;
            if (!position) return undefined;
            const insight = evaluate(position);
            return { score: search.evaluate(insight, { player: position.turn.player, starting: !live.position }), insight };
        };

        const limit = Math.max(1, search.nodes);
        /** Explores the action's own decisions, branching while budget remains, then rolls out. */
        const explore = (extra: TurnStep[], line: SimulationResult["line"]): SimulationResult | undefined => {
            let live: Resolution;
            try {
                live = reopen(extra);
            } catch {
                return undefined;
            }
            const steps = [...extra],
                path = [...line];
            for (let guard = 0; guard < ROLLOUT_GUARD; guard++) {
                const request = live.request;
                if (!request || request.type === "Action" || live.outcome) {
                    const result = rollout(live);
                    return result && { score: result.score, line: path, insight: result.insight, nodes };
                }
                if (request.type === "Shuffle" || request.type === "Random Cards") {
                    const step = answer(live, request)!;
                    live.submit(step);
                    steps.push(step);
                    nodes++;
                    continue;
                }
                const player = typeof request.player === "number" ? request.player : request.player.together[0];
                const position = live.position,
                    rules = live.rules;
                if (!position || !rules) return undefined;
                const projected = projectRequest(request, rules, visibleTo(rules, player), identity);
                const candidates = search.candidates(new HypotheticalInsight(position, player, undefined, undefined, rules), projected.request, player);
                const branch = player === viewer && candidates.length > 1 && nodes < limit / 2;
                if (!branch) {
                    let accepted = false;
                    for (const candidate of candidates) {
                        try {
                            const step = projected.toStep(candidate);
                            live.submit(step);
                            steps.push(step);
                            if (player === viewer) path.push({ request: projected.request, answer: candidate });
                            nodes++;
                            accepted = true;
                            break;
                        } catch (error) {
                            if (!(error instanceof InvalidInput)) return undefined;
                        }
                    }
                    if (!accepted) return undefined;
                    continue;
                }
                let best: SimulationResult | undefined;
                for (const candidate of candidates.slice(0, Math.max(1, search.width))) {
                    let step: TurnStep;
                    try {
                        step = projected.toStep(candidate);
                    } catch {
                        continue;
                    }
                    const outcome = explore([...steps, step], [...path, { request: projected.request, answer: candidate }]);
                    if (outcome && (!best || outcome.score > best.score)) best = outcome;
                }
                return best && { ...best, nodes };
            }
            return undefined;
        };
        try {
            return explore([{ type: "Action", action: engine }], []);
        } catch {
            return undefined;
        }
    }
}

/** What a player sees of a hypothetical position, where nothing has been looked at or revealed. */
function visibleTo(rules: Rules, viewer: PlayerNumber): Sight {
    return (card) => {
        const place = rules.locate(card);
        if (!place) return false;
        return place.zone === "Play" || place.zone === "Discard" || (place.zone === "Under" && !place.under?.faceDown) || (place.zone === "Hand" && place.player === viewer);
    };
}

const identity = (count: number): number[] => Array.from({ length: count }, (_, i) => i);

/** Finds the engine action matching a public description and its price among the offered actions. */
function match(actions: readonly PlayerAction[], rules: Rules, action: PlayerActionDescription, cost: readonly Cost[]): PlayerAction | undefined {
    const wanted = JSON.stringify(action),
        price = JSON.stringify(cost);
    let fallback: PlayerAction | undefined;
    for (const candidate of actions) {
        try {
            if (JSON.stringify(describeAction(candidate, rules)) !== wanted) continue;
            if (JSON.stringify(actionCost(candidate, rules)) === price) return candidate;
            fallback ??= candidate;
        } catch {
            continue;
        }
    }
    return fallback;
}
