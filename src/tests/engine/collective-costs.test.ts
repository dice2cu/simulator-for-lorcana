import { describe, expect, it } from 'vitest';
import { startAction, startEffect } from '../../engine/engine';
import { getLegalActions } from '../../engine/actions';
import { getDefaultPayment } from '../../engine/costs';
import type { GameState, PlayerPosition } from '../../model/game-state';

function setup() {
    const player = (): PlayerPosition => ({ lore: 0, turnsTaken: 0, deck: [], hand: [], discard: [], inkwell: [], play: [] });
    const p1 = player(), p2 = player(), p3 = player();
    const state: GameState = { turn: { number: 1, player: 1 }, players: { 1: p1, 2: p2, 3: p3 } };
    return { state, p1, p2, p3 };
}

describe('collective resource payments', () => {
    it('the default shared payment reserves ink for later per-player costs', () => {
        const { state, p1, p2 } = setup();
        const source = { card: { fullName: 'Dinglehopper', i: 99 }, player: 1 as const, kind: 'Ability' as const };
        p1.inkwell = [1, 2].map(i => ({ card: { fullName: 'Dinglehopper', i }, exerted: false }));
        p2.inkwell = [3, 4, 5].map(i => ({ card: { fullName: 'Dinglehopper', i }, exerted: false }));
        p2.inkDrops = 1;
        const live = startEffect(state, { type: 'Pay Cost', player: { together: { players: [1, 2] } },
            cost: [{ type: 'Ink', amount: 2 }, { type: 'Ink', amount: 2, each: true }],
            then: { type: 'Gain Lore', player: 'You', amount: 1 } }, source);
        const request = live.request, position = live.position;
        if (request?.type !== 'Pay Cost' || !position) throw new Error('Missing collective payment request');
        const payment = getDefaultPayment(position, request, source);
        if (!payment) throw new Error('Missing default payment');
        expect(payment[0]).toMatchObject({ type: 'Ink', player: 2, inkDrops: 1, cards: [{ fullName: 'Dinglehopper', i: 3 }] });
        expect(p1.inkwell.every(ink => !ink.exerted)).toBe(true);
        expect(p2.inkDrops).toBe(1);
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment } });
        expect(live.result?.players[1]?.lore).toBe(1);
        expect(live.result?.players[1]?.inkwell.every(ink => ink.exerted)).toBe(true);
        expect(live.result?.players[2]?.inkwell.every(ink => ink.exerted)).toBe(true);
        expect(live.result?.players[2]?.inkDrops).toBe(0);
    });

    it('the default payment handles nested card choices and spends temporary ink first', () => {
        const { state, p1 } = setup();
        const source = { card: { fullName: 'Dinglehopper', i: 99 }, player: 1 as const, kind: 'Ability' as const };
        p1.hand = [1, 2].map(i => ({ fullName: 'Dinglehopper', i }));
        p1.inkwell = [3, 4].map(i => ({ card: { fullName: 'Dinglehopper', i }, exerted: false }));
        p1.inkDrops = 1;
        const live = startEffect(state, { type: 'Pay Cost', cost: [
            { type: 'Choose Cards', from: { zone: 'Hand', player: 'You' }, count: 1, cost: [{ type: 'Discard', cards: 'Selected Cards' }] },
            { type: 'Ink', amount: 3 },
        ], then: { type: 'Gain Lore', player: 'You', amount: 1 } }, source);
        const request = live.request, position = live.position;
        if (request?.type !== 'Pay Cost' || !position) throw new Error('Missing nested payment request');
        const payment = getDefaultPayment(position, request, source);
        if (!payment) throw new Error('Missing default payment');
        expect(payment).toEqual([
            { type: 'Discard', player: 1, cards: [p1.hand[0]] },
            { type: 'Ink', player: 1, cards: p1.inkwell.map(ink => ink.card), inkDrops: 1 },
        ]);
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment } });
        expect(live.result?.players[1]?.discard).toEqual([p1.hand[0]]);
        expect(live.result?.players[1]?.lore).toBe(1);
    });

    it('Hercules lets opponents share the lore cost before banishing him', () => {
        const { state, p1, p2, p3 } = setup();
        const hercules = { fullName: 'Hercules - Manipulated Hero', i: 1 };
        p3.play = [{ card: hercules, exerted: true }]; p1.lore = 1; p2.lore = 2;
        const action = getLegalActions(state).find(action => action.type === 'Activate');
        if (!action) throw new Error('Missing collective activation');
        const live = startAction(state, action);
        expect(live.request).toMatchObject({ type: 'Pay Cost', player: { together: [1, 2] } });
        expect(() => live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Lose Lore', player: 1, amount: 3 }] } })).toThrow();
        expect(live.position?.players[1]?.lore).toBe(1);
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [
            { type: 'Lose Lore', player: 1, amount: 1 }, { type: 'Lose Lore', player: 2, amount: 2 },
        ] } });
        expect(live.result?.players[1]?.lore).toBe(0);
        expect(live.result?.players[2]?.lore).toBe(0);
        expect(live.result?.players[3]?.discard).toEqual([hercules]);
    });

    it('each makes every member pay the full ink amount, not just the group total', () => {
        const { state, p1, p2 } = setup();
        const first = [1, 2, 3].map(i => ({ fullName: 'Dinglehopper', i }));
        const second = [4, 5, 6].map(i => ({ fullName: 'Dinglehopper', i }));
        p1.inkwell = first.map(card => ({ card, exerted: false })); p2.inkwell = second.map(card => ({ card, exerted: false }));
        const live = startEffect(state, { type: 'Pay Cost', player: { together: { players: [1, 2] } }, cost: [{ type: 'Ink', amount: 3, each: true }],
            then: { type: 'Gain Lore', player: 'You', amount: 1 } }, { card: first[0], player: 1, kind: 'Ability' });
        expect(() => live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: first }] } })).toThrow();
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [
            { type: 'Ink', player: 1, cards: first }, { type: 'Ink', player: 2, cards: second },
        ] } });
        expect(live.result?.players[1]?.inkwell.every(card => card.exerted)).toBe(true);
        expect(live.result?.players[2]?.inkwell.every(card => card.exerted)).toBe(true);
        expect(live.result?.players[1]?.lore).toBe(1);
    });
});
