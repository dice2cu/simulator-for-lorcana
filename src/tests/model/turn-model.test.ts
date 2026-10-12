import { expect, expectTypeOf, it } from 'vitest';
import type { GameState } from '../../model/game-state';
import type { DecisionAnswer, Turn, PlayerAction } from '../../model/turn';
import { healingAnswer, healingDecision, positionDuringChoice, turnDuringChoice } from '../../model/turn-examples';
import { assertRequestedInput } from '../../engine/turn-input';

it('keeps execution machinery out of positions and turn records', () => {
    expectTypeOf<'inkActions'>().not.toExtend<keyof GameState>();
    expectTypeOf<'execution' | 'frames' | 'stage'>().not.toExtend<keyof Turn>();
    expect(positionDuringChoice.players[1]?.play[1]?.damage).toBe(2);
    expect(JSON.parse(JSON.stringify(turnDuringChoice))).toEqual(turnDuringChoice);
    expect(Object.keys(turnDuringChoice)).toEqual(['steps']);
});

it('distinguishes requests from recorded answers', () => {
    expect(() => assertRequestedInput(healingDecision, { type: 'Decision', answer: healingAnswer })).not.toThrow();
    expectTypeOf<{ type: 'Optional'; accept: boolean }>().toExtend<DecisionAnswer>();
    expectTypeOf<{ type: 'Choose Mode'; mode: string }>().not.toExtend<DecisionAnswer>();
});

it('selects granted rule occurrences by registry slot in actions', () => {
    const card = { fullName: 'Hercules - Divine Hero', i: 4 };
    const activation: PlayerAction = { type: 'Activate', player: 1, card, rule: 2 };
    expect(activation.rule).toBe(2);
    expectTypeOf<'rules'>().not.toExtend<keyof GameState>();
});

it('does not accept copied gained keywords or ambiguous printed/granted references in actions', () => {
    const card = { fullName: 'Simba - King in the Making', i: 32 };
    const action: PlayerAction = { type: 'Boost', player: 1, card, rule: 1 };
    expect(JSON.parse(JSON.stringify(action))).toEqual(action);
    // @ts-expect-error Choose a rule occurrence, not an ability copied by value.
    const copied: PlayerAction = { type: 'Boost', player: 1, card, ability: { name: 'Boost', cost: [] } };
    // @ts-expect-error Choose a printed slot or granted rule, never both.
    const ambiguous: PlayerAction = { type: 'Shift', player: 1, card, onto: [], ability: 0, rule: 0 };
    void copied; void ambiguous;
});
