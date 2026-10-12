import data from './catalog.json';
import type { CatalogCard } from '../../cards';

/** Representative source-catalog cards for text parser tests, not runtime data. */
export const cards: readonly CatalogCard[] = data.cards;

export function getCard(name: string): CatalogCard | undefined {
    return cards.find(card => card.fullName === name);
}
