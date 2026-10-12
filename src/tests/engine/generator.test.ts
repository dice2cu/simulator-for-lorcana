import { expect, it } from 'vitest';
import { getCard } from '../../cards';
import { startAction, startEffect } from '../../engine/engine';
import { immutable } from '../../engine/immutable';
import { Resolution } from '../../engine/resolution';
import { InvalidInput } from '../../engine/invalid-input';
import { resumeAction } from '../../engine/resume';
import type { InputRequest } from '../../engine/resolution';
import type { ActionCard, CharacterCard } from '../../model/card';
import type { Effect } from '../../model/ability';
import type { GameState } from '../../model/game-state';
import type { Turn, TurnStep } from '../../model/turn';

const action = { fullName: 'Fire the Cannons!', i: 1 };
const target = { fullName: 'Test Character', i: 2 };
const ink = { fullName: 'Dinglehopper', i: 9 };
const play = { type: 'Play', player: 1, card: action } as const;
const payment: TurnStep = { type: 'Decision', answer: { type: 'Pay Cost', pay: true,
    payment: [{ type: 'Ink', player: 1, cards: [ink] }] } };
const choice: TurnStep = { type: 'Decision', answer: { type: 'Choose Cards', cards: [target] } };
const character: CharacterCard = { type: 'Character', fullName: target.fullName, names: ['Test Character'],
    colors: ['Steel'], subtypes: [], cost: 1, inkwell: true, strength: 1, willpower: 5, lore: 1 };

function base(): GameState {
    return { turn: { number: 3, player: 1 }, players: {
        1: { lore: 0, turnsTaken: 1, deck: [], hand: [action], play: [], discard: [], inkwell: [{ card: ink, exerted: false }] },
        2: { lore: 0, turnsTaken: 1, deck: [], hand: [], play: [{ card: target, damage: 2 }], discard: [], inkwell: [] },
    } };
}

function game(state = base()) {
    const position = immutable(state);
    const options = { card: (name: string) => name === target.fullName ? character : getCard(name) };
    return {
        getState: () => position,
        startAction: (action: Parameters<typeof startAction>[1]) => startAction(position, action, options),
        startEffect: (effect: Effect, source: Parameters<typeof startEffect>[2]) => startEffect(position, effect, source, options),
    };
}

it('resolves synchronously, recording only accepted inputs and allowing invalid answers to be corrected', () => {
    const engine = game();
    const start = engine.getState();
    const live = engine.startAction(play);
    expect(live.request?.type).toBe('Pay Cost');
    const before = live.turn;
    // Membership validation alone would allow this empty plan. Board validation must run before next().
    expect(() => live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [] } })).toThrow(InvalidInput);
    expect(engine.getState()).toEqual(start);
    expect(live.turn).toEqual(before);
    expect(live.request?.type).toBe('Pay Cost');
    live.submit(payment);
    expect(live.request?.type).toBe('Choose Cards');
    const paid = live.position;
    if (!paid) throw new Error('Missing branch position');
    expect(paid.players[1]?.inkwell[0]?.exerted).toBe(true);
    const prefix = live.turn;
    expect(() => live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [ink] } })).toThrow(InvalidInput);
    expect(live.position).toBe(paid);
    expect(engine.getState()).toBe(start);
    expect(live.turn).toEqual(prefix);
    expect(live.request?.type).toBe('Choose Cards');
    live.submit(choice);
    expect(live.request).toBeUndefined();
    expect(live.result?.players[2]?.play[0]?.damage).toBe(4);
    expect(live.turn.steps).toEqual([{ type: 'Action', action: play }, payment, choice]);
    expect(() => live.submit(choice)).toThrow('already complete');
});

it('reconstructs a paused generator from its base position and serialized accepted prefix', () => {
    const engine = game();
    const live = engine.startAction(play);
    live.submit(payment);
    const prefix = JSON.parse(JSON.stringify(live.turn)) as Turn;
    const replay = resumeAction(base(), prefix.steps, { card: name => name === target.fullName ? character : getCard(name) });
    expect(replay.request).toEqual(live.request);
    expect(replay.position).toEqual(live.position);
    live.submit(choice);
    replay.submit(choice);
    expect(replay.result).toEqual(live.result);
    expect(replay.turn).toEqual(live.turn);
});

it.each([true, false])('only keeps a failed validator retryable for InvalidInput (%s)', retryable => {
    const initial = immutable(base());
    const failure = retryable ? new InvalidInput('Rejected answer') : new Error('Broken validator');
    let reject = true;
    let resumed = false;
    function* operation(): Generator<InputRequest, GameState, TurnStep> {
        yield { request: { type: 'Optional', player: 1, effect: { type: 'Gain Lore', player: 'You', amount: 1 } },
            validate: () => { if (reject) throw failure; } };
        resumed = true;
        return initial;
    }
    const live = new Resolution(operation(), [], () => initial);
    const step: TurnStep = { type: 'Decision', answer: { type: 'Optional', accept: true } };
    expect(() => live.submit(step)).toThrow(failure);
    expect(resumed).toBe(false);
    expect(live.turn.steps).toEqual([]);
    expect(live.result).toBeUndefined();
    reject = false;
    if (retryable) {
        expect(live.request?.type).toBe('Optional');
        expect(live.position).toBe(initial);
        live.submit(step);
        expect(live.result).toBe(initial);
        expect(live.turn.steps).toEqual([step]);
    } else {
        expect(live.request).toBeUndefined();
        expect(live.position).toBeUndefined();
        expect(() => live.submit(step)).toThrow('Resolution has failed');
        expect(resumed).toBe(false);
    }
});

it('treats InvalidInput after accepting an answer as fatal', () => {
    const initial = immutable(base());
    const failure = new InvalidInput('Validation happened too late');
    function* operation(): Generator<InputRequest, GameState, TurnStep> {
        yield { request: { type: 'Optional', player: 1,
            effect: { type: 'Gain Lore', player: 'You', amount: 1 } } };
        throw failure;
    }
    const step: TurnStep = { type: 'Decision', answer: { type: 'Optional', accept: true } };
    let live: Resolution | undefined;
    let caught: unknown;
    try {
        live = new Resolution(operation(), [], () => initial);
        live.submit(step);
    } catch (error) {
        caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(InvalidInput);
    if (!(caught instanceof Error)) throw new Error('Expected execution failure');
    expect(caught.cause).toBe(failure);
    if (!live) throw new Error('Expected suspended resolution');
    expect(live.request).toBeUndefined();
    expect(live.position).toBeUndefined();
    expect(live.result).toBeUndefined();
    expect(live.turn.steps).toEqual([]);
    expect(() => live.submit(step)).toThrow('Resolution has failed');
});

it('shares the owned action with its accepted first step without freezing caller input', () => {
    const supplied = structuredClone(play);
    const owned = immutable(supplied);
    const live = game().startAction(owned);
    const first = live.turn.steps[0];
    if (first.type !== 'Action') throw new Error('Expected action step');
    expect(first.action).toBe(owned);
    expect(Object.isFrozen(supplied)).toBe(false);
    expect(Object.isFrozen(first.action)).toBe(true);
});

it('does not expose mutable requests, answers, records or results', () => {
    const engine = game();
    const live = engine.startAction(play);
    const request = live.request;
    if (request?.type !== 'Pay Cost') throw new Error('Expected payment request');
    expect(() => { request.cost.length = 0; }).toThrow(TypeError);
    const ownedPayment = structuredClone(payment);
    live.submit(ownedPayment);
    if (ownedPayment.type !== 'Decision' || ownedPayment.answer.type !== 'Pay Cost' || !ownedPayment.answer.pay) {
        throw new Error('Expected payment');
    }
    ownedPayment.answer.payment.length = 0;
    expect(live.turn.steps[1]).toEqual(payment);
    expect(() => { live.turn.steps.length = 0; }).toThrow(TypeError);
    expect(live.turn.steps).toHaveLength(2);
    live.submit(choice);
    const result = live.result;
    if (!result?.players[2]) throw new Error('Missing result player');
    const resultPlayer = result.players[2];
    expect(() => { resultPlayer.play.length = 0; }).toThrow(TypeError);
    expect(engine.getState().players[2]?.play).toHaveLength(1);
    expect(live.result?.players[2]?.play).toHaveLength(1);
});

it('allows independent branches and abandonment without affecting the starting position', () => {
    const engine = game();
    const initial = engine.getState();
    const live = engine.startAction(play);
    live.submit(payment);
    const abandoned = engine.startAction(play);
    expect(abandoned.request?.type).toBe('Pay Cost');
    const paid = live.position;
    expect(paid?.players[2]).toBe(initial.players[2]);
    expect(paid?.players[1]?.deck).toBe(initial.players[1]?.deck);
    expect(paid?.players[1]?.inkwell).not.toBe(initial.players[1]?.inkwell);
    expect(engine.getState()).toEqual(initial);
    const next = engine.startAction(play);
    next.submit(payment);
    next.submit(choice);
    expect(next.result).toBeDefined();
    expect(engine.getState()).toBe(initial);
    expect(abandoned.request?.type).toBe('Pay Cost');
});

it('uses the JavaScript continuation to retain nested selections and dependent healing results', () => {
    const initial = base();
    const player = initial.players[1];
    if (!player) throw new Error('Missing player');
    const draws = [{ fullName: 'Dinglehopper', i: 10 }, { fullName: 'Dinglehopper', i: 11 }];
    player.deck.push(...draws);
    const engine = game(initial);
    const live = engine.startEffect({
        type: 'Choose Cards', from: { zone: 'Play', cardType: 'Character' }, count: 1,
        effect: { type: 'Sequence', effects: [
            { type: 'Remove Damage', cards: 'Selected Cards', amount: { upTo: 3 } },
            { type: 'Draw', player: 'You', amount: { result: 'Damage Removed' } },
        ] },
    }, { card: action, player: 1, kind: 'Action' });
    live.submit(choice);
    expect(live.request).toEqual({ type: 'Choose Amount', player: 1, min: 0, max: 2 });
    expect(() => live.submit({ type: 'Decision', answer: { type: 'Choose Amount', amount: 3 } })).toThrow();
    live.submit({ type: 'Decision', answer: { type: 'Choose Amount', amount: 2 } });
    expect(live.result?.players[2]?.play[0]?.damage).toBe(0);
    expect(live.result?.players[1]?.hand).toEqual([action, ...draws]);
});

it('fails invalid instructions without altering the base or preventing another operation', () => {
    const engine = game();
    const before = engine.getState();
    const live = engine.startEffect({ type: 'Optional', effect: { type: 'Sequence', effects: [
        { type: 'Gain Lore', player: 'You', amount: 2 },
        { type: 'Gain Lore', player: 'You', amount: { highest: { stat: 'Strength', cards: { cards: [] } } } },
    ] } }, { card: action, player: 1, kind: 'Action' });
    expect(() => live.submit({ type: 'Decision', answer: { type: 'Optional', accept: true } })).toThrow('An empty set has no highest or lowest value');
    expect(engine.getState()).toEqual(before);
    expect(live.position).toBeUndefined();
    expect(live.result).toBeUndefined();
    expect(live.request).toBeUndefined();
    expect(live.turn.steps).toEqual([]);
    expect(() => live.submit(choice)).toThrow('failed');
    expect(engine.startAction(play).request?.type).toBe('Pay Cost');
});

it('validates randomness before resuming the driver, without implying shuffle effects are implemented', () => {
    const initial = base();
    function* operation(): Generator<InputRequest, GameState, TurnStep> {
        const step = yield { request: { type: 'Shuffle', cards: [action, ink] } };
        if (step.type !== 'Random') throw new Error('Expected random outcome');
        return { ...initial, players: { ...initial.players,
            1: { ...initial.players[1], lore: 0, turnsTaken: 1, hand: [], play: [], discard: [], inkwell: [],
                deck: step.outcome.cards },
        } };
    }
    const live = new Resolution(operation());
    expect(() => live.submit({ type: 'Random', outcome: { type: 'Shuffle', cards: [ink, ink] } })).toThrow(InvalidInput);
    expect(live.turn.steps).toEqual([]);
    live.submit({ type: 'Random', outcome: { type: 'Shuffle', cards: [ink, action] } });
    expect(live.result?.players[1]?.deck).toEqual([ink, action]);
});

it('reconstructs independent alternatives from one accepted prefix and rejects surplus or mismatched inputs', () => {
    const options = { card: (name: string) => name === target.fullName ? character : getCard(name) };
    const prefix: Turn = { steps: [{ type: 'Action', action: play }, payment] };
    const first = resumeAction(base(), prefix.steps, options);
    const second = resumeAction(base(), prefix.steps, options);
    first.submit(choice);
    second.submit(choice);
    expect(first.result).toEqual(second.result);
    expect(prefix.steps).toHaveLength(2);
    expect(() => resumeAction(base(), [...first.turn.steps, choice], options)).toThrow('already complete');
    expect(() => resumeAction(base(), [choice], options)).toThrow('begin with an action');
    expect(() => resumeAction(base(), [prefix.steps[0], choice], options)).toThrow();
});

it('copies an external position once and reuses owned immutable positions across engines', () => {
    const original = base();
    const engine = game(original);
    const start = engine.getState();
    expect(Object.isFrozen(original)).toBe(false);
    original.turn.number = 99;
    expect(start.turn.number).toBe(3);
    expect(game(start).getState()).toBe(start);
    expect(() => { start.turn.number = 99; }).toThrow(TypeError);
    const live = engine.startAction(play);
    live.submit(payment);
    const paid = live.position;
    live.submit(choice);
    expect(paid?.players[2]?.play[0]?.damage).toBe(2);
    expect(live.result?.players[2]?.play[0]?.damage).toBe(4);
    expect(live.result?.players[1]?.deck).toBe(start.players[1]?.deck);
});

it.each([true, false])('keeps dependent results local and publishes zero when optional healing is declined (%s)', accept => {
    const initial = base();
    const player = initial.players[1];
    if (!player) throw new Error('Missing player');
    const draws = [{ fullName: 'Dinglehopper', i: 10 }, { fullName: 'Dinglehopper', i: 11 }];
    player.deck = draws;
    const live = game(initial).startEffect({ type: 'Sequence', effects: [
        { type: 'Remove Damage', cards: { cards: [target] }, amount: 1 },
        { type: 'Optional', effect: { type: 'Remove Damage', cards: { cards: [target] }, amount: 1 } },
        { type: 'Draw', player: 'You', amount: { result: 'Damage Removed' } },
    ] }, { card: action, player: 1, kind: 'Action' });
    live.submit({ type: 'Decision', answer: { type: 'Optional', accept } });
    expect(live.result?.players[1]?.hand).toEqual(accept ? [action, draws[0]] : [action]);
    expect(live.result?.players[2]?.play[0]?.damage).toBe(accept ? 0 : 1);
});

it('preserves a result across unrelated instructions and does not leak nested sequence outputs', () => {
    const initial = base();
    const player = initial.players[1];
    if (!player) throw new Error('Missing player');
    const draw = { fullName: 'Dinglehopper', i: 10 };
    player.deck = [draw];
    const live = game(initial).startEffect({ type: 'Sequence', effects: [
        { type: 'Remove Damage', cards: { cards: [target] }, amount: 1 },
        { type: 'Optional', effect: { type: 'Gain Lore', player: 'You', amount: 1 } },
        { type: 'Sequence', effects: [{ type: 'Remove Damage', cards: { cards: [target] }, amount: 0 }] },
        { type: 'Draw', player: 'You', amount: { result: 'Damage Removed' } },
    ] }, { card: action, player: 1, kind: 'Action' });
    live.submit({ type: 'Decision', answer: { type: 'Optional', accept: false } });
    expect(live.result?.players[1]?.hand).toEqual([action, draw]);
});

it('supports different decisions on independent branches of the same starting position', () => {
    const engine = game();
    const effect: Effect = { type: 'Remove Damage', cards: { cards: [target] }, amount: { upTo: 2 } };
    const source = { card: action, player: 1, kind: 'Action' } as const;
    const first = engine.startEffect(effect, source);
    const second = engine.startEffect(effect, source);
    first.submit({ type: 'Decision', answer: { type: 'Choose Amount', amount: 0 } });
    second.submit({ type: 'Decision', answer: { type: 'Choose Amount', amount: 2 } });
    expect(first.result?.players[2]?.play[0]?.damage).toBe(2);
    expect(second.result?.players[2]?.play[0]?.damage).toBe(0);
    expect(engine.getState().players[2]?.play[0]?.damage).toBe(2);
});

it('keeps a resolving action in play and retains its source if it leaves during resolution', () => {
    const definition: ActionCard = { type: 'Action', fullName: action.fullName, names: [action.fullName],
        colors: ['Steel'], subtypes: [], cost: 0, inkwell: false,
        effect: { type: 'Choose Cards', from: 'Self', count: 1,
            effect: { type: 'Sequence', effects: [
                { type: 'Banish', cards: 'Selected Cards' },
                { type: 'Gain Lore', player: 'You', amount: 1 },
            ] } } };
    const initial = base();
    const live = startAction(initial, play, { card: name => name === action.fullName ? definition : name === target.fullName ? character : getCard(name) });
    expect(live.request).toEqual({ type: 'Choose Cards', player: 1, cards: [action], min: 1, max: 1, effect: definition.effect.type === 'Choose Cards' ? definition.effect.effect : undefined });
    expect(live.position?.players[1]?.hand).toEqual([]);
    expect(live.position?.players[1]?.play).toEqual([{ card: action }]);
    expect(live.position?.players[1]?.discard).toEqual([]);
    live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [action] } });
    expect(live.result?.players[1]?.discard).toEqual([action]);
    expect(live.result?.players[1]?.lore).toBe(1);
    expect(initial.players[1]?.hand).toEqual([action]);
});

it('rejects damage to an action because actions cannot have damage', () => {
    const definition: ActionCard = { type: 'Action', fullName: action.fullName, names: [action.fullName],
        colors: ['Steel'], subtypes: [], cost: 0, inkwell: false,
        effect: { type: 'Put Damage', cards: 'Self', amount: 1 } };
    expect(() => startAction(base(), play, { card: name => name === action.fullName ? definition : name === target.fullName ? character : getCard(name) }))
        .toThrow('Target cannot have damage');
});

it('does not repeat catalog lookups for nested instructions', () => {
    const lookups: string[] = [];
    const live = startEffect(base(), { type: 'Sequence', effects: [
        { type: 'Gain Lore', player: 'You', amount: 1 },
        { type: 'Sequence', effects: [{ type: 'Gain Lore', player: 'You', amount: 1 }] },
    ] }, { card: action, player: 1, kind: 'Action' }, { card: name => {
        lookups.push(name);
        return name === target.fullName ? character : getCard(name);
    } });
    expect(live.result?.players[1]?.lore).toBe(2);
    expect(lookups.filter(name => name === target.fullName)).toEqual([target.fullName]);
    expect(new Set(lookups).size).toBe(lookups.length);
});
