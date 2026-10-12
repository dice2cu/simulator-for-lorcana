import { expect, it } from 'vitest';
import { getCard } from '../../cards';
import { startAction, drive } from '../../engine/engine';
import { assertRequestedInput } from '../../engine/turn-input';
import type { CharacterCard } from '../../model/card';
import type { GameState } from '../../model/game-state';
import type { Decision, DecisionAnswer, Turn, PlayerAction } from '../../model/turn';

const action = { fullName: 'Fire the Cannons!', i: 1 };
const target = { fullName: 'Recording Test Character', i: 2 };
const firstInk = { fullName: 'Dinglehopper', i: 3 };
const lastInk = { fullName: 'Dinglehopper', i: 9 };
const definition: CharacterCard = { type: 'Character', fullName: target.fullName, names: [target.fullName],
    colors: ['Steel'], subtypes: [], cost: 0, inkwell: true, strength: 1, willpower: 5, lore: 1 };
const lookup = (name: string) => name === target.fullName ? definition : getCard(name);
function base(): GameState {
    return { turn: { number: 3, player: 1 }, players: {
        1: { lore: 0, turnsTaken: 1, deck: [], hand: [action], play: [], discard: [],
            inkwell: [{ card: firstInk, exerted: false }, { card: lastInk, exerted: false }] },
        2: { lore: 0, turnsTaken: 1, deck: [], hand: [], play: [{ card: target }], discard: [], inkwell: [] },
    } };
}

it('reproduces actual evaluator output using only the base position and recorded action/answer steps', async () => {
    // This proves the input format against implemented actions, not full turn lifecycle support.
    const initial = base();
    const before = structuredClone(initial);
    const turn: Turn = { steps: [] };
    const decide = (request: Decision): DecisionAnswer => {
        const answer: DecisionAnswer = request.type === 'Pay Cost'
            ? { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: [lastInk] }] }
            : { type: 'Choose Cards', cards: [target] };
        assertRequestedInput(request, { type: 'Decision', answer });
        turn.steps.push({ type: 'Decision', answer: structuredClone(answer) });
        return answer;
    };
    const play: PlayerAction = { type: 'Play', player: 1, card: action };
    turn.steps.push({ type: 'Action', action: play });
    const expected = await drive(startAction(initial, play, { card: lookup }), decide);
    const restored = JSON.parse(JSON.stringify(turn)) as Turn;
    let cursor = 0;
    const playbackAnswer = (request: Decision): DecisionAnswer => {
        const step = restored.steps[cursor];
        if (step?.type !== 'Decision') throw new Error('Missing recorded answer');
        assertRequestedInput(request, step);
        cursor++;
        return step.answer;
    };
    let playback = initial;
    while (cursor < restored.steps.length) {
        const step = restored.steps[cursor];
        if (step?.type !== 'Action') throw new Error('Surplus recorded answer');
        cursor++;
        playback = await drive(startAction(playback, step.action, { card: lookup }), playbackAnswer);
    }
    expect(playback).toEqual(expected);
    expect(initial).toEqual(before);
    expect(restored).toEqual(turn);
    expect(expected.players[1]?.inkwell.map(ink => ink.exerted)).toEqual([false, true]);
    expect(expected.players[2]?.play[0]?.damage).toBe(2);
    expect(cursor).toBe(restored.steps.length);
});

it.each([
    { type: 'Pay Cost', pay: false },
    { type: 'Pay Cost', pay: true, payment: [] },
    { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: [firstInk, lastInk] }] },
    { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: [target] }] },
    { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 2, cards: [lastInk] }] },
    { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: [lastInk, lastInk] }] },
] satisfies DecisionAnswer[])('rejects an unpayable recorded payment without changing the base: %j', async answer => {
    const initial = base();
    const before = structuredClone(initial);
    await expect(drive(startAction(initial, { type: 'Play', player: 1, card: action }, { card: lookup }), () => answer)).rejects.toThrow();
    expect(initial).toEqual(before);
});
