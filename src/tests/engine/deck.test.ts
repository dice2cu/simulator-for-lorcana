import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDeckList, validateDeck } from '../../deck';
import type { Card } from '../../model/card';
import { referenceDecks } from '../fixtures/reference-decks';

function deck(): Card[] {
    return Array.from({ length: 60 }, (_, index) => ({
        fullName: 'Card ' + index, names: ['Card ' + index], type: 'Item',
        colors: ['Amber'], subtypes: [], cost: 1, inkwell: true,
    }));
}

describe('constructed deck validation', () => {
    it('requires at least sixty cards', () => {
        expect(validateDeck(deck()).valid).toBe(true);
        expect(validateDeck(deck().slice(1)).valid).toBe(false);
    });
    it('counts copies by full name, not by object identity or printing', () => {
        const cards = deck();
        cards.splice(0, 5, ...Array.from({ length: 5 }, () => ({ ...cards[0] })));
        expect(validateDeck(cards).errors).toEqual(['Card 0 exceeds its copy limit of 4']);
        cards[4] = { ...cards[4], fullName: 'Different version' };
        expect(validateDeck(cards).valid).toBe(true);
    });
    it('counts both inks on a dual-ink card', () => {
        const cards = deck();
        cards[0] = { ...cards[0], colors: ['Amber', 'Ruby'] };
        expect(validateDeck(cards).valid).toBe(true);
        cards[1] = { ...cards[1], colors: ['Steel'] };
        expect(validateDeck(cards).valid).toBe(false);
    });
    it('does not apply an other-card ink permission to its source', () => {
        const cards = deck();
        cards[0] = { ...cards[0], colors: ['Amethyst', 'Sapphire'], subtypes: ['Hunny'],
            abilities: [{ type: 'Deck Construction', anyInk: { classification: 'Hunny' } }] };
        expect(validateDeck(cards).valid).toBe(false);
    });
});

describe('deck list text', () => {
    it('reads counts, an optional x, comments and blank lines', () => {
        const { cards, problems } = parseDeckList('# Dogs\r\n4 Lady - Family Dog\n\n// partner\n3x Tramp - Enterprising Dog\n');
        expect(problems).toEqual([]);
        expect(cards).toEqual([{ count: 4, fullName: 'Lady - Family Dog' }, { count: 3, fullName: 'Tramp - Enterprising Dog' }]);
    });

    it('names the line of unreadable entries and unknown cards', () => {
        const { cards, problems } = parseDeckList('4 Lady - Family Dog\nLady\n2 Lady - Unknown Version');
        expect(cards).toEqual([{ count: 4, fullName: 'Lady - Family Dog' }]);
        expect(problems).toEqual(['Line 2: cannot read "Lady"', 'Line 3: unknown card "Lady - Unknown Version"']);
    });
});

it('keeps the reference deck fixture identical to the reference-decks files', () => {
    const files = readdirSync('reference-decks').filter(name => name.endsWith('.deck')).sort();
    const fromFiles = files.map(name => {
        const { cards, problems } = parseDeckList(readFileSync(`reference-decks/${name}`, 'utf8'));
        expect(problems, name).toEqual([]);
        return { name: name.slice(0, -'.deck'.length), cards };
    });
    expect(fromFiles).toEqual(referenceDecks.map(({ name, cards }) => ({ name, cards })));
});
