import { expect, expectTypeOf, it } from 'vitest';
import type { Turn, TurnStep } from '../../model/turn';
import { turnDuringChoice } from '../../model/turn-examples';

it('uses the same input-only format for completed turns and unfinished prefixes', () => {
    const completed: Turn = { steps: [{ type: 'Action', action: { type: 'End Turn', player: 1 } }] };
    for (const turn of [completed, turnDuringChoice]) {
        expect(JSON.parse(JSON.stringify(turn))).toEqual(turn);
        expect(Object.keys(turn)).toEqual(['steps']);
    }
    expectTypeOf<'execution'>().not.toExtend<keyof Turn>();
});

it('keeps ordered actions, answers and randomness in one sequence', () => {
    const card = { fullName: 'Dinglehopper', i: 8 };
    const steps: TurnStep[] = [
        { type: 'Action', action: { type: 'Play', player: 1, card } },
        { type: 'Decision', answer: { type: 'Choose Cards', cards: [card] } },
        { type: 'Random', outcome: { type: 'Shuffle', cards: [card] } },
    ];
    const turn: Turn = { steps };
    expect(JSON.parse(JSON.stringify(turn))).toEqual(turn);
    expect(turn.steps.map(s => s.type)).toEqual(['Action', 'Decision', 'Random']);
});
