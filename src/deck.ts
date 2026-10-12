import { getCard } from "./cards";
import type { Card } from "./model/card";
import type { CardFilter } from "./model/ability";
import type { DeckListEntry } from "./model/player-interaction";

/**
 * Reads a deck list: one "count name" line per entry, such as "4 Lady - Family Dog"
 * or "4x Lady - Family Dog". Blank lines and lines starting with # or // are ignored.
 * Problems name the line, and an unknown card's entry is left out of `cards`.
 */
export function parseDeckList(text: string): { cards: DeckListEntry[]; problems: string[] } {
    const cards: DeckListEntry[] = [];
    const problems: string[] = [];
    text.split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return;
        const match = /^(\d+)\s*x?\s+(.+)$/i.exec(trimmed);
        if (!match) return problems.push(`Line ${index + 1}: cannot read "${trimmed}"`);
        const fullName = match[2].trim();
        if (!getCard(fullName)) return problems.push(`Line ${index + 1}: unknown card "${fullName}"`);
        cards.push({ count: Number(match[1]), fullName });
    });
    return { cards, problems };
}

/** Only printed facts can be used by a deck-construction permission. */
function matches(card: Card, filter: CardFilter): boolean {
    const supported = ["cardType", "name", "classification", "inkType", "song", "inkable", "and", "or", "not"];
    if (Object.keys(filter).some((key) => !supported.includes(key))) throw new Error("Deck construction filter requires an unsupported printed fact");
    return (
        (!filter.cardType || card.type === filter.cardType) &&
        (!filter.name || card.names.includes(filter.name)) &&
        (!filter.classification || card.subtypes.includes(filter.classification)) &&
        (!filter.inkType || card.colors.includes(filter.inkType)) &&
        (filter.song === undefined || card.subtypes.includes("Song") === filter.song) &&
        (filter.inkable === undefined || card.inkwell === filter.inkable) &&
        (!filter.and || filter.and.every((filter) => matches(card, filter))) &&
        (!filter.or || filter.or.some((filter) => matches(card, filter))) &&
        (!filter.not || !matches(card, filter.not))
    );
}

/**
 * Checks constructed-deck size, inks and copy limits, including printed exceptions.
 * Tournament format restrictions and banned-card lists belong to the caller.
 * https://cdn.ravensburger.com/lorcana/tournament-rules
 */
export function validateDeck(cards: readonly Card[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (cards.length < 60) errors.push("A constructed deck requires at least 60 cards");
    const copies = new Map<string, { card: Card; count: number }>();
    for (const card of cards) {
        const entry = copies.get(card.fullName);
        if (entry) entry.count++;
        else copies.set(card.fullName, { card, count: 1 });
    }
    for (const { card, count } of copies.values()) {
        const rule = card.abilities?.find((ability) => ability.type === "Deck Construction" && "maxCopies" in ability);
        const limit = rule?.type === "Deck Construction" && "maxCopies" in rule ? rule.maxCopies : 4;
        if (limit !== "Unlimited" && count > limit) errors.push(card.fullName + " exceeds its copy limit of " + limit);
    }
    const permissions = [...copies.values()].flatMap(
        ({ card }) =>
            card.abilities?.flatMap((ability) =>
                ability.type === "Deck Construction" && "anyInk" in ability ? [{ source: card, filter: ability.anyInk }] : [],
            ) ?? [],
    );
    const inks = ["Amber", "Amethyst", "Emerald", "Ruby", "Sapphire", "Steel"] as const;
    const pairs = inks.flatMap((ink, index) => inks.slice(index + 1).map((other) => [ink, other]));
    const fits = pairs.some((pair) =>
        cards.every(
            (card) =>
                card.colors.every((ink) => pair.includes(ink)) ||
                permissions.some((permission) => permission.source.fullName !== card.fullName && matches(card, permission.filter)),
        ),
    );
    if (!fits) errors.push("A constructed deck cannot use more than two ink colors without a printed exception");
    return { valid: errors.length === 0, errors };
}
