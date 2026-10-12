import type { CardFilter } from "../model/ability";
import type { Card } from "../model/card";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { Strategy } from "../model/strategy";
import type { CardFacts, Insight, Timing } from "./insight";

/** One lore is worth about 100. A decided game dominates every other term. */
export const WIN = 1_000_000;

/** Normalized so the average priority is 1. Weights are relative, not percentages. */
export function weights(strategy: Strategy): Strategy["priorities"] {
    const values = Object.values(strategy.priorities);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length || 1;
    const p = strategy.priorities;
    return { lore: p.lore / mean, boardControl: p.boardControl / mean, cards: p.cards / mean, ink: p.ink / mean, development: p.development / mean };
}

/** Static value of a card in play for its controller. */
export function boardValue(facts: CardFacts, strategy: Strategy): number {
    const w = weights(strategy);
    const definition = facts.definition;
    if (definition.type === "Character") {
        const lore = facts.keyword("Reckless") ? 0 : facts.lore;
        const durability = Math.max(0, facts.willpower - facts.damage);
        let value =
            25 +
            definition.cost * 12 * w.development +
            lore * 110 * w.lore +
            facts.strength * 11 * w.boardControl +
            durability * 7 +
            (definition.abilities?.length ?? 0) * 12 +
            facts.granted * 8;
        if (facts.keyword("Evasive")) value += 25;
        if (facts.keyword("Ward")) value += 15;
        if (facts.keyword("Bodyguard")) value += 10;
        value += facts.keyword("Resist") * 12 + facts.keyword("Challenger") * 5;
        if (facts.keyword("Support")) value += 10;
        return value + synergyValue(definition, strategy) * 0.5;
    }
    if (definition.type === "Location") return 25 + definition.cost * 14 + facts.lore * 110 * w.lore + Math.max(0, facts.willpower - facts.damage) * 4;
    return 25 + definition.cost * 16 * w.development + synergyValue(definition, strategy) * 0.5;
}

/** Printed facts only, for preservation and synergy filters. Contextual filters do not match. */
export function matchesPrinted(card: Card, filter: CardFilter): boolean {
    for (const [field, value] of Object.entries(filter)) {
        switch (field) {
            case "name":
                if (!card.names.includes(value as string)) return false;
                break;
            case "cardType":
                if (card.type !== value) return false;
                break;
            case "song":
                if (card.subtypes.includes("Song") !== value) return false;
                break;
            case "inkable":
                if (card.inkwell !== value) return false;
                break;
            case "inkType":
                if (!card.colors.includes(value as Card["colors"][number])) return false;
                break;
            case "classification":
                if (!(card.subtypes as readonly string[]).includes(value as string)) return false;
                break;
            case "keyword":
                if (!(card.abilities ?? []).some((ability) => ability.type === "Keyword" && ability.keyword.name === value)) return false;
                break;
            case "cost": {
                const comparison = value as Record<string, unknown>;
                const [kind, amount] = Object.entries(comparison)[0] ?? [];
                if (typeof amount !== "number") return false;
                if (kind === "atLeast" && card.cost < amount) return false;
                if (kind === "atMost" && card.cost > amount) return false;
                if (kind === "equal" && card.cost !== amount) return false;
                if (kind === "lessThan" && card.cost >= amount) return false;
                if (kind === "greaterThan" && card.cost <= amount) return false;
                break;
            }
            case "and":
                if (!(value as CardFilter[]).every((inner) => matchesPrinted(card, inner))) return false;
                break;
            case "or":
                if (!(value as CardFilter[]).some((inner) => matchesPrinted(card, inner))) return false;
                break;
            case "not":
                if (matchesPrinted(card, value as CardFilter)) return false;
                break;
            default:
                return false;
        }
    }
    return true;
}

/**
 * Worth of the copies the plan wants to retain across hand and play, such as a
 * Shift base. Playing such a card keeps it. Inking or discarding it does not.
 */
function retained(insight: Insight, player: PlayerNumber, strategy: Strategy): number {
    const preserve = strategy.resources.preserve;
    if (!preserve.length) return 0;
    const hand = insight.hand(player);
    const cards = [
        ...(typeof hand === "number" || !hand ? [] : hand).flatMap((card) => {
            const facts = card ? insight.facts(card) : undefined;
            return facts ? [facts.definition] : [];
        }),
        ...insight
            .board(player)
            .filter((facts) => facts.owner === player)
            .map((facts) => facts.definition),
    ];
    let value = 0;
    for (const entry of preserve) value += Math.min(entry.copies, cards.filter((card) => matchesPrinted(card, entry.cards)).length) * 150 * entry.importance;
    return value;
}

function synergyValue(card: Card, strategy: Strategy): number {
    let value = 0;
    for (const synergy of strategy.synergies) {
        if (synergy.enablers.some((filter) => matchesPrinted(card, filter))) value += 40 * synergy.importance;
        if (synergy.payoffs.some((filter) => matchesPrinted(card, filter))) value += 40 * synergy.importance;
    }
    return value;
}

/**
 * Worth of keeping a card in hand: an affordable development option, plus
 * synergy and, for static choices such as inking and discards, preservation.
 * Position evaluation counts preservation once across hand and play instead.
 */
export function keepValue(card: Card, inkwell: number, strategy: Strategy, preservation = true): number {
    const w = weights(strategy);
    let value = 40 * w.cards;
    const turnsAway = Math.max(0, card.cost - inkwell - 1);
    value += Math.max(0, 20 - turnsAway * 8) + card.cost * 3;
    if (card.type === "Character") value += card.lore * 8 * w.lore;
    if (preservation) for (const preserve of strategy.resources.preserve) if (matchesPrinted(card, preserve.cards)) value += 120 * preserve.importance;
    value += synergyValue(card, strategy);
    return value;
}

/** Ink up to the plan's target is valuable development. Beyond it, a little. */
function inkValue(count: number, strategy: Strategy, tuning: Tuning = defaultTuning): number {
    const w = weights(strategy);
    const target = strategy.resources.targetInk;
    return Math.min(count, target) * (80 + 30 * w.ink) * tuning.ink + Math.max(0, count - target) * 15;
}

/**
 * Position score for one player against every opponent, on the lore scale.
 * Timing says who acts next. That player can quest or challenge before anyone
 * else, so a reachable win for them is nearly decided and exposed characters
 * are at risk from them. Decided positions keep a small material tiebreak, so a
 * losing line still prefers the most resistance and a winning one the most margin.
 */
/**
 * Evaluation weights that are implementation tuning, not strategy. Strategy says what
 * a deck values. These say how the evaluator trades lore, risk and tempo, and are
 * adjusted only by paired bot comparisons.
 */
export interface Tuning {
    /** Weight of exposed characters the next player can banish by challenging. */
    readonly exposure: number;
    /** Weight of exposed opposing characters when we act next. */
    readonly attack: number;
    /** Weight of lore pressure close to victory. */
    readonly race: number;
    /** Root actions searched per decision, chosen by static estimate, plus ending the turn. */
    readonly roots: number;
    /** Weight of each ink up to the plan's target. Ink compounds beyond the search horizon. */
    readonly ink: number;
}

export const defaultTuning: Tuning = { exposure: 1, attack: 0.5, race: 1, roots: 8, ink: 2 };

export function evaluate(
    insight: Insight,
    player: PlayerNumber,
    strategy: Strategy,
    timing: Timing = { player: insight.view.turn.player, starting: false },
    winners?: readonly PlayerNumber[],
    tuning: Tuning = defaultTuning,
): number {
    const players = insight.players();
    if (!players.includes(player)) return -WIN;
    const material = (): number => balance(insight, player, strategy, timing.player, tuning) / 100;
    if (winners) return (winners.includes(player) ? WIN : -WIN) + material();
    for (const other of players) {
        const lore = insight.lore(other);
        if (lore >= insight.victoryLore(other)) return (other === player ? WIN : -WIN) + material();
    }
    const next = timing.player;
    const lore = insight.lore(next);
    if (lore + questPotential(insight, next, timing.starting) >= insight.victoryLore(next)) return (next === player ? WIN : -WIN) / 2 + material();
    return balance(insight, player, strategy, next, tuning);
}

/** Own side minus the strongest opponent, with exposure to whoever acts next. */
function balance(insight: Insight, player: PlayerNumber, strategy: Strategy, next: PlayerNumber, tuning: Tuning): number {
    const opponents = insight.players().filter((other) => other !== player);
    const values = new Map<string, number>();
    const value = (facts: CardFacts): number => {
        const key = `${facts.card.fullName}#${facts.card.i}`;
        let result = values.get(key);
        if (result === undefined) values.set(key, (result = boardValue(facts, strategy)));
        return result;
    };
    const side = (who: PlayerNumber): number => {
        const board = insight.board(who).reduce((sum, facts) => sum + value(facts), 0);
        const inkwell = insight.inkwell(who);
        const cards = insight.hand(who);
        let hand: number;
        if (who === player && typeof cards !== "number") {
            hand = cards.reduce((sum, card) => {
                const facts = card ? insight.facts(card) : undefined;
                return sum + (facts ? keepValue(facts.definition, inkwell, strategy, false) : 45);
            }, 0);
            hand += Math.min(cards.length, 2) * 30 + retained(insight, player, strategy);
        } else {
            const count = typeof cards === "number" ? cards : cards.length;
            hand = count * 55 + Math.min(count, 2) * 30;
        }
        return insight.lore(who) * 100 + board + hand + inkValue(inkwell, strategy, tuning) + race(insight, who) * 100 * tuning.race;
    };
    const mine = side(player);
    const theirs = opponents.length ? Math.max(...opponents.map(side)) : 0;
    let exposure = 0;
    if (next !== player) exposure -= exposed(insight, next, player, value) * (0.6 + strategy.caution * 0.4) * tuning.exposure;
    else for (const other of opponents) exposure += exposed(insight, player, other, value) * tuning.attack;
    return mine - theirs + exposure;
}

/**
 * Lore the player can still quest for before anyone else acts. At the start of a
 * turn every character readies and dries, and locations add their lore. Mid-turn,
 * only ready, dry characters can quest. Restrictions and removal are not modelled.
 */
function questPotential(insight: Insight, player: PlayerNumber, starting: boolean): number {
    let lore = 0;
    for (const facts of insight.board(player)) {
        if (facts.definition.type === "Location") lore += starting ? facts.lore : 0;
        else if (facts.definition.type === "Character" && !facts.keyword("Reckless") && (starting || (!facts.exerted && !facts.drying))) lore += facts.lore;
    }
    return lore;
}

/**
 * Lore the player can expect from questing next turn, beyond the current total,
 * as pressure when it approaches victory. Not a turn simulation.
 */
function race(insight: Insight, player: PlayerNumber): number {
    const lore = insight.lore(player);
    const clock = insight
        .board(player)
        .reduce(
            (sum, facts) =>
                sum +
                (facts.definition.type === "Character" && !facts.keyword("Reckless") ? facts.lore : facts.definition.type === "Location" ? facts.lore : 0),
            0,
        );
    const victory = insight.victoryLore(player);
    return Math.max(0, Math.min(victory, lore + clock * 2) - (victory - 4));
}

/**
 * Value the attacker can remove by challenging the defender's exerted characters
 * next turn, each attacker used once, net of attackers lost. Greedy, not optimal.
 */
function exposed(insight: Insight, attacker: PlayerNumber, defender: PlayerNumber, value: (facts: CardFacts) => number): number {
    const targets = insight
        .board(defender)
        .filter((facts) => facts.definition.type === "Character" && facts.exerted)
        .sort((a, b) => value(b) - value(a));
    const available = insight.board(attacker).filter((facts) => facts.definition.type === "Character");
    const used = new Set<CardIdentifier>();
    let total = 0;
    for (const target of targets) {
        let best = 0,
            choice: CardIdentifier | undefined;
        for (const candidate of available) {
            if (used.has(candidate.card)) continue;
            // Damage first: it is cheap, and a challenge that cannot banish needs no legality check.
            const { toDefender, toAttacker } = insight.challenge(candidate.card, target.card);
            if (toDefender < target.willpower - target.damage || !insight.threatens(candidate.card, target.card)) continue;
            const lost = toAttacker >= candidate.willpower - candidate.damage ? value(candidate) : 0;
            const net = value(target) - lost;
            if (net > best) {
                best = net;
                choice = candidate.card;
            }
        }
        if (choice) {
            used.add(choice);
            total += best;
        }
    }
    return total;
}
