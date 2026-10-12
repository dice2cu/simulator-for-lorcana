import { describe, expect, it } from 'vitest';
import { startAction, startEffect, drive } from '../../engine/engine';
import { getCard } from '../../cards';
import { InvalidInput } from '../../engine/invalid-input';
import { accumulatedResults } from '../../engine/effect-results';
import type { Effect } from '../../model/ability';
import type { Card, CharacterCard } from '../../model/card';
import type { GameState, PlayerPosition } from '../../model/game-state';
import type { Decision, DecisionAnswer, TurnStep } from '../../model/turn';

const action = { fullName: 'Fire the Cannons!', i: 1 };
const target = { fullName: 'Test Character', i: 2 };
const definition: CharacterCard = { type: 'Character', fullName: target.fullName, names: ['Test Character'],
    colors: ['Steel'], subtypes: [], cost: 1, inkwell: true, strength: 1, willpower: 5, lore: 1 };

it('combines iteration outputs without duplicating cards or losing incomplete results', () => {
    const first = { 'Damage Removed': 2, complete: false, groups: { 'Characters With Damage Removed': [target] } };
    const result = accumulatedResults(first, { 'Damage Removed': 3, complete: true,
        groups: { 'Characters With Damage Removed': [{ ...target }, action] } });
    expect(result['Damage Removed']).toBe(5);
    expect(result.groups?.['Characters With Damage Removed']).toEqual([target, action]);
    expect(result.complete).toBe(false);
    expect(first['Damage Removed']).toBe(2);
    expect(first.groups['Characters With Damage Removed']).toEqual([target]);
});

it('returns private looks and public reveals without marking the physical cards', () => {
    const state = position();
    const live = startEffect(state, { type: 'Sequence', effects: [
        { type: 'Look', cards: { zone: 'Hand', player: 'You' } },
        { type: 'Reveal', cards: { zone: 'Hand', player: 'You' } },
    ] }, { card: action, player: 1, kind: 'Action' }, { card: name => name === target.fullName ? definition : getCard(name) });
    expect(live.observations).toEqual([
        { type: 'Look', cards: [action], players: [1] }, { type: 'Reveal', cards: [action] },
    ]);
    expect(live.result).toEqual(state);
    expect(Object.isFrozen(live.observations[0]?.cards)).toBe(true);
});

function position(): GameState {
    const player = (): PlayerPosition => ({ turnsTaken: 0, lore: 0, deck: [], hand: [], play: [], discard: [], inkwell: [] });
    const p1 = player(), p2 = player();
    p1.hand.push(action);
    p1.inkwell.push({ card: { fullName: 'Dinglehopper', i: 3 }, exerted: false });
    p2.play.push({ card: target, damage: 0 });
    return { turn: { number: 1, player: 1 }, players: { 1: p1, 2: p2 } };
}

it('rejects malformed JSON answers without poisoning the waiting resolution', () => {
    const live = startEffect(position(), { type: 'Choose Cards', from: { zone: 'Play', player: 'Opponents' }, count: 1,
        effect: { type: 'Deal Damage', cards: 'Selected Cards', amount: 2 } }, { card: action, player: 1, kind: 'Action' },
        { card: name => name === target.fullName ? definition : getCard(name) });
    const before = live.position;
    for (const text of ['null', '{}', '{"type":"Decision"}', '{"type":"Decision","answer":{"type":"Choose Cards"}}',
        '{"type":"Decision","answer":{"type":"Choose Cards","cards":[null]}}']) {
        const input: unknown = JSON.parse(text);
        expect(() => live.submit(input as TurnStep)).toThrow(InvalidInput);
        expect(live.position).toBe(before);
        expect(live.turn.steps).toEqual([]);
    }
    live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [target] } });
    expect(live.result?.players[2]?.play[0]?.damage).toBe(2);
});

function engine(state = position(), decide: () => DecisionAnswer | Promise<DecisionAnswer> = () => ({ type: 'Choose Cards', cards: [target] }), card: Card = definition) {
    const answer = (request: Decision): DecisionAnswer | Promise<DecisionAnswer> => {
        if (request.type === 'Pay Cost') return { type: 'Pay Cost', pay: true,
            payment: [{ type: 'Ink', player: 1, cards: state.players[1]?.inkwell.filter(ink => !ink.exerted).slice(0, 1).map(ink => ink.card) ?? [] }] };
        return decide();
    };
    const options = { card: (name: string) => name === target.fullName ? card : getCard(name) };
    return {
        play: () => drive(startAction(state, { type: 'Play', player: 1, card: action }, options), answer),
        effect: (effect: Parameters<typeof startEffect>[1], base = state) => drive(startEffect(base, effect,
            { card: action, player: 1, kind: 'Action' }, options), answer),
    };
}

describe('engine boundaries', () => {
    it.each(['wrong player', 'missing card', 'insufficient ink', 'ended game'] as const)(
        'classifies an illegal action as InvalidInput (%s)', reason => {
            const state = position();
            const player = state.players[1];
            if (!player) throw new Error('Missing player');
            if (reason === 'wrong player') state.turn.player = 2;
            if (reason === 'missing card') player.hand = [];
            if (reason === 'insufficient ink') player.inkwell[0].exerted = true;
            if (reason === 'ended game') player.lore = 20;
            const before = structuredClone(state);
            expect(() => engine(state).play()).toThrow(InvalidInput);
            expect(state).toEqual(before);
        });

    it.each([true, false])('Vanish only fires for an opposing chooser (%s)', own => {
        const card: CharacterCard = { ...definition, abilities: [{ type: 'Keyword', keyword: { name: 'Vanish' } }] };
        const effect: Effect = { type: 'Choose Cards', player: { players: [own ? 2 : 1] },
            from: { zone: 'Play', cardType: 'Character' }, count: 1,
            effect: { type: 'Put Damage', cards: 'Selected Cards', amount: 1 } };
        const start = () => startEffect(position(), effect,
            { card: action, player: 1, kind: 'Action' }, { card: () => card });
        const live = start();
        expect(live.request).toEqual({ type: 'Choose Cards', player: own ? 2 : 1, cards: [target], min: 1, max: 1, effect: effect.effect });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [target] } });
        if (own) expect(live.result?.players[2]?.play[0]?.damage).toBe(1);
        else {
            expect(live.result?.players[2]?.play).toHaveLength(0);
            expect(live.result?.players[2]?.discard).toEqual([target]);
        }
    });

    it('does not mutate input positions or returned snapshots', async () => {
        const state = position();
        const before = structuredClone(state);
        const game = engine(state);
        const result = await game.play();
        expect(state).toEqual(before);
        expect(result.players[1]?.hand).toEqual([]);
        expect(result.players[1]?.inkwell[0].exerted).toBe(true);
        expect(result.players[2]?.play[0].damage).toBe(2);
        expect(() => result.players[2]?.play.splice(0)).toThrow(TypeError);
        expect(state.players[2]?.play).toHaveLength(1);
    });

    it.each([
        { type: 'Choose Cards', cards: [{ fullName: 'No such card', i: 99 }] },
        { type: 'Choose Cards', cards: [target, target] },
        { type: 'Choose Cards', cards: [] },
        { type: 'Optional', accept: true },
    ] satisfies DecisionAnswer[])('rejects invalid answers without changing ink, hand or board in the base', async answer => {
        const state = position();
        const game = engine(state, () => answer);
        const before = structuredClone(state);
        await expect(game.play()).rejects.toThrow(InvalidInput);
        expect(state).toEqual(before);
    });

    it('leaves the base unchanged when a later instruction fails', async () => {
        const state = position();
        const game = engine(state);
        const before = structuredClone(state);
        // Construction executes synchronously until a request or failure.
        expect(() => game.effect({ type: 'Sequence', effects: [
            { type: 'Gain Lore', player: 'You', amount: 2 },
            { type: 'Gain Lore', player: 'You', amount: { highest: { stat: 'Strength', cards: { cards: [] } } } },
        ] })).toThrow('An empty set has no highest or lowest value');
        expect(state).toEqual(before);
    });

    it('rejects insufficient ink before asking for a choice', async () => {
        const state = position();
        const p = state.players[1];
        if (!p) throw new Error('Missing player');
        p.inkwell[0].exerted = true;
        const game = engine(state, () => { throw new Error('Must not ask'); });
        const before = structuredClone(state);
        expect(() => game.play()).toThrow('Not enough ready ink');
        expect(state).toEqual(before);
    });

    it('applies Resist to dealt damage, but not placed counters', async () => {
        const card: CharacterCard = { ...definition, abilities: [{ type: 'Keyword', keyword: { name: 'Resist', amount: 1 } }] };
        const game = engine(position(), undefined, card);
        const played = await game.play();
        expect(played.players[2]?.play[0].damage).toBe(1);
        const damaged = await game.effect({ type: 'Put Damage', cards: { cards: [target] }, amount: 2 }, played);
        expect(damaged.players[2]?.play[0].damage).toBe(3);
    });

    it('banishes a lethally damaged stack', async () => {
        const state = position();
        const p = state.players[2];
        if (!p) throw new Error('Missing player');
        const under = { fullName: 'Test Character', i: 4 };
        p.play[0].under = [{ card: under, faceDown: false }];
        const game = engine(state, undefined, { ...definition, willpower: 2 });
        const result = await game.play();
        expect(result.players[2]?.play).toEqual([]);
        expect(result.players[2]?.discard).toEqual([target, under]);
    });

    it('does not offer opposing Ward cards as chosen targets', async () => {
        const card: CharacterCard = { ...definition, abilities: [{ type: 'Keyword', keyword: { name: 'Ward' } }] };
        const game = engine(position(), () => { throw new Error('No legal targets'); }, card);
        const result = await game.play();
        expect(result.players[2]?.play[0].damage).toBe(0);
    });

    it('lets an opposing chooser choose their own Ward character', () => {
        const card: CharacterCard = { ...definition, abilities: [{ type: 'Keyword', keyword: { name: 'Ward' } }] };
        const live = startEffect(position(), { type: 'Choose Cards', player: { players: [2] },
            from: { zone: 'Play', cardType: 'Character' }, count: 1,
            effect: { type: 'Put Damage', cards: 'Selected Cards', amount: 1 } },
        { card: action, player: 1, kind: 'Action' }, { card: () => card });
        expect(live.request).toEqual({ type: 'Choose Cards', player: 2, cards: [target], min: 1, max: 1, effect: { type: 'Put Damage', cards: 'Selected Cards', amount: 1 } });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [target] } });
        expect(live.result?.players[2]?.play[0]?.damage).toBe(1);
    });

    it('protects the source player\'s Ward character from an opposing chooser', () => {
        const state = position();
        const p1 = state.players[1], p2 = state.players[2];
        if (!p1 || !p2) throw new Error('Missing players');
        p1.play = p2.play;
        p2.play = [];
        const card: CharacterCard = { ...definition, abilities: [{ type: 'Keyword', keyword: { name: 'Ward' } }] };
        const live = startEffect(state, { type: 'Choose Cards', player: { players: [2] },
            from: { zone: 'Play', cardType: 'Character' }, count: 1,
            effect: { type: 'Put Damage', cards: 'Selected Cards', amount: 1 } },
        { card: action, player: 1, kind: 'Action' }, { card: () => card });
        expect(live.request).toBeUndefined();
        expect(live.result?.players[1]?.play[0]?.damage).toBe(0);
    });

    it.each(['Deal Damage', 'Put Damage'] as const)('applies %s to an undamaged character', type => {
        const live = startEffect(position(), { type, cards: { cards: [target] }, amount: 2 },
            { card: action, player: 1, kind: 'Action' }, { card: () => definition });
        expect(live.result?.players[2]?.play[0]?.damage).toBe(2);
    });

    it('observes player restrictions for isolated effects too', () => {
        const state = position();
        const player = state.players[2];
        if (!player) throw new Error('Missing player');
        player.modifiers = [{ restriction: "Can't Gain Lore" }];
        expect(startEffect(state, { type: 'Gain Lore', player: 'Opponents', amount: 2 },
            { card: action, player: 1, kind: 'Action' }, { card: () => definition }).result?.players[2]?.lore).toBe(0);
        expect(player.lore).toBe(0);
    });

    it('does not classify an evaluator failure as a retryable answer', () => {
        const live = startEffect(position(), { type: 'Optional', effect: { type: 'Gain Lore', player: 'You', amount: { highest: { stat: 'Strength', cards: { cards: [] } } } } },
            { card: action, player: 1, kind: 'Action' }, { card: () => definition });
        let failure: unknown;
        try { live.submit({ type: 'Decision', answer: { type: 'Optional', accept: true } }); }
        catch (error) { failure = error; }
        expect(failure).toBeInstanceOf(Error);
        expect(failure).not.toBeInstanceOf(InvalidInput);
        expect(live.position).toBeUndefined();
        expect(live.rules).toBeUndefined();
        expect(live.observations).toEqual([]);
    });

    it('returns independent results for concurrent callback operations from the same base', async () => {
        const answers: ((answer: DecisionAnswer) => void)[] = [];
        const state = position();
        const before = structuredClone(state);
        const game = engine(state, () => new Promise(resolve => { answers.push(resolve); }));
        const pending = game.play();
        const other = game.play();
        await Promise.resolve();
        if (answers.length !== 2) throw new Error('Missing decisions');
        answers[0]({ type: 'Choose Cards', cards: [target] });
        const first = await pending;
        answers[1]({ type: 'Choose Cards', cards: [target] });
        const second = await other;
        expect(first).toEqual(second);
        expect(second.players[2]?.play[0].damage).toBe(2);
        expect(state).toEqual(before);
    });
});
