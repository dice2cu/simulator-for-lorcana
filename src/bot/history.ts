import type { PlayerKnowledge } from "../model/bot";
import type { CardZonePlayerView, GameStateView, PlayerPositionView } from "../model/game-state-view";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { PlayerCardLocation, PlayerObservation, PlayerUpdate } from "../model/player-interaction";
import type { TurnStepView } from "../model/turn-view";

const key = (card: CardIdentifier): string => `${card.fullName}#${card.i}`;

type Memory = Partial<Record<PlayerNumber, PlayerKnowledge>>;

/** The current resolution as the bot saw it: where it began and what followed. */
export interface TurnRecord {
    /** The final update of the previous resolution, which is where this one starts. */
    readonly start: GameStateView;
    /** Knowledge after that update, before anything in this resolution. */
    readonly memory: Memory;
    readonly observations: readonly PlayerObservation[];
    readonly steps: readonly TurnStepView[];
}

/**
 * Follows updates to remember where the current resolution began. A new
 * resolution is recognized when the turn view stops extending the previous one.
 */
export class TurnHistory {
    private previous?: { state: GameStateView; steps: readonly TurnStepView[]; memory: Memory };
    private current?: { start: GameStateView; memory: Memory; observations: PlayerObservation[]; steps: readonly TurnStepView[] };

    /** Call after memory processes the update. A new start uses memory as it was after the previous one. */
    record(update: PlayerUpdate, memory: Memory): void {
        const previous = this.previous;
        // Without a current record, the previous update is the first one seen, such as a saved position.
        if (previous && (!this.current || !continues(previous.steps, update.turn.steps)))
            this.current = { start: previous.state, memory: previous.memory, observations: [...update.observations], steps: update.turn.steps };
        else if (this.current) {
            this.current.observations.push(...update.observations);
            this.current.steps = update.turn.steps;
        }
        this.previous = { state: update.state, steps: update.turn.steps, memory };
    }

    /** A snapshot: later updates do not change a record already handed out. */
    get turn(): TurnRecord | undefined {
        return this.current && { ...this.current, observations: [...this.current.observations] };
    }
}

function continues(before: readonly TurnStepView[], after: readonly TurnStepView[]): boolean {
    if (after.length < before.length) return false;
    if (!before.length) return true;
    const last = before[before.length - 1];
    if (last.type === "Action" && last.action?.type === "End Turn") return false;
    return JSON.stringify(before[0]) === JSON.stringify(after[0]) && JSON.stringify(last) === JSON.stringify(after[before.length - 1]);
}

/**
 * Adds remembered facts to a view: known deck ends and cards known to remain
 * in an opponent's hand. Nothing is guessed. Returns undefined on a contradiction.
 */
export function augment(view: GameStateView, memory: Memory): GameStateView | undefined {
    const players: GameStateView["players"] = {};
    const used = new Set<string>();
    for (const card of identities(view)) used.add(key(card));
    for (const [seat, position] of Object.entries(view.players)) {
        if (!position) continue;
        const knowledge = memory[Number(seat) as PlayerNumber];
        if (!knowledge) {
            players[Number(seat) as PlayerNumber] = position;
            continue;
        }
        const deck = slots(position.deck);
        const place = (index: number, card: CardIdentifier): boolean => {
            if (index < 0 || index >= deck.length) return false;
            const present = deck[index];
            if (present) return key(present) === key(card);
            if (used.has(key(card))) return false;
            deck[index] = card;
            used.add(key(card));
            return true;
        };
        for (const [index, card] of knowledge.deckTop.entries()) if (!place(index, card)) return undefined;
        const offset = deck.length - knowledge.deckBottom.length;
        for (const [index, card] of knowledge.deckBottom.entries()) if (!place(offset + index, card)) return undefined;
        const hand = slots(position.hand);
        for (const card of knowledge.hand) {
            if (hand.some((entry) => entry && key(entry) === key(card))) continue;
            const empty = hand.indexOf(null);
            if (empty < 0 || used.has(key(card))) return undefined;
            hand[empty] = card;
            used.add(key(card));
        }
        players[Number(seat) as PlayerNumber] = { ...position, deck: compact(deck), hand: compact(hand) };
    }
    return { ...view, players };
}

/**
 * The resolution's starting view with every card observed leaving a hidden zone
 * put back where it must have been. Undefined when the observations cannot be
 * placed, such as an unpositioned deck move before the card was identified.
 */
export function rewind(record: TurnRecord): GameStateView | undefined {
    const start = augment(record.start, record.memory);
    if (!start) return undefined;
    const decks = new Map<PlayerNumber, { known: (CardIdentifier | null)[]; slots: number[]; lost: boolean }>();
    const hands = new Map<PlayerNumber, { held: CardIdentifier[]; added: Set<string> }>();
    for (const [seat, position] of Object.entries(start.players)) {
        if (!position) continue;
        const known = slots(position.deck);
        decks.set(Number(seat) as PlayerNumber, { known, slots: known.map((_, index) => index), lost: false });
        hands.set(Number(seat) as PlayerNumber, { held: [], added: new Set() });
    }
    let consistent = true;
    const identify = (deck: { known: (CardIdentifier | null)[] }, slot: number, card: CardIdentifier | null): void => {
        if (slot < 0 || !card) return;
        const present = deck.known[slot];
        if (present && key(present) !== key(card)) consistent = false;
        deck.known[slot] = card;
    };
    const range = (deck: { slots: number[] }, position: PlayerCardLocation["position"], size = deck.slots.length): number | undefined => {
        if (!position) return undefined;
        return position.from === "Top" ? position.index : size - 1 - position.index;
    };
    for (const observation of record.observations) {
        if (observation.type === "Shuffle") {
            const deck = decks.get(observation.player);
            if (deck) deck.lost = true;
            continue;
        }
        if (observation.type === "Look" || observation.type === "Reveal") {
            const { location, cards } = observation;
            if (location.zone === "Deck") {
                const deck = decks.get(location.player);
                const first = deck && !deck.lost ? range(deck, location.position) : undefined;
                if (deck && first !== undefined) cards.forEach((card, index) => identify(deck, deck.slots[first + index] ?? -1, card));
            } else if (location.zone === "Hand") {
                const hand = hands.get(location.player);
                if (hand) for (const card of cards) if (!hand.added.has(key(card))) hand.held.push(card);
            }
            continue;
        }
        if (observation.type !== "Move Cards") continue;
        const { from, to, cards } = observation;
        if (from.zone === "Deck") {
            const deck = decks.get(from.player);
            if (deck && !deck.lost) {
                const first = range(deck, from.position);
                if (first === undefined || first < 0) deck.lost = true;
                else deck.slots.splice(first, cards.length).forEach((slot, index) => identify(deck, slot, cards[index]));
            }
        }
        if (from.zone === "Hand") {
            const hand = hands.get(from.player);
            if (hand) for (const card of cards) if (card && !hand.added.has(key(card))) hand.held.push(card);
        }
        if (to.zone === "Hand") {
            const hand = hands.get(to.player);
            if (hand) for (const card of cards) if (card) hand.added.add(key(card));
        }
        if (to.zone === "Deck") {
            const deck = decks.get(to.player);
            if (deck && !deck.lost) {
                const first = range(deck, to.position, deck.slots.length + cards.length);
                if (first === undefined || first < 0) deck.lost = true;
                else deck.slots.splice(first, 0, ...cards.map(() => -1));
            }
        }
        if (!consistent) return undefined;
    }
    if (!consistent) return undefined;
    const players: GameStateView["players"] = {};
    const used = new Set<string>();
    for (const [seat, position] of Object.entries(start.players)) {
        if (!position) continue;
        const player = Number(seat) as PlayerNumber;
        const hand = slots(position.hand);
        const present = new Set(hand.flatMap((card) => (card ? [key(card)] : [])));
        for (const card of hands.get(player)!.held) {
            if (present.has(key(card))) continue;
            const empty = hand.indexOf(null);
            if (empty < 0) return undefined;
            hand[empty] = card;
            present.add(key(card));
        }
        const next: PlayerPositionView = { ...position, deck: compact(decks.get(player)!.known), hand: compact(hand) };
        players[player] = next;
    }
    const result = { ...start, players };
    for (const card of identities(result)) {
        if (used.has(key(card))) return undefined;
        used.add(key(card));
    }
    return result;
}

/** Every identity a view shows, including hidden-zone entries added from memory. */
export function identities(view: GameStateView): CardIdentifier[] {
    const result: CardIdentifier[] = [];
    for (const position of Object.values(view.players)) {
        if (!position) continue;
        for (const zone of [position.deck, position.hand, position.removed ?? 0]) if (typeof zone !== "number") for (const card of zone) if (card) result.push(card);
        for (const card of position.discard) result.push(card);
        for (const ink of position.inkwell) if (ink.card) result.push(ink.card);
        for (const card of position.play) {
            result.push(card.card);
            for (const under of card.under ?? []) if (under.card) result.push(under.card);
        }
    }
    return result;
}

function slots(zone: CardZonePlayerView): (CardIdentifier | null)[] {
    return typeof zone === "number" ? Array<CardIdentifier | null>(zone).fill(null) : [...zone];
}

/** Keeps the count form when nothing is identified. */
function compact(zone: (CardIdentifier | null)[]): CardZonePlayerView {
    return zone.some((card) => card) ? zone : zone.length;
}
