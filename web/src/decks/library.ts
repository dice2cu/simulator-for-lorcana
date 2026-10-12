import { getCard, parseDeckList, validateDeck, type Card, type DeckListEntry } from "../simulator";

/** A deck the page can use: a reference deck from the build, or one saved in this browser. */
export interface DeckEntry {
    readonly id: string;
    readonly name: string;
    readonly text: string;
    readonly reference: boolean;
}

export interface DeckCheck {
    readonly cards: DeckListEntry[];
    readonly size: number;
    /** Unreadable lines, unknown cards and construction errors. A deck with problems cannot be used. */
    readonly problems: string[];
}

/** Everything wrong with a deck list, in the order a player would fix it. */
export function checkDeck(text: string): DeckCheck {
    const parsed = parseDeckList(text);
    const size = parsed.cards.reduce((sum, entry) => sum + entry.count, 0);
    const physical = deckCards(parsed.cards).flatMap(({ card, count }) => Array<Card>(count).fill(card));
    const problems = [
        ...parsed.problems,
        ...validateDeck(physical).errors.map((error) => (error.startsWith("A constructed deck requires") ? `${error} (has ${size})` : error)),
    ];
    return { cards: parsed.cards, size, problems };
}

/** Derived once when the deck list changes, then shared by the tabs. */
export interface DeckSummary extends DeckEntry {
    readonly check: DeckCheck;
    readonly inks: readonly string[];
}

export function summarizeDeck(deck: DeckEntry): DeckSummary {
    const check = checkDeck(deck.text);
    return { ...deck, check, inks: deckInks(check.cards) };
}

/** Deck entries with their cards, for summaries and lists. */
export function deckCards(entries: readonly DeckListEntry[]): { card: Card; count: number }[] {
    return entries.map((entry) => {
        const card = getCard(entry.fullName);
        if (!card) throw new Error(`Unknown card: ${entry.fullName}`);
        return { card, count: entry.count };
    });
}

/** The inks a deck uses, in the printed order of colors. */
export function deckInks(entries: readonly DeckListEntry[]): string[] {
    const order = ["Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", "Steel"] as const;
    const used = new Set(deckCards(entries).flatMap(({ card }) => card.colors));
    return order.filter((ink) => used.has(ink));
}
