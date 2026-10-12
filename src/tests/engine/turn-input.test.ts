import { expect, it } from 'vitest';
import { assertRequestedInput } from '../../engine/turn-input';
import type { Decision, DecisionAnswer, RandomRequest, TurnStep } from '../../model/turn';

const a = { fullName: 'Merlin - Goat', i: 7 };
const b = { fullName: 'Merlin - Goat', i: 13 };
const other = { fullName: 'Merlin - Goat', i: 21 };
const printed = 0;
const gained = 2;
const created = 3;
const draw = { type: 'Draw', player: 'You', amount: 1 } as const;

it.each([
    { type: 'Shuffle', cards: [a, b] },
    { type: 'Random Cards', cards: [a, b], count: 1 },
] satisfies RandomRequest[])('accepts and rejects concrete random outcomes for $type', request => {
    const selected = request.type === 'Shuffle' ? [b, a] : [b];
    const step: TurnStep = { type: 'Random', outcome: { type: request.type, cards: selected } };
    const before = structuredClone({ request, step });
    expect(() => assertRequestedInput(request, step)).not.toThrow();
    expect({ request, step }).toEqual(before);
    for (const cards of [[], [a, a], [other], [a, b, other]]) {
        expect(() => assertRequestedInput(request, { type: 'Random', outcome: { type: request.type, cards } })).toThrow();
    }
    expect(() => assertRequestedInput(request, { type: 'Decision', answer: { type: 'Choose Cards', cards: selected } })).toThrow();
});

it('orders every copy exactly once, without collapsing identical card definitions', () => {
    const request: Decision = { type: 'Order Cards', player: 1, cards: [a, b] };
    expect(() => assertRequestedInput(request, { type: 'Decision', answer: { type: 'Order Cards', cards: [b, a] } })).not.toThrow();
    for (const cards of [[a], [a, a], [a, other]]) {
        expect(() => assertRequestedInput(request, { type: 'Decision', answer: { type: 'Order Cards', cards } })).toThrow();
    }
});

it('chooses original modes, not positions in a filtered menu', () => {
    const request: Decision = { type: 'Choose Mode', player: 1, options: [{ mode: 2, effect: draw }] };
    expect(() => assertRequestedInput(request, { type: 'Decision', answer: { type: 'Choose Mode', mode: 2 } })).not.toThrow();
    expect(() => assertRequestedInput(request, { type: 'Decision', answer: { type: 'Choose Mode', mode: 0 } })).toThrow();
});

it.each([printed, gained, created])('selects actual trigger and replacement occurrences regardless of menu order: %j', rule => {
    const trigger: Decision = { type: 'Choose Trigger', player: 1, options: [
        { reference: { rule, event: 12 }, player: 1, effect: draw },
        { reference: { rule, event: 4 }, player: 1, effect: draw },
    ] };
    expect(() => assertRequestedInput(trigger, { type: 'Decision', answer: { type: 'Choose Trigger', trigger: { rule, event: 4 } } })).not.toThrow();
    expect(() => assertRequestedInput(trigger, { type: 'Decision', answer: { type: 'Choose Trigger', trigger: { rule, event: 0 } } })).toThrow();
    const replacement: Decision = { type: 'Choose Replacement', player: 1, options: [
        { reference: rule, player: 1, replacement: { event: { event: 'Deal Damage' } } },
    ] };
    expect(() => assertRequestedInput(replacement, { type: 'Decision', answer: { type: 'Choose Replacement', replacement: rule } })).not.toThrow();
    const absent = 99;
    expect(() => assertRequestedInput(replacement, { type: 'Decision', answer: { type: 'Choose Replacement', replacement: absent } })).toThrow();
});

it('records a collective payment and prevents outsiders, duplicate ink and mandatory refusal', () => {
    const request: Decision = { type: 'Pay Cost', player: { together: [1, 2] }, optional: false, cost: [{ type: 'Ink', amount: 3 }] };
    const answer: DecisionAnswer = { type: 'Pay Cost', pay: true, payment: [
        { type: 'Ink', player: 1, cards: [a], inkDrops: 1 },
        { type: 'Ink', player: 2, cards: [b] },
    ] };
    expect(() => assertRequestedInput(request, { type: 'Decision', answer })).not.toThrow();
    expect(() => assertRequestedInput(request, { type: 'Decision', answer: { type: 'Pay Cost', pay: false } })).toThrow();
    for (const payment of [
        [{ type: 'Ink', player: 3, cards: [a] }],
        [{ type: 'Ink', player: 1, cards: [a] }, { type: 'Ink', player: 2, cards: [a] }],
        [{ type: 'Lose Lore', player: 1, amount: -1 }],
        [{ type: 'Ink', player: 1, cards: [], inkDrops: 0.5 }],
    ] satisfies Extract<DecisionAnswer, { type: 'Pay Cost'; pay: true }>['payment'][]) {
        expect(() => assertRequestedInput(request, { type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment } })).toThrow();
    }
    // This boundary check intentionally does not decide whether the board can pay.
    expect(() => assertRequestedInput(request, { type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [] } })).not.toThrow();
});

it.each([
    [{ type: 'Choose Cards', player: { together: [1, 2] }, cards: [a, b], min: 1, max: 1 }, { type: 'Choose Cards', cards: [b] }],
    [{ type: 'Choose Player', player: 1, players: [2, 3] }, { type: 'Choose Player', player: 3 }],
    [{ type: 'Choose Amount', player: 1, min: 0, max: 2 }, { type: 'Choose Amount', amount: 2 }],
    [{ type: 'Optional', player: 1, effect: draw }, { type: 'Optional', accept: false }],
    [{ type: 'Optional Cost Rule', player: 1, rule: { type: 'Modify Cost', for: 'Play', cards: 'Self', amount: -1 } }, { type: 'Optional Cost Rule', accept: true }],
    [{ type: 'Name Card', player: 1 }, { type: 'Name Card', name: 'Merlin' }],
    [{ type: 'Distribute Damage Removal', player: 1, cards: [{ card: a, max: 2 }, { card: b, max: 1 }], max: 2 },
        { type: 'Distribute Damage Removal', amounts: [{ card: a, amount: 1 }, { card: b, amount: 1 }] }],
] satisfies [Decision, DecisionAnswer][])('checks decision type and candidate membership: %j', (request, answer) => {
    expect(() => assertRequestedInput(request, { type: 'Decision', answer })).not.toThrow();
    expect(() => assertRequestedInput(request, { type: 'Random', outcome: { type: 'Shuffle', cards: [] } })).toThrow();
    expect(() => assertRequestedInput(request, { type: 'Action', action: { type: 'End Turn', player: 1 } })).toThrow();
});

it('rejects fractional amounts, over-allocation and repeated healing targets', () => {
    expect(() => assertRequestedInput({ type: 'Choose Amount', player: 1, min: 0, max: 3 },
        { type: 'Decision', answer: { type: 'Choose Amount', amount: 1.5 } })).toThrow();
    const request: Decision = { type: 'Distribute Damage Removal', player: 1, cards: [{ card: a, max: 2 }, { card: b, max: 2 }], max: 2 };
    for (const amounts of [[{ card: a, amount: 3 }], [{ card: a, amount: 2 }, { card: b, amount: 1 }], [{ card: a, amount: 1 }, { card: a, amount: 1 }]]) {
        expect(() => assertRequestedInput(request, { type: 'Decision', answer: { type: 'Distribute Damage Removal', amounts } })).toThrow();
    }
});
