import data from './data/cards.json';
import type { Card } from './model/card';
/** Source ability fields used by the parser, not the engine's ability model. */
export interface PrintedAbility {
    readonly type: string;
    readonly fullText: string;
    readonly name?: string;
    readonly effect?: string;
    readonly keyword?: string;
    readonly keywordValue?: string;
    readonly keywordValueNumber?: number;
    readonly reminderText?: string;
    readonly costs?: readonly string[];
    readonly costsText?: string;
}

/** Parser input in the source catalog's format, not the engine's card model. */
export interface CatalogCard {
    readonly id: number;
    readonly setCode: string;
    readonly fullName: string;
    readonly fullText: string;
    readonly name: string;
    readonly names?: readonly string[];
    readonly version?: string;
    readonly type: string;
    readonly color: string;
    readonly cost: number;
    readonly inkwell: boolean;
    readonly strength?: number;
    readonly willpower?: number;
    readonly lore?: number;
    readonly moveCost?: number;
    readonly subtypes?: readonly string[];
    readonly abilities?: readonly PrintedAbility[];
    readonly effects?: readonly string[];
}

function freeze(value: unknown): void {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
}

freeze(data);

/** All catalog printings. Importing this module embeds the data without fetching it. */
// JSON imports widen literals and tuples. The embedding script parses and validates this shape.
export const cards: readonly Card[] = data.cards as unknown as readonly Card[];

const byName = new Map<string, Card>();
for (const card of cards) {
    if (!byName.has(card.fullName)) byName.set(card.fullName, card);
}

/** Returns the first catalog printing with this exact name. */
export function getCard(name: string): Card | undefined {
    return byName.get(name);
}
