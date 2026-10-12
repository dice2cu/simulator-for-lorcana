import type { GameState } from "../model/game-state";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { PlayerActionDescription, PlayerCardLocation, PlayerObservation } from "../model/player-interaction";
import type { TurnStep } from "../model/turn";
import type { TurnStepView } from "../model/turn-view";
import type { CardObservation } from "../engine/resolution";
import { cardKey, placements, type Placement } from "./locations";
import { compareCards, type Sight } from "./projection";
import { hiddenIdentities } from "./requests";

/** Everything the runner knows about one accepted step. Private to trusted infrastructure. */
export interface StepRecord {
    /** Omitted for processing that runs before the first input, such as a turn's start. */
    step?: TurnStep;
    before: GameState;
    after: GameState;
    /** Looks and Reveals produced while executing this step. */
    seen: readonly CardObservation[];
    /** Public description for an Action step, computed against the position before it. */
    action?: PlayerActionDescription;
    /** The selected trigger or replacement instructions, without engine slots. */
    choice?: Extract<PlayerObservation, { type: "Choose Trigger" | "Choose Replacement" }>;
}

/**
 * Notifications for one recipient, derived from execution rather than forwarded
 * from engine internals. Card identities appear only when the recipient could see
 * them before or after the step, or through a Look or Reveal addressed to them.
 */
export function observe(record: StepRecord, recipient: PlayerNumber, before: Sight, after: Sight): PlayerObservation[] {
    const result: PlayerObservation[] = [];
    const { step } = record;
    const disclosed = new Set<string>();
    for (const seen of record.seen) if (!seen.players || seen.players.includes(recipient)) for (const card of seen.cards) disclosed.add(cardKey(card));
    if (step?.type === "Action" && record.action) {
        if (record.action.type === "Ink") disclosed.add(cardKey(record.action.card));
        if (record.action.type !== "Alter Hand" || record.action.player === recipient) result.push({ type: "Action", action: record.action });
    }
    if (record.choice && !hiddenIdentities(record.choice, (card) => before(card) || after(card)).length) result.push(record.choice);
    if (step?.type === "Random" && step.outcome.type === "Shuffle") {
        const owner = shuffled(record, step.outcome.cards);
        if (owner !== undefined) result.push({ type: "Shuffle", player: owner });
    }
    const was = placements(record.before),
        now = placements(record.after);
    const early: PlayerObservation[] = [],
        late: PlayerObservation[] = [];
    for (const seen of record.seen) {
        if (seen.players && !seen.players.includes(recipient)) continue;
        const stayed = seen.cards.every((card) => same(was.get(cardKey(card)), now.get(cardKey(card))));
        const location = cardsLocation(seen.cards, stayed ? record.after : record.before);
        if (!location) continue;
        (stayed ? late : early).push({ type: seen.type, location, cards: seen.cards });
    }
    result.push(...early);
    const knows = (card: CardIdentifier): boolean => before(card) || after(card) || disclosed.has(cardKey(card));
    for (const move of moves(record)) {
        result.push({ ...move, cards: move.cards.map((card) => (knows(card) ? card : null)) });
    }
    result.push(...late);
    return result;
}

function shuffled(record: StepRecord, cards: readonly CardIdentifier[]): PlayerNumber | undefined {
    const first = cards[0];
    if (!first) return undefined;
    return (placements(record.after).get(cardKey(first)) ?? placements(record.before).get(cardKey(first)))?.player;
}

function same(a: Placement | undefined, b: Placement | undefined): boolean {
    return !!a && !!b && a.player === b.player && a.zone === b.zone && a.index === b.index && a.under?.i === b.under?.i;
}

/** The common location of the cards in one Look or Reveal. Deck positions describe cards[0]. */
function cardsLocation(cards: readonly CardIdentifier[], state: GameState): PlayerCardLocation | undefined {
    const where = placements(state);
    const places = cards.map((card) => where.get(cardKey(card)));
    const first = places[0];
    if (!first || places.some((place) => !place || place.player !== first.player || place.zone !== first.zone)) return undefined;
    const location = toLocation(first);
    if (first.zone !== "Deck") return location;
    const size = state.players[first.player]?.deck.length ?? 0;
    const indexes = places.map((place) => place!.index);
    const contiguous = indexes.every((index, i) => i === 0 || index === indexes[i - 1] + 1);
    if (!contiguous) return location;
    if (indexes[0] === 0) return { ...location, position: { from: "Top", index: 0 } };
    if (indexes[indexes.length - 1] === size - 1) return { ...location, position: { from: "Bottom", index: size - 1 - indexes[0] } };
    return location;
}

function toLocation(place: Placement): PlayerCardLocation {
    const zone = place.zone === "Removed" ? "Discard" : place.zone;
    return { player: place.player, zone, ...(place.under ? { under: place.under } : {}) };
}

type Move = Extract<PlayerObservation, { type: "Move Cards" }>;

/**
 * Groups cards by source and destination. Deck groups run top first. Other
 * groups use identity order so a hand's hidden arrangement is not disclosed.
 */
function moves(record: StepRecord): (Omit<Move, "cards"> & { cards: CardIdentifier[] })[] {
    const was = placements(record.before),
        now = placements(record.after);
    const groups = new Map<string, { from: Placement; to: Placement; cards: { card: CardIdentifier; from: Placement; to: Placement }[] }>();
    for (const [key, from] of was) {
        const to = now.get(key);
        if (!to) continue;
        if (from.player === to.player && from.zone === to.zone && (from.under ? cardKey(from.under) : "") === (to.under ? cardKey(to.under) : "")) continue;
        const card = cardOf(record.before, from);
        const id = `${from.player}|${from.zone}|${from.under ? cardKey(from.under) : ""}>${to.player}|${to.zone}|${to.under ? cardKey(to.under) : ""}`;
        const group = groups.get(id) ?? { from, to, cards: [] };
        group.cards.push({ card, from, to });
        groups.set(id, group);
    }
    const result: (Omit<Move, "cards"> & { cards: CardIdentifier[] })[] = [];
    if (!(record.step?.type === "Random" && record.step.outcome.type === "Shuffle")) result.push(...reordered(record));
    for (const group of groups.values()) {
        const fromDeck = group.from.zone === "Deck",
            toDeck = group.to.zone === "Deck";
        const entries = [...group.cards].sort((a, b) =>
            toDeck ? a.to.index - b.to.index : fromDeck ? a.from.index - b.from.index : compareCards(a.card, b.card),
        );
        const from = toLocation(group.from),
            to = toLocation(group.to);
        const source = fromDeck ? endPosition(entries.map((entry) => entry.from.index), record.before.players[group.from.player]?.deck.length ?? 0) : undefined;
        const destination = toDeck ? endPosition(entries.map((entry) => entry.to.index), record.after.players[group.to.player]?.deck.length ?? 0) : undefined;
        result.push({
            type: "Move Cards",
            from: source ? { ...from, position: source } : from,
            to: destination ? { ...to, position: destination } : to,
            cards: entries.map((entry) => entry.card),
        });
    }
    return result;
}

/**
 * A position for a contiguous group at either end of a deck, measured in the deck
 * that contains the group. Middle positions are omitted so a search does not
 * disclose where a card was.
 */
function endPosition(indexes: readonly number[], size: number): PlayerCardLocation["position"] {
    if (!indexes.length || !indexes.every((index, i) => i === 0 || index === indexes[i - 1] + 1)) return undefined;
    if (indexes[0] === 0) return { from: "Top", index: 0 };
    if (indexes[indexes.length - 1] === size - 1) return { from: "Bottom", index: size - 1 - indexes[0] };
    return undefined;
}

/**
 * Cards moved within the same deck, such as a revealed top card put on the bottom.
 * Cards keeping their relative order are treated as unmoved. Shuffles are excluded
 * by the caller because they disclose no positions.
 */
function reordered(record: StepRecord): (Omit<Move, "cards"> & { cards: CardIdentifier[] })[] {
    const result: (Omit<Move, "cards"> & { cards: CardIdentifier[] })[] = [];
    for (const [seat, position] of Object.entries(record.before.players)) {
        const after = record.after.players[Number(seat) as PlayerNumber];
        // Positions share unchanged zones, so the same deck has no reordering.
        if (!position || !after || position.deck === after.deck) continue;
        const index = new Map(after.deck.map((card, i) => [cardKey(card), i]));
        const stayed = position.deck.flatMap((card, from) => {
            const to = index.get(cardKey(card));
            return to === undefined ? [] : [{ card, from, to }];
        });
        const kept = increasing(stayed.map((entry) => entry.to));
        stayed.forEach((entry, i) => {
            if (kept.has(i)) return;
            const location = { player: Number(seat) as PlayerNumber, zone: "Deck" as const };
            const source = endPosition([entry.from], position.deck.length),
                destination = endPosition([entry.to], after.deck.length);
            result.push({
                type: "Move Cards",
                from: source ? { ...location, position: source } : location,
                to: destination ? { ...location, position: destination } : location,
                cards: [entry.card],
            });
        });
    }
    return result;
}

/** Indexes of one longest strictly increasing subsequence. */
function increasing(values: readonly number[]): Set<number> {
    const tails: number[] = [],
        previous: number[] = new Array(values.length).fill(-1);
    values.forEach((value, i) => {
        let low = 0,
            high = tails.length;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (values[tails[middle]] < value) low = middle + 1;
            else high = middle;
        }
        if (low > 0) previous[i] = tails[low - 1];
        tails[low] = i;
    });
    const result = new Set<number>();
    for (let i = tails[tails.length - 1] ?? -1; i >= 0; i = previous[i]) result.add(i);
    return result;
}

function cardOf(state: GameState, place: Placement): CardIdentifier {
    const position = state.players[place.player];
    if (!position) throw new Error("Missing player");
    switch (place.zone) {
        case "Deck":
            return position.deck[place.index];
        case "Hand":
            return position.hand[place.index];
        case "Discard":
            return position.discard[place.index];
        case "Removed":
            return position.removed![place.index];
        case "Inkwell":
            return position.inkwell[place.index].card;
        case "Play":
            return position.play[place.index].card;
        case "Under":
            return position.play.find((state) => cardKey(state.card) === cardKey(place.under!))!.under![place.index].card;
    }
}

/**
 * One historical step for a recipient. Payloads containing hidden identities or
 * engine registry and event slots are omitted. A shuffle never includes its order.
 */
export function viewStep(record: StepRecord & { step: TurnStep }, before: Sight, after: Sight): TurnStepView {
    const { step } = record;
    const sees: Sight = (card) => before(card) || after(card);
    if (step.type === "Random") {
        if (step.outcome.type === "Shuffle") return { type: "Random", outcome: { type: "Shuffle" } };
        return step.outcome.cards.every(sees)
            ? { type: "Random", outcome: { type: "Random Cards", cards: step.outcome.cards } }
            : { type: "Random", outcome: { type: "Random Cards" } };
    }
    if (step.type === "Action") {
        const action = step.action;
        const slots = (action.type === "Activate" && "rule" in action) || (action.type === "Boost" && action.rule !== undefined) || (action.type === "Shift" && action.rule !== undefined);
        const visible = action.type === "Ink" ? hiddenIdentities({ ...action, card: undefined }, sees) : hiddenIdentities(action, sees);
        return slots || visible.length ? { type: "Action" } : { type: "Action", action };
    }
    const answer = step.answer;
    if (answer.type === "Choose Trigger" || answer.type === "Choose Replacement") return { type: "Decision" };
    return hiddenIdentities(answer, sees).length ? { type: "Decision" } : { type: "Decision", answer };
}
