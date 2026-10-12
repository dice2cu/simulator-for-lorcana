import { expect, expectTypeOf, it } from 'vitest';
import type { Card, CharacterCard, ActionCard, ItemCard, LocationCard } from '../../model/card';
import type { Ability } from '../../model/ability';
import { getCard } from '../fixtures/catalog';
import { parseCard } from '../../parser/index';

it('stores a song with printed text alongside parsed instructions', () => {
    const source = getCard('Friends on the Other Side');
    if (!source) throw new Error('Missing song fixture');
    const parsed = parseCard(source);
    if (!parsed.supported || parsed.rules.type !== 'Action') throw new Error('Song parsing failed');
    const card: Card = {
        fullName: 'Friends on the Other Side', names: ['Friends on the Other Side'],
        fullText: source.fullText,
        type: 'Action', colors: ['Amethyst'], cost: 3, inkwell: true,
        subtypes: ['Song'], effect: parsed.rules.effect, playRules: parsed.rules.playRules,
    };
    expect(card.effect).toEqual({ type: 'Draw', player: 'You', amount: 2 });
    expect(card.playRules).toContainEqual({ type: 'Sing', cost: 3 });
    expect(card).not.toHaveProperty('setCode');
    expect(card.fullText).toBe(source.fullText);
    expect(card.fullText).toContain('Draw 2 cards');
    expect(card).not.toHaveProperty('id');
    expect(card.names).toEqual(['Friends on the Other Side']);
    expect(card).not.toHaveProperty('name');
});

it('stores character stats and dual inks in the same card model', () => {
    const card: Card = { fullName: 'Example', names: ['Example'], type: 'Character', colors: ['Amber', 'Ruby'],
        cost: 2, inkwell: true, subtypes: ['Hero'], abilities: [],
        strength: 2, willpower: 3, lore: 1 };
    expect(card.colors).toEqual(['Amber', 'Ruby']);
    expect(card.strength).toBe(2);
    expect(card).not.toHaveProperty('effect');
    expect(card).not.toHaveProperty('moveCost');
});

it('stores individual duo names separately from the full card name', () => {
    const card: CharacterCard = {
        fullName: 'Mickey Mouse & Minnie Mouse - Adventuring Duo',
        names: ['Mickey Mouse', 'Minnie Mouse'], type: 'Character', colors: ['Amber'],
        cost: 1, inkwell: true, subtypes: [], abilities: [],
        strength: 1, willpower: 1, lore: 1,
    };
    expect(card.names).toEqual(['Mickey Mouse', 'Minnie Mouse']);
    expect(card.fullName).toBe('Mickey Mouse & Minnie Mouse - Adventuring Duo');
});

it('distinguishes the four card types and their applicable fields', () => {
    expectTypeOf<Extract<Card, { type: 'Character' }>>().toEqualTypeOf<CharacterCard>();
    expectTypeOf<Extract<Card, { type: 'Action' }>>().toEqualTypeOf<ActionCard>();
    expectTypeOf<Extract<Card, { type: 'Item' }>>().toEqualTypeOf<ItemCard>();
    expectTypeOf<Extract<Card, { type: 'Location' }>>().toEqualTypeOf<LocationCard>();
    expectTypeOf<CharacterCard['strength']>().toEqualTypeOf<number>();
    expectTypeOf<LocationCard['moveCost']>().toEqualTypeOf<number>();
    expectTypeOf<ActionCard['abilities']>().toEqualTypeOf<readonly Ability[] | undefined>();
    expectTypeOf<ItemCard>().not.toHaveProperty('strength');
    expectTypeOf<CharacterCard>().not.toHaveProperty('effect');
    expectTypeOf<LocationCard>().not.toHaveProperty('strength');
});
