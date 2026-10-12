import { expect, expectTypeOf, it } from 'vitest';
import type { EventPattern } from '../../model/ability';
import type { GameState } from '../../model/game-state';
import type { CostPayment, DecisionAnswer, DecisionPlayer, Turn, TurnEvent, PlayerAction } from '../../model/turn';

it('has a concrete event for every event name understood by the ability model', () => {
    type PatternEvent = Extract<EventPattern, { event: string }>['event'];
    expectTypeOf<Exclude<PatternEvent, TurnEvent['event']>>().toEqualTypeOf<never>();
});

it('requires the information needed for exceptional payment and discard cases', () => {
    expectTypeOf<{ type: 'Ink'; amount: number }>().not.toExtend<CostPayment>();
    expectTypeOf<{ type: 'Pay Cost'; pay: true }>().not.toExtend<DecisionAnswer>();
    expectTypeOf<{ type: 'Choose Trigger'; option: number }>().not.toExtend<DecisionAnswer>();
    expectTypeOf<{ event: 'Discard'; player: 1; card: { fullName: string; i: number } }>().not.toExtend<TurnEvent>();
    expectTypeOf<{ together: [] }>().not.toExtend<DecisionPlayer>();
    expectTypeOf<{ type: 'Concede'; player: 1 }>().not.toExtend<PlayerAction>();
});

it('retains precise ink choices, lore contributions, ordering and source references without execution data', () => {
    const card = { fullName: 'Hercules - Manipulated Hero', i: 5 };
    const ink = { fullName: 'Dinglehopper', i: 19 };
    const turn: Turn = { steps: [
        { type: 'Decision', answer: { type: 'Choose Trigger', trigger: { rule: 3, event: 8 } } },
        { type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [
            { type: 'Lose Lore', player: 2, amount: 1 }, { type: 'Lose Lore', player: 3, amount: 2 },
        ] } },
        { type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [
            { type: 'Ink', player: 1, cards: [ink], inkDrops: 1 },
            { type: 'Move Card', player: 1, cards: [card, ink], to: 'Deck Bottom' },
        ] } },
        { type: 'Action', action: { type: 'End Turn', player: 1 } },
    ] };
    expect(JSON.parse(JSON.stringify(turn))).toEqual(turn);
    expect(Object.keys(turn)).toEqual(['steps']);
});

it('keeps ownership only where control can make the containing player ambiguous', () => {
    const state: GameState = { turn: { number: 5, player: 2 }, players: {
        2: { lore: 3, turnsTaken: 2, deck: [], hand: [], discard: [], inkwell: [], inkDrops: 2,
            play: [{ card: { fullName: 'Mickey Mouse - Brave Little Tailor', i: 1 }, owner: 1,
                under: [{ card: { fullName: 'Mickey Mouse - True Friend', i: 2 }, owner: 1, faceDown: false }] }],
        },
    } };
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(state.players[2]?.play[0]?.owner).toBe(1);
    expect(state.players[2]?.inkDrops).toBe(2);
});
