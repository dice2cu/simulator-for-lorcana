import { describe, expect, expectTypeOf, it } from 'vitest';
import { cards, getCard } from '../cards';
import type { Card } from '../model/card';
import type { CardRules } from '../model/ability';
import { validateCardRules } from '../model/validate';
import { readCatalog, processCatalog, convertCard } from '../scripts/embed-cards.mjs';
import { cards as sourceCards, getCard as getSourceCard } from './fixtures/catalog';

describe('embedded card catalog', () => {
    it('normalizes printed properties and embeds parsed rules', () => {
        const song = getSourceCard('Friends on the Other Side');
        const character = sourceCards.find(card => card.type === 'Character');
        const location = sourceCards.find(card => card.type === 'Location');
        const item = sourceCards.find(card => card.type === 'Item');
        if (!song || !character || !location || !item) throw new Error('Missing conversion fixtures');
        const sources = [song, character, location, item];
        const result = processCatalog({ cards: sources });
        expect(result.cards).toHaveLength(sources.length);
        expect(result.cards[0]).toEqual({
            fullName: song.fullName, fullText: song.fullText, names: [song.name], colors: ['Amethyst'],
            cost: 3, inkwell: true, subtypes: ['Song'], type: 'Action',
            effect: { type: 'Draw', player: 'You', amount: 2 }, playRules: [{ type: 'Sing', cost: 3 }],
        });
        for (const card of result.cards) {
            for (const field of ['id', 'setCode', 'name', 'color', 'effects'])
                expect(card).not.toHaveProperty(field);
            if (card.type !== 'Action') expect(card.abilities).toHaveLength(sources[result.cards.indexOf(card)].abilities?.length ?? 0);
        }
        const vanilla = convertCard({ ...character, abilities: [], fullText: '' });
        expect(vanilla).not.toHaveProperty('abilities');
        expect(vanilla).not.toHaveProperty('playRules');
        expect(convertCard({ ...character, names: ['One', 'Two'], color: 'Amber-Steel' }).names).toEqual(['One', 'Two']);
        expect(convertCard({ ...character, color: 'Amber-Steel' }).colors).toEqual(['Amber', 'Steel']);
        expect(convertCard({ ...character, color: '' }).colors).toEqual([]);
        expect(convertCard({ ...song, fullText: '' })).not.toHaveProperty('fullText');
    });

    it('refuses to embed a card whose text cannot be parsed', () => {
        const song = getSourceCard('Friends on the Other Side');
        if (!song) throw new Error('Missing song fixture');
        const unknown = { ...song, effects: ['Not yet supported by the ability parser.'] };
        expect(() => convertCard(unknown)).toThrow('Effect 1: Unrecognized text');
        expect(() => processCatalog({ cards: [unknown] })).toThrow('failed conversion');
    });

    it('rejects invalid printed properties and missing required stats', () => {
        const character = sourceCards.find(card => card.type === 'Character');
        if (!character) throw new Error('Missing character fixture');
        expect(() => convertCard({ ...character, color: 'Purple' })).toThrow('Unknown ink color');
        expect(() => convertCard({ ...character, subtypes: ['Unknown Classification'] })).toThrow('Unknown subtype');
        expect(() => convertCard({ ...character, strength: undefined })).toThrow('Missing required stat');
        expect(() => convertCard({ ...character, type: 'Other' })).toThrow('Unknown card type');
        expect(() => processCatalog({ cards: [{ ...character, color: 'Purple' }] })).toThrow('failed conversion');
    });

    it('rejects malformed catalogs and duplicate printing IDs', () => {
        const first = sourceCards[0];
        if (!first) throw new Error('Fixture catalog is empty');
        expect(() => readCatalog({})).toThrow('cards array');
        expect(() => readCatalog({ cards: [first, first] })).toThrow('duplicate printing ID');
        expect(() => readCatalog({ cards: [{ ...first, fullText: 1 }] })).toThrow('fullText');
    });

    it('looks up names without making new copies', () => {
        const first = cards[0];
        if (!first) throw new Error('Embedded catalog is empty');
        expect(getCard(first.fullName)).toBe(first);
        expect(getCard('Not a Lorcana card')).toBeUndefined();
    });

    it('keeps reprints while choosing the first printing for name lookup', () => {
        const printings = cards.filter(card => card.fullName === 'Cinderella - Gentle and Kind');
        expect(printings.length).toBeGreaterThan(1);
        expect(getCard('Cinderella - Gentle and Kind')).toBe(printings[0]);
    });

    it('shares deeply immutable printed data', () => {
        const card = getCard('Friends on the Other Side');
        if (!card) throw new Error('Missing fixture');
        expectTypeOf(cards).toEqualTypeOf<readonly Card[]>();
        for (const value of [cards, card, card.names, card.colors, card.subtypes])
            expect(Object.isFrozen(value)).toBe(true);
        expect(Reflect.set(card, 'cost', 999)).toBe(false);
        expect(Reflect.set(card.colors, '0', 'Ruby')).toBe(false);
    });

    it('embeds only model properties and valid parsed rules for every printing', () => {
        for (const card of cards) {
            expect(card.names.length).toBeGreaterThan(0);
            expect(card.fullText).not.toBe('');
            expect(Array.isArray(card.colors)).toBe(true);
            for (const field of ['id', 'setCode', 'name', 'color', 'effects'])
                expect(card).not.toHaveProperty(field);
            if (card.type === 'Character') expect(card.strength).toBeTypeOf('number');
            if (card.type === 'Location') expect(card.moveCost).toBeTypeOf('number');
            if (card.type === 'Action') expect(card.effect).toBeDefined();
            if (card.abilities) expect(card.abilities.length).toBeGreaterThan(0);
            if (card.playRules) expect(card.playRules.length).toBeGreaterThan(0);
            const { fullName, fullText, names, colors, cost, inkwell, subtypes, strength, willpower, lore, moveCost, ...rules } =
                card as Card & Record<string, unknown>;
            const complete = card.type === 'Action' ? rules : { abilities: [], ...rules };
            expect(validateCardRules(complete as unknown as CardRules), fullName).toEqual([]);
        }
        const dualInk = cards.find(card => card.colors.length === 2);
        expect(dualInk).toBeDefined();
        expect(getCard('Friends on the Other Side')?.subtypes).toContain('Song');
    });
});
