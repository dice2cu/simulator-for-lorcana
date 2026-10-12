import type { CardState, GameState, InkCard, PlayerPosition, UnderCard } from "./game-state";
import type { CardIdentifier, PlayerNumber } from "./identity";

/**
 * GameState with private information removed for one player. The caller knows
 * whose view this is. It adds no computed stats, execution state or bot memory.
 * Shared fields keep their GameState meaning. The projector must filter private
 * information inside modifiers too, including captured card references.
 */
export interface GameStateView extends Omit<GameState, "players"> {
    players: Partial<Record<PlayerNumber, PlayerPositionView>>;
}

export interface PlayerPositionView extends Omit<PlayerPosition, "deck" | "hand" | "play" | "inkwell" | "removed"> {
    deck: CardZonePlayerView;
    hand: CardZonePlayerView;
    play: CardStatePlayerView[];
    inkwell: InkCardPlayerView[];
    removed?: CardZonePlayerView;
}

/**
 * A count when no identities are visible. Otherwise retain the card array and
 * replace hidden entries with null. Deck order is still top first, but only
 * explicitly visible positions contain identities. An array slot is not a
 * persistent hidden-card identifier. Unordered zones use a canonical order based
 * only on visible information, never their authoritative array positions.
 * A fully visible hand is an ordinary array.
 */
export type CardZonePlayerView = number | readonly (CardIdentifier | null)[];

/** Retains damage, exertion, drying, location and visible modifiers without adding derived values. */
export interface CardStatePlayerView extends Omit<CardState, "under"> {
    under?: UnderCardPlayerView[];
}

export interface UnderCardPlayerView extends Omit<UnderCard, "card"> {
    /** Omitted when this player cannot see the card. faceDown keeps its original meaning. */
    card?: CardIdentifier;
}

export interface InkCardPlayerView extends Omit<InkCard, "card"> {
    /**
     * Normally omitted. Pongo - Dear Old Dad lets its player look at the inkwell
     * while resolving its ability. Remembered identities belong in memory instead.
     */
    card?: CardIdentifier;
}
