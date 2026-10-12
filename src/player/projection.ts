import type { CardState, GameState, InkCard, PlayerPosition, UnderCard } from "../model/game-state";
import type {
    CardStatePlayerView,
    CardZonePlayerView,
    GameStateView,
    InkCardPlayerView,
    PlayerPositionView,
    UnderCardPlayerView,
} from "../model/game-state-view";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import { cardKey, isPublic, placements, samePlacement, type Placement } from "./locations";
import type { Rules } from "../engine/rules";
import type { PlayerUpdate } from "../model/player-interaction";

/** Only public cards in play are queried. Hidden zones never enter this display data. */
export function projectCharacteristics(rules: Rules): NonNullable<PlayerUpdate["characteristics"]> {
    return Object.values(rules.position.players).flatMap(
        (player) =>
            player?.play.map(({ card }) => ({
                card,
                strength: rules.characteristic(card, "Strength"),
                willpower: rules.characteristic(card, "Willpower"),
                lore: rules.characteristic(card, "Lore"),
            })) ?? [],
    );
}

/**
 * A card seen through a Look or Reveal. It stays visible only while it remains
 * where it was seen. The runner forgets glimpses at shuffles and new intentions.
 * Omitted players means a public reveal.
 */
export interface Glimpse {
    card: CardIdentifier;
    players?: readonly PlayerNumber[];
    place: Placement;
}

/** Whether a viewer can currently identify a physical card. */
export type Sight = (card: CardIdentifier) => boolean;

export function sight(state: GameState, viewer: PlayerNumber, glimpses: readonly Glimpse[] = [], revealed: readonly CardIdentifier[] = []): Sight {
    const where = placements(state);
    const extra = new Set<string>();
    for (const card of revealed) extra.add(cardKey(card));
    for (const glimpse of glimpses) {
        if (glimpse.players && !glimpse.players.includes(viewer)) continue;
        if (samePlacement(where.get(cardKey(glimpse.card)), glimpse.place)) extra.add(cardKey(glimpse.card));
    }
    const cache = new Map<string, boolean>();
    return (card) => {
        const key = cardKey(card);
        let value = cache.get(key);
        if (value === undefined) {
            const place = where.get(key);
            value = !!place && (isPublic(place) || (place.zone === "Hand" && place.player === viewer) || extra.has(key));
            cache.set(key, value);
        }
        return value;
    };
}

/** Removes private identities and positions while keeping GameState's structure. */
export function projectState(state: GameState, sees: Sight): GameStateView {
    const players: GameStateView["players"] = {};
    for (const [seat, position] of Object.entries(state.players)) if (position) players[Number(seat) as PlayerNumber] = projectPlayer(position, sees);
    return { turn: state.turn, players };
}

function projectPlayer(position: PlayerPosition, sees: Sight): PlayerPositionView {
    const { deck, hand, play, inkwell, removed, modifiers, ...rest } = position;
    const view: PlayerPositionView = {
        ...rest,
        deck: ordered(deck, sees),
        hand: unordered(hand, sees),
        play: play.map((state) => projectCard(state, sees)),
        inkwell: projectInk(inkwell, sees),
    };
    const kept = modifiers?.filter((modifier) => disclosed(modifier, sees));
    if (kept?.length) view.modifiers = kept;
    else delete view.modifiers;
    if (removed) view.removed = removed;
    return view;
}

/** Decks keep meaningful positions. Hidden entries become null. */
function ordered(cards: readonly CardIdentifier[], sees: Sight): CardZonePlayerView {
    if (!cards.some(sees)) return cards.length;
    return cards.map((card) => (sees(card) ? card : null));
}

/** Canonical order: visible cards by identity, then hidden entries. Never authoritative positions. */
function unordered(cards: readonly CardIdentifier[], sees: Sight): CardZonePlayerView {
    const visible = cards.filter(sees).sort(compareCards);
    if (!visible.length) return cards.length;
    return [...visible, ...Array<null>(cards.length - visible.length).fill(null)];
}

export function compareCards(a: CardIdentifier, b: CardIdentifier): number {
    return a.fullName < b.fullName ? -1 : a.fullName > b.fullName ? 1 : a.i - b.i;
}

function projectCard(state: CardState, sees: Sight): CardStatePlayerView {
    const { under, modifiers, ...rest } = state;
    const view: CardStatePlayerView = { ...rest };
    if (under) view.under = under.map((entry) => projectUnder(entry, sees));
    const kept = modifiers?.filter((modifier) => disclosed(modifier, sees));
    if (kept?.length) view.modifiers = kept;
    return view;
}

function projectUnder(entry: UnderCard, sees: Sight): UnderCardPlayerView {
    const { card, ...rest } = entry;
    return sees(card) ? { ...rest, card } : rest;
}

/** Ready ink first, then exerted. Identities only when currently visible. */
function projectInk(inkwell: readonly InkCard[], sees: Sight): InkCardPlayerView[] {
    return inkwell
        .map((ink): InkCardPlayerView => (sees(ink.card) ? { card: ink.card, exerted: ink.exerted } : { exerted: ink.exerted }))
        .sort((a, b) => Number(a.exerted) - Number(b.exerted) || (a.card ? (b.card ? compareCards(a.card, b.card) : -1) : b.card ? 1 : 0));
}

/** A modifier is withheld entirely if it captured an identity the viewer cannot see. */
function disclosed(value: unknown, sees: Sight): boolean {
    if (value === null || typeof value !== "object") return true;
    if (Array.isArray(value)) return value.every((entry) => disclosed(entry, sees));
    const record = value as Record<string, unknown>;
    if (typeof record.fullName === "string" && typeof record.i === "number" && !sees(record as unknown as CardIdentifier)) return false;
    return Object.values(record).every((entry) => disclosed(entry, sees));
}
