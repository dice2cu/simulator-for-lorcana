/** Representability tests, not execution tests or a TCG format converter. */
import { expect, expectTypeOf, it } from 'vitest';
import type { Ability, CardRules, KeywordAbility, Amount, ContinuousRule, Effect } from '../../model/ability';
import type { CardModifier, PlayerModifier } from '../../model/game-state';
import { validateCardRules } from '../../model/validate';

const you = { zone: 'Play', player: 'You', cardType: 'Character' } as const;
const opponents = { zone: 'Play', player: 'Opponents', cardType: 'Character' } as const;

const examples = {
    'bottom-deck draw': { type: 'Action', effect: { type: 'Draw', player: 'You', amount: 1, from: 'Bottom' } },
    'private bottom-deck look': { type: 'Action', effect: { type: 'Look', cards: { zone: 'Deck', player: 'You', position: 'Bottom', take: 3 } } },
    'move the pre-banishment under-stack': { type: 'Character', abilities: [{ type: 'Triggered', trigger: { event: 'Banish', card: 'Self' },
        effect: { type: 'Move Card', cards: { atEvent: 'Before', cards: { zone: 'Under', under: { event: 'Card' } } }, to: 'Deck', position: 'Bottom', order: 'Random' },
    }] },
    'put under this specific character this turn': { type: 'Character', abilities: [{ type: 'Static', rule: {
        type: 'Conditional', if: { value: { countEvents: { event: 'Put Under', under: 'Self', player: 'You' }, during: 'This Turn' }, is: { atLeast: 1 } },
        then: { type: 'Modify Cards', cards: 'Self', modifier: { gainKeyword: 'Ward' } },
    } }] },
    'number of singers for this song play': { type: 'Character', abilities: [{ type: 'Triggered', trigger: { event: 'Play', card: { zone: 'Any', where: { song: true } } },
        effect: { type: 'Draw', player: 'You', amount: { count: { event: 'Singers' } } },
    }] },
    'live challenge defender restriction': { type: 'Character', abilities: [{ type: 'Static', rule: {
        type: 'Conditional', if: { and: [{ inChallenge: 'Self', role: 'Attacker' },
            { every: { challengeParticipant: 'Defender' }, where: { cardType: 'Character', damage: { atLeast: 1 } } }] },
        then: { type: 'Modify Cards', cards: 'Self', modifier: { gainKeyword: 'Resist', amount: 2 } },
    } }] },
    'draw to hand size': { type: 'Action', effect: {
        type: 'Draw', player: 'You', amount: { max: [0, { subtract: [7, { count: { zone: 'Hand', player: 'You' } }] }] },
    } },
    'printed stat floor': { type: 'Character', abilities: [{ type: 'Static', rule: {
        type: 'Modify Cards', cards: you, modifier: { minimumStat: 'Strength', amount: { stat: 'Strength', card: 'Affected Card', printed: true } },
    } }] },
    'location-specific free movement': { type: 'Location', abilities: [{ type: 'Static', rule: {
        type: 'Alternate Cost', cards: { ...you, where: { name: 'Magic Broom' } }, for: 'Move', location: 'Self', cost: [],
    } }] },
    'location-specific movement reduction': { type: 'Location', abilities: [{ type: 'Static', rule: {
        type: 'Modify Cost', cards: you, for: 'Move', location: 'Self', amount: -1,
    } }] },
    'continuous top-card visibility': { type: 'Character', abilities: [{ type: 'Static', rule: {
        type: 'Reveal Cards', cards: { zone: 'Deck', player: 'Opponents', take: 1 },
    } }] },
    'shared distinct challenger limit': { type: 'Character', abilities: [{ type: 'Static', rule: {
        type: 'Modify Players', players: 'All', modifier: { challengeLimit: 1, count: 'Characters', players: 'All' },
    } }] },
    'characters that sang this turn': { type: 'Action', effect: {
        type: 'Ready', cards: { events: { event: 'Sing', player: 'You' }, during: 'This Turn', role: 'Singers' },
    } },
    'characters that challenged this turn': { type: 'Action', effect: {
        type: 'Exert', cards: { events: { event: 'Challenge' }, during: 'This Turn', role: 'Attacker' },
    } },
    'highest group characteristic': { type: 'Character', abilities: [{ type: 'Static', rule: {
        type: 'Conditional', if: { and: [
            { exists: opponents },
            { value: { stat: 'Strength', card: 'Self' }, is: { greaterThan: { highest: { stat: 'Strength', cards: opponents } } } },
        ] }, then: { type: 'Modify Cards', cards: 'Self', modifier: { gainKeyword: 'Ward' } },
    } }] },
    'first turn condition': { type: 'Character', abilities: [{ type: 'Static', from: ['Hand'], rule: {
        type: 'Conditional', if: { value: { turnsTaken: 'You' }, is: { equal: 0 } },
        then: { type: 'Modify Cost', cards: 'Self', amount: -1, for: 'Play' },
    } }] },
    'challenge-only temporary change': { type: 'Character', abilities: [{ type: 'Triggered', trigger: { event: 'Challenge', attacker: 'Self' },
        effect: { type: 'Modify Cards', cards: 'Self', modifier: { stat: 'Strength', amount: 2 }, duration: { until: 'End Of Challenge' } },
    }] },
    'permanent change until zone exit': { type: 'Action', effect: { type: 'Choose Cards', from: you, count: 1,
        effect: { type: 'Modify Cards', cards: 'Selected Cards', modifier: { gainKeyword: 'Ward' } },
    } },
    'opponent orders their own deck': { type: 'Action', effect: { type: 'Choose Player', from: 'Opponents', effect: {
        type: 'Move Card', cards: { zone: 'Deck', player: 'Selected Player', take: 3 }, to: 'Deck', position: 'Bottom', order: 'Chosen', player: 'Selected Player',
    } } },
    'play or shift effect': { type: 'Action', effect: { type: 'Choose Cards', from: { zone: 'Hand', player: 'You', cardType: 'Character' }, count: 1,
        effect: { type: 'Play', cards: 'Selected Cards', method: 'Play Or Shift', free: true },
    } },
    'two individually named Shift bases': { type: 'Character', abilities: [{ type: 'Keyword', keyword: {
        name: 'Shift', cost: [{ type: 'Ink', amount: 3 }], count: 2, names: ['Anna', 'Elsa'],
    } }] },
    'one or two differently named bases': { type: 'Character', abilities: [{ type: 'Keyword', keyword: {
        name: 'Shift', cost: [{ type: 'Ink', amount: 3 }], count: 'One Or Two',
        onto: { ...you, where: { or: [{ name: 'Baloo' }, { name: 'Mowgli' }] } }, when: { differentNames: 'Selected Cards' },
    } }] },
    'item-base Shift': { type: 'Character', abilities: [{ type: 'Keyword', keyword: {
        name: 'Shift', cost: [{ type: 'Ink', amount: 2 }], onto: { zone: 'Play', player: 'You', cardType: 'Item', where: { name: 'Potato' } },
    } }] },
    'temporary Shift': { type: 'Character', abilities: [{ type: 'Keyword', keyword: {
        name: 'Shift', cost: [{ type: 'Ink', amount: 3 }], afterShift: { type: 'Delay', until: { turnEnd: 'You' },
            effect: { type: 'Move Card', cards: { capture: 'Self' }, to: 'Hand', wholeStack: false } },
    } }] },
    'numeric self replacement': { type: 'Action', effect: { type: 'Choose Cards', from: opponents, count: 1,
        effect: { type: 'Conditional', if: { every: 'Selected Cards', where: { classification: 'Villain' } },
            then: { type: 'Deal Damage', cards: 'Selected Cards', amount: 4 }, otherwise: { type: 'Deal Damage', cards: 'Selected Cards', amount: 2 } },
    } },
    'pre-banishment cards under the event character': { type: 'Character', abilities: [{ type: 'Triggered', trigger: { event: 'Banish', card: 'Self' },
        effect: { type: 'Draw', player: 'You', amount: { atEvent: 'Before', value: { count: { zone: 'Under', under: { event: 'Card' } } } } },
    }] },
    'partial damage prevention preserving its source': { type: 'Character', abilities: [{ type: 'Replacement', replacement: {
        event: { event: 'Deal Damage', card: 'Self' }, damage: { amount: { max: [0, { subtract: [{ event: 'Amount' }, 2] }] } },
    } }] },
    'all players tied for largest hand': { type: 'Action', effect: { type: 'For Each Player', players: {
        from: 'All', rank: { order: 'Highest', by: { count: { zone: 'Hand', player: 'Selected Player' } } },
        where: { value: { count: { zone: 'Hand', player: 'Selected Player' } }, is: { atLeast: 1 } },
    }, effect: { type: 'Choose Cards', from: { zone: 'Hand', player: 'Selected Player' }, count: 2, player: 'Selected Player',
        effect: { type: 'Discard', cards: 'Selected Cards' } } } },
    'optional once-per-turn movement discount': { type: 'Character', abilities: [{ type: 'Static', limit: { perTurn: 1, count: "Uses" },
        rule: { type: 'Conditional', if: { duringTurnOf: 'You' }, then: { type: 'Modify Cost', cards: 'Self', for: 'Move', amount: -1, optional: true } },
    }] },
    'discards caused by effects only': { type: 'Character', abilities: [{ type: 'Replacement', replacement: {
        event: { event: 'Discard', player: 'You', kind: 'Effect' },
    } }] },
    'opposing players choosing together': { type: 'Action', effect: { type: 'Choose Cards', player: { together: 'Opponents' },
        from: { zone: 'Play', player: 'You', cardType: 'Item' }, count: 1, effect: { type: 'Banish', cards: 'Selected Cards' },
    } },
    'group activation with each player paying': { type: 'Character', abilities: [{ type: 'Activated', by: { together: 'Opponents' },
        cost: [{ type: 'Ink', amount: 3, each: true }], effect: { type: 'Banish', cards: 'Self' }, when: { duringTurnOf: 'Opponents' },
    }] },
    'alternate non-ink Shift payment in chosen order': { type: 'Character', abilities: [{ type: 'Static', from: ['Hand'], rule: {
        type: 'Alternate Cost', cards: 'Self', for: 'Shift', cost: [
            { type: 'Choose Cards', from: { zone: 'Discard', player: 'You', cardType: 'Character' }, count: 5,
                cost: [{ type: 'Move Card', cards: 'Selected Cards', to: 'Deck Bottom', order: 'Chosen' }] },
        ],
    } }] },
} satisfies Record<string, CardRules>;

for (const [name, rules] of Object.entries(examples)) {
    it(`represents TCG capability: ${name}`, () => {
        expect(validateCardRules(rules)).toEqual([]);
        expect(JSON.parse(JSON.stringify(rules))).toEqual(rules);
    });
}

it('rejects ill-defined Shift name assignments', () => {
    const badShift: CardRules = { type: 'Character', abilities: [{ type: 'Keyword', keyword: { name: 'Shift', cost: [], count: 2, names: ['Anna'] } }] };
    expect(validateCardRules(badShift).map(issue => issue.path)).toEqual(['abilities[0].keyword.names']);
});

it('rejects empty extrema and negative challenge limits', () => {
    expect(validateCardRules({ type: 'Action', effect: { type: 'Draw', player: 'You', amount: { max: [] } } })).toHaveLength(1);
    expect(validateCardRules({ type: 'Action', effect: { type: 'Draw', player: 'You', amount: { highest: { stat: 'Lore', cards: { cards: [] } } } } })).toHaveLength(1);
    expect(validateCardRules({ type: 'Character', abilities: [{ type: 'Static', rule: {
        type: 'Modify Players', players: 'All', modifier: { challengeLimit: -1, count: 'Characters', players: 'All' },
    } }] })).toHaveLength(1);
});

it('does not consume a passive stat on recomputation or silently invent a static use event', () => {
    expect(validateCardRules({ type: 'Character', abilities: [{ type: 'Static', limit: { perTurn: 1, count: "Uses" },
        rule: { type: 'Modify Cards', cards: 'Self', modifier: { stat: 'Strength', amount: 1 } },
    }] })).toEqual([{ path: 'abilities[0].limit.perTurn', message: 'A static use limit requires an action/entry rule, not a passive modifier.' }]);
});

it('scopes the candidate player inside ranking without leaking it to the surrounding effect', () => {
    expect(validateCardRules({ type: 'Action', effect: { type: 'Draw', player: 'You', amount: {
        count: { zone: 'Hand', player: { from: 'Opponents', rank: { order: 'Highest', by: { lore: 'Selected Player' } } } },
    } } })).toEqual([]);
    expect(validateCardRules({ type: 'Action', effect: { type: 'Sequence', effects: [
        { type: 'Draw', player: { from: 'All', where: { value: { lore: 'Selected Player' }, is: { atLeast: 5 } } }, amount: 1 },
        { type: 'Draw', player: 'Selected Player', amount: 1 },
    ] } })).toEqual([{ path: 'effect.effects[1].player', message: 'Selected Player requires an enclosing player selection.' }]);
});

it('validates event-history roles in the history context, not the current trigger', () => {
    expect(validateCardRules({ type: 'Action', effect: { type: 'Ready', cards: { events: { event: 'Draw' }, during: 'This Turn', role: 'Attacker' } } })).toEqual([
        { path: 'effect.cards.role', message: 'Attacker is unavailable for these history events.' },
    ]);
    expect(validateCardRules({ type: 'Action', effect: { type: 'Ready', cards: {
        events: { anyOf: [{ event: 'Sing' }, { event: 'Draw' }] }, during: 'This Turn', role: 'Singers',
    } } })).toHaveLength(1);
    expect(validateCardRules({ type: 'Action', effect: { type: 'Draw', player: 'You',
        amount: { atEvent: 'Before', value: { stat: 'Strength', card: 'Self' } },
    } })).toHaveLength(1);
});

it('adjusts only proposed damage, keeping its source', () => {
    expect(validateCardRules({ type: 'Character', abilities: [{ type: 'Replacement', replacement: {
        event: { event: 'Banish' }, damage: { amount: 1 },
    } }] })).toHaveLength(1);
});

it('requires a location only for movement', () => {
    expectTypeOf<{ type: 'Alternate Cost'; cards: 'Self'; for: 'Move'; location: 'Self'; cost: [] }>().toExtend<ContinuousRule>();
    // @ts-expect-error A destination location has no meaning for normal play cost.
    const invalid: ContinuousRule = { type: 'Modify Cost', cards: 'Self', for: 'Play', location: 'Self', amount: -1 };
    void invalid;
    expectTypeOf<{ setStat: 'Strength'; amount: 0 }>().not.toExtend<CardModifier>();
    expectTypeOf<{ challengeLimit: 1; count: 'Characters'; players: 'All' }>().toExtend<PlayerModifier>();
    expectTypeOf<{ challengeLimit: 1 }>().not.toExtend<PlayerModifier>();
    expectTypeOf<{ highest: { stat: 'Strength'; cards: 'Self' } }>().toExtend<Amount>();
    expectTypeOf<{ name: 'Shift'; cost: []; names: ['Anna', 'Elsa']; count: 2 }>().toExtend<KeywordAbility>();
    expectTypeOf<{ type: 'Draw'; player: 'You'; amount: 1; from: 'Bottom' }>().toExtend<Effect>();
    expectTypeOf<{ type: 'Triggered'; trigger: { event: 'Draw' }; effect: { type: 'Draw'; player: 'You'; amount: 1 } }>().toExtend<Ability>();
});

it('rejects bottom selection in other zones and event reads without an event', () => {
    expect(validateCardRules({ type: 'Action', effect: { type: 'Look', cards: { zone: 'Hand', position: 'Bottom', take: 1 } } })).toHaveLength(1);
    expect(validateCardRules({ type: 'Action', effect: { type: 'Look', cards: { atEvent: 'Before', cards: 'Self' } } })).toHaveLength(1);
    expect(validateCardRules({ type: 'Character', abilities: [{ type: 'Replacement', replacement: {
        event: { event: 'Deal Damage' }, damage: { amount: -1 },
    } }] })).toHaveLength(1);
});
