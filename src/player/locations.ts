import type { GameState } from "../model/game-state";
import type { CardIdentifier, PlayerNumber } from "../model/identity";

/** Identity key for maps and sets. Both fields are needed by hand-written fixtures. */
export function cardKey(card: CardIdentifier): string {
    return `${card.fullName}#${card.i}`;
}

/**
 * Where a physical card currently is. index counts from the top for decks and
 * follows array order elsewhere. Removed cards are outside every game zone.
 */
export interface Placement {
    player: PlayerNumber;
    zone: "Play" | "Hand" | "Deck" | "Discard" | "Inkwell" | "Under" | "Removed";
    index: number;
    under?: CardIdentifier;
    faceDown?: boolean;
}

/** Every physical card in the position, indexed once per state. */
export function placements(state: GameState): Map<string, Placement> {
    const cached = cache.get(state);
    if (cached) return cached;
    const result = new Map<string, Placement>();
    for (const [seat, position] of Object.entries(state.players)) {
        if (!position) continue;
        const player = Number(seat) as PlayerNumber;
        position.deck.forEach((card, index) => result.set(cardKey(card), { player, zone: "Deck", index }));
        position.hand.forEach((card, index) => result.set(cardKey(card), { player, zone: "Hand", index }));
        position.discard.forEach((card, index) => result.set(cardKey(card), { player, zone: "Discard", index }));
        position.removed?.forEach((card, index) => result.set(cardKey(card), { player, zone: "Removed", index }));
        position.inkwell.forEach((ink, index) => result.set(cardKey(ink.card), { player, zone: "Inkwell", index }));
        position.play.forEach((state, index) => {
            result.set(cardKey(state.card), { player, zone: "Play", index });
            state.under?.forEach((under, position) =>
                result.set(cardKey(under.card), { player, zone: "Under", index: position, under: state.card, faceDown: under.faceDown }),
            );
        });
    }
    if (Object.isFrozen(state)) cache.set(state, result);
    return result;
}

const cache = new WeakMap<GameState, Map<string, Placement>>();

/** Physical identities that every player can see without any special effect. */
export function isPublic(place: Placement): boolean {
    return place.zone === "Play" || place.zone === "Discard" || place.zone === "Removed" || (place.zone === "Under" && !place.faceDown);
}

export function samePlacement(a: Placement | undefined, b: Placement | undefined): boolean {
    return !!a && !!b && a.player === b.player && a.zone === b.zone && (a.under === b.under || (!!a.under && !!b.under && cardKey(a.under) === cardKey(b.under)));
}
