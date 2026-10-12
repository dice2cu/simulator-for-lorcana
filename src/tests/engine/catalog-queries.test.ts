import { expect, it } from 'vitest';
import { cards, getCard } from '../../cards';
import { getLegalActions } from '../../engine/actions';
import { Rules } from '../../engine/rules';
import { startTurn } from '../../engine/engine';
import type { GameState, PlayerPosition } from '../../model/game-state';
import type { CharacterCard } from '../../model/card';

const neutral: CharacterCard = { fullName: 'Catalog Query Fixture', names: ['Catalog Query Fixture'], type: 'Character',
    colors: ['Amber'], subtypes: [], cost: 1, inkwell: true, strength: 1, willpower: 20, lore: 1 };
const lookup = (name: string) => name === neutral.fullName ? neutral : getCard(name);

it('can query a board containing every catalog card without rejecting its printed rules', () => {
    const failures: string[] = [];
    for (const definition of new Map(cards.map(card => [card.fullName, card])).values()) {
        const card = { fullName: definition.fullName, i: 1 };
        const player = (offset: number): PlayerPosition => ({ lore: 5, turnsTaken: 1, hand: [], discard: [],
            deck: Array.from({ length: 3 }, (_, i) => ({ fullName: neutral.fullName, i: offset + i })),
            inkwell: Array.from({ length: 12 }, (_, i) => ({ card: { fullName: neutral.fullName, i: offset + i + 10 }, exerted: false })),
            play: [{ card: { fullName: neutral.fullName, i: offset + 30 }, exerted: true }] });
        const p1 = player(100), p2 = player(200);
        p1.play.push({ card });
        const state: GameState = { turn: { number: 3, player: 1 }, players: { 1: p1, 2: p2 } };
        try {
            const rules = new Rules(state, lookup);
            rules.modifiers(card);
            rules.characteristic(card, 'Strength');
            rules.characteristic(card, 'Willpower');
            rules.characteristic(card, 'Lore');
            if (getLegalActions(state, { card: lookup }).length) startTurn(state, { card: lookup });
        } catch (error) {
            failures.push(`${definition.fullName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    expect(failures).toEqual([]);
});
