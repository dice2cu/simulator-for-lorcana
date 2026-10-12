import { expect, it } from 'vitest';
import { startGame, startTurn } from '../../engine/engine';
import { InvalidInput } from '../../engine/invalid-input';
import type { GameState, PlayerPosition } from '../../model/game-state';

function initial(): GameState {
    const player = (offset: number): PlayerPosition => ({ lore: 0, turnsTaken: 0, hand: [], play: [], discard: [], inkwell: [],
        deck: Array.from({ length: 12 }, (_, i) => ({ fullName: 'Dinglehopper', i: offset + i })) });
    return { turn: { number: 1, player: 2 }, players: { 1: player(100), 2: player(200) } };
}

it('sets up opening hands in starting-player order and shuffles only after all alterations', () => {
    const state = initial(), before = structuredClone(state), live = startGame(state);
    for (const number of [2, 1] as const) {
        const deck = state.players[number]?.deck;
        if (!deck) throw new Error('Missing setup deck');
        expect(live.request).toEqual({ type: 'Shuffle', cards: deck });
        live.submit({ type: 'Random', outcome: { type: 'Shuffle', cards: deck } });
    }
    const first = live.position?.players[2]?.hand[0];
    if (!first) throw new Error('Missing opening hand');
    expect(live.request).toMatchObject({ type: 'Action', player: 2 });
    live.submit({ type: 'Action', action: { type: 'Alter Hand', player: 2, cards: [first] } });
    expect(live.position?.players[2]?.hand.map(card => card.i)).toEqual([201, 202, 203, 204, 205, 206, 207]);
    expect(live.request).toMatchObject({ type: 'Action', player: 1 });
    live.submit({ type: 'Action', action: { type: 'Alter Hand', player: 1, cards: [] } });
    const request = live.request;
    if (request?.type !== 'Shuffle') throw new Error('Missing final alteration shuffle');
    expect(request.cards.map(card => card.i)).toEqual([208, 209, 210, 211, 200]);
    live.submit({ type: 'Random', outcome: { type: 'Shuffle', cards: [...request.cards].reverse() } });
    expect(live.result?.players[2]?.deck.map(card => card.i)).toEqual([200, 211, 210, 209, 208]);
    expect(state).toEqual(before);
    const replay = startGame(state);
    for (const step of JSON.parse(JSON.stringify(live.turn)).steps) replay.submit(step);
    expect(replay.result).toEqual(live.result);
    if (!live.result) throw new Error('Setup did not finish');
    const firstTurn = startTurn(live.result);
    expect(firstTurn.position?.players[2]?.hand).toHaveLength(7);
    expect(firstTurn.request?.type).toBe('Action');
});

it('rejects invalid hand alterations before changing setup state', () => {
    const state = initial(), live = startGame(state);
    for (const player of [2, 1] as const) {
        const deck = state.players[player]?.deck;
        if (!deck) throw new Error('Missing deck');
        live.submit({ type: 'Random', outcome: { type: 'Shuffle', cards: deck } });
    }
    const before = live.position;
    expect(() => live.submit({ type: 'Action', action: { type: 'Alter Hand', player: 2,
        cards: [{ fullName: 'Dinglehopper', i: 999 }] } })).toThrow(InvalidInput);
    expect(live.position).toBe(before);
});
