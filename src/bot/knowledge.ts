import type { DeckKnowledge, PlayerKnowledge } from "../model/bot";
import type { CardBase } from "../model/card";
import type { CardZonePlayerView, GameStateView } from "../model/game-state-view";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { DeckListEntry, PlayerCardLocation, PlayerObservation, PlayerUpdate } from "../model/player-interaction";
import { getCard } from "../cards";

type Bounds = { min: number; max: number };

/** Mutable working copy of PlayerKnowledge, exposed read-only through BotMemory. */
interface Tracker {
    deck?: DeckKnowledge;
    colors: Set<CardBase["colors"][number]>;
    seen: Map<string, CardIdentifier>;
    hand: Map<string, CardIdentifier>;
    inkwell: Map<string, CardIdentifier>;
    deckTop: CardIdentifier[];
    deckBottom: CardIdentifier[];
    remaining: Map<string, Bounds>;
    unlisted: Bounds;
    /** Deck size used to start composition bounds, set from the first view. */
    started: boolean;
}

const key = (card: CardIdentifier): string => `${card.fullName}#${card.i}`;

/**
 * Derived per-game knowledge for every seat. It keeps facts separate from
 * scouting beliefs and never stores an observation log.
 */
export class Knowledge {
    private readonly players = new Map<PlayerNumber, Tracker>();

    constructor(
        readonly self: PlayerNumber,
        own: readonly DeckListEntry[],
        opponents: Readonly<Partial<Record<PlayerNumber, DeckKnowledge>>> = {},
    ) {
        this.tracker(self).deck = { type: "Confirmed", cards: own };
        for (const [seat, deck] of Object.entries(opponents)) if (deck) this.tracker(Number(seat) as PlayerNumber).deck = deck;
    }

    private tracker(player: PlayerNumber): Tracker {
        let tracker = this.players.get(player);
        if (!tracker) {
            tracker = {
                colors: new Set(),
                seen: new Map(),
                hand: new Map(),
                inkwell: new Map(),
                deckTop: [],
                deckBottom: [],
                remaining: new Map(),
                unlisted: { min: 0, max: 0 },
                started: false,
            };
            this.players.set(player, tracker);
        }
        return tracker;
    }

    update(update: PlayerUpdate): void {
        for (const seat of Object.keys(update.state.players)) this.start(Number(seat) as PlayerNumber, update.state);
        for (const observation of update.observations) this.apply(observation);
        this.reconcile(update.state);
    }

    /** Composition bounds begin from a list when one is known, otherwise from an unlisted bucket. */
    private start(player: PlayerNumber, state: GameStateView): void {
        const tracker = this.tracker(player);
        if (tracker.started) return;
        const position = state.players[player];
        if (!position) return;
        tracker.started = true;
        const size = count(position.deck) + count(position.hand);
        const list = tracker.deck;
        if (!list) {
            tracker.unlisted = { min: size, max: size };
            return;
        }
        for (const entry of list.cards) {
            const bounds = tracker.remaining.get(entry.fullName) ?? { min: 0, max: 0 };
            bounds.max += entry.count;
            if (list.type === "Confirmed") bounds.min += entry.count;
            tracker.remaining.set(entry.fullName, bounds);
        }
        const listed = list.cards.reduce((sum, entry) => sum + entry.count, 0);
        tracker.unlisted = list.type === "Confirmed" ? { min: 0, max: Math.max(0, size - listed) } : { min: Math.max(0, size - listed), max: size };
    }

    private see(player: PlayerNumber, card: CardIdentifier): void {
        const tracker = this.tracker(player);
        if (tracker.seen.has(key(card))) return;
        tracker.seen.set(key(card), card);
        for (const color of getCard(card.fullName)?.colors ?? []) tracker.colors.add(color);
        if (!tracker.remaining.has(card.fullName) && tracker.deck?.type !== "Confirmed") {
            const copies = [...tracker.seen.values()].filter((other) => other.fullName === card.fullName).length;
            const max = Math.max(0, Math.min(tracker.unlisted.max, 4 - copies));
            tracker.remaining.set(card.fullName, { min: 0, max });
            tracker.unlisted = { min: Math.max(0, tracker.unlisted.min - max), max: tracker.unlisted.max };
        }
    }

    private apply(observation: PlayerObservation): void {
        switch (observation.type) {
            case "Action": {
                const action = observation.action;
                for (const card of actionCards(action)) this.see(action.player, card);
                return;
            }
            case "Look":
            case "Reveal": {
                const { location, cards } = observation;
                for (const card of cards) this.see(location.player, card);
                const tracker = this.tracker(location.player);
                if (location.zone === "Hand" && location.player !== this.self) for (const card of cards) tracker.hand.set(key(card), card);
                if (location.zone === "Deck" && location.position) this.place(tracker, location.position, cards);
                return;
            }
            case "Move Cards":
                this.move(observation);
                return;
            case "Shuffle": {
                const tracker = this.tracker(observation.player);
                tracker.deckTop = [];
                tracker.deckBottom = [];
                return;
            }
        }
    }

    /** Records a known deck-end group. Groups are top first. */
    private place(tracker: Tracker, position: NonNullable<PlayerCardLocation["position"]>, cards: readonly CardIdentifier[]): void {
        if (position.from === "Top" && position.index === 0) tracker.deckTop = merge([...cards], tracker.deckTop.slice(cards.length));
        else if (position.from === "Bottom" && position.index === cards.length - 1) {
            const kept = tracker.deckBottom.slice(0, Math.max(0, tracker.deckBottom.length - cards.length));
            const seen = new Set(cards.map(key));
            tracker.deckBottom = [...kept.filter((card) => !seen.has(key(card))), ...cards];
        }
    }

    private move(observation: Extract<PlayerObservation, { type: "Move Cards" }>): void {
        const { from, to } = observation;
        const source = this.tracker(from.player),
            destination = this.tracker(to.player);
        const cards = observation.cards.map((card, index) => card ?? (from.zone === "Deck" ? known(source, from.position, index, observation.cards.length) : null));
        for (const card of cards) if (card) this.see(from.zone === "Play" || from.zone === "Under" ? to.player : from.player, card);
        if (from.zone === "Deck") {
            if (from.position?.from === "Top") source.deckTop = source.deckTop.slice(cards.length);
            else if (from.position?.from === "Bottom") source.deckBottom = source.deckBottom.slice(0, Math.max(0, source.deckBottom.length - cards.length));
            else {
                const gone = new Set(cards.flatMap((card) => (card ? [key(card)] : [])));
                source.deckTop = source.deckTop.filter((card) => !gone.has(key(card)));
                source.deckBottom = source.deckBottom.filter((card) => !gone.has(key(card)));
                if (cards.some((card) => !card)) {
                    source.deckTop = [];
                    source.deckBottom = [];
                }
            }
            for (const card of cards) this.leaveDeck(source, card);
        }
        if (from.zone === "Hand") for (const card of cards) if (card) source.hand.delete(key(card));
        if (from.zone === "Inkwell") for (const card of cards) if (card) source.inkwell.delete(key(card));
        if (to.zone === "Hand" && to.player !== this.self) for (const card of cards) if (card) destination.hand.set(key(card), card);
        if (to.zone === "Inkwell") for (const card of cards) if (card) destination.inkwell.set(key(card), card);
        if (to.zone === "Deck") {
            for (const card of cards) this.enterDeck(destination, card);
            const visible = cards.every((card) => card !== null);
            if (to.position?.from === "Top" && to.position.index === 0) destination.deckTop = visible ? [...(cards as CardIdentifier[]), ...destination.deckTop] : [];
            else if (to.position?.from === "Bottom" && to.position.index === cards.length - 1)
                destination.deckBottom = visible ? [...destination.deckBottom, ...(cards as CardIdentifier[])] : [];
            else {
                destination.deckTop = [];
                destination.deckBottom = [];
            }
        }
    }

    /** A known card narrows its own name. An unknown card could have been any remaining name. */
    private leaveDeck(tracker: Tracker, card: CardIdentifier | null): void {
        if (card) {
            const bounds = tracker.remaining.get(card.fullName);
            if (bounds) {
                bounds.min = Math.max(0, bounds.min - 1);
                bounds.max = Math.max(0, bounds.max - 1);
            } else tracker.unlisted = { min: Math.max(0, tracker.unlisted.min - 1), max: Math.max(0, tracker.unlisted.max - 1) };
            return;
        }
        for (const bounds of tracker.remaining.values()) bounds.min = Math.max(0, bounds.min - 1);
        tracker.unlisted = { min: Math.max(0, tracker.unlisted.min - 1), max: tracker.unlisted.max };
    }

    private enterDeck(tracker: Tracker, card: CardIdentifier | null): void {
        if (card) {
            const bounds = tracker.remaining.get(card.fullName);
            if (bounds) {
                bounds.min++;
                bounds.max++;
            } else tracker.unlisted = { min: tracker.unlisted.min + 1, max: tracker.unlisted.max + 1 };
            return;
        }
        for (const bounds of tracker.remaining.values()) bounds.max++;
        tracker.unlisted = { min: tracker.unlisted.min, max: tracker.unlisted.max + 1 };
    }

    /** Aligns facts with the current view: own hand, visible cards and the deck count. */
    private reconcile(state: GameStateView): void {
        for (const [seat, position] of Object.entries(state.players)) {
            if (!position) continue;
            const player = Number(seat) as PlayerNumber,
                tracker = this.tracker(player);
            for (const card of position.play) {
                this.see(card.owner ?? player, card.card);
                for (const under of card.under ?? []) if (under.card) this.see(under.owner ?? player, under.card);
            }
            for (const card of position.discard) this.see(player, card);
            const hand = typeof position.hand === "number" ? [] : position.hand.filter((card): card is CardIdentifier => card !== null);
            for (const card of hand) this.see(player, card);
            if (player === this.self) tracker.hand = new Map(hand.map((card) => [key(card), card]));
            else {
                const size = count(position.hand);
                if (tracker.hand.size > size) tracker.hand = new Map([...tracker.hand].slice(tracker.hand.size - size));
            }
            const visibleDeck = typeof position.deck === "number" ? [] : position.deck;
            visibleDeck.forEach((card, index) => {
                if (!card) return;
                this.see(player, card);
                if (index === tracker.deckTop.length && tracker.deckTop.every((known, i) => visibleDeck[i] && key(visibleDeck[i]!) === key(known)))
                    tracker.deckTop.push(card);
            });
            const size = count(position.deck);
            for (const bounds of tracker.remaining.values()) bounds.max = Math.min(bounds.max, size);
            tracker.unlisted.max = Math.min(tracker.unlisted.max, size);
            const named = [...tracker.remaining.values()];
            const capacity = named.reduce((sum, bounds) => sum + bounds.max, 0) + tracker.unlisted.max;
            for (const bounds of [...named, tracker.unlisted]) bounds.min = Math.max(bounds.min, size - (capacity - bounds.max));
        }
    }

    snapshot(player: PlayerNumber): PlayerKnowledge {
        const tracker = this.tracker(player);
        return {
            ...(tracker.deck ? { deck: tracker.deck } : {}),
            observedColors: [...tracker.colors],
            seenCards: [...tracker.seen.values()],
            hand: [...tracker.hand.values()],
            inkwell: [...tracker.inkwell.values()],
            deckTop: [...tracker.deckTop],
            deckBottom: [...tracker.deckBottom],
            remainingDeck: [...tracker.remaining].map(([fullName, bounds]) => ({ fullName, min: bounds.min, max: bounds.max })),
            unlistedDeck: { ...tracker.unlisted },
        };
    }

    all(): Partial<Record<PlayerNumber, PlayerKnowledge>> {
        const result: Partial<Record<PlayerNumber, PlayerKnowledge>> = {};
        for (const player of this.players.keys()) result[player] = this.snapshot(player);
        return result;
    }
}

function count(zone: CardZonePlayerView): number {
    return typeof zone === "number" ? zone : zone.length;
}

/** Keeps the longer known prefix without duplicating cards. */
function merge(first: CardIdentifier[], rest: CardIdentifier[]): CardIdentifier[] {
    const seen = new Set(first.map(key));
    return [...first, ...rest.filter((card) => !seen.has(key(card)))];
}

/** A hidden card leaving a known deck end is the card remembered there. */
function known(tracker: Tracker, position: PlayerCardLocation["position"], index: number, length: number): CardIdentifier | null {
    if (!position || position.index !== (position.from === "Top" ? 0 : length - 1)) return null;
    if (position.from === "Top") return tracker.deckTop[index] ?? null;
    const offset = tracker.deckBottom.length - length + index;
    return offset >= 0 ? (tracker.deckBottom[offset] ?? null) : null;
}

function actionCards(action: Extract<PlayerObservation, { type: "Action" }>["action"]): CardIdentifier[] {
    switch (action.type) {
        case "Ink":
        case "Play":
        case "Quest":
        case "Activate":
        case "Boost":
            return [action.card];
        case "Shift":
            return [action.card];
        case "Move":
            return [action.card];
        case "Sing":
            return [action.song, ...action.singers];
        case "Challenge":
            return [action.attacker];
        case "Alter Hand":
            return [...action.cards];
        case "End Turn":
            return [];
    }
}
