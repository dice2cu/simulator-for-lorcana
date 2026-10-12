import type { Deck } from "../simulator";
import { checkDeck, type DeckEntry, type DeckSummary } from "../decks/library";

/**
 * Tested decks first, then the reference decks they play against. A reference
 * deck chosen for testing is tested, not also an opponent. Names are made unique
 * because results refer to decks by name.
 */
export function simulationDecks(tested: readonly (DeckEntry | DeckSummary)[], opponents: readonly (DeckEntry | DeckSummary)[]): Deck[] {
    const names = new Set<string>();
    const unique = (name: string): string => {
        let candidate = name;
        for (let copy = 2; names.has(candidate); copy++) candidate = `${name} (${copy})`;
        names.add(candidate);
        return candidate;
    };
    const chosen = new Set(tested.map((deck) => deck.id));
    const reference = opponents.filter((deck) => !chosen.has(deck.id));
    for (const deck of reference) names.add(deck.name);
    return [
        ...tested.map((deck) => ({ name: unique(deck.name), cards: ("check" in deck ? deck.check : checkDeck(deck.text)).cards, reference: false })),
        ...reference.map((deck) => ({ name: deck.name, cards: ("check" in deck ? deck.check : checkDeck(deck.text)).cards, reference: true })),
    ];
}

// Search runs on every core it gets, and hyperthreads add little, so default to half the reported threads.
export const defaultWorkers = (): number => Math.max(1, Math.floor((navigator.hardwareConcurrency || 2) / 2));
