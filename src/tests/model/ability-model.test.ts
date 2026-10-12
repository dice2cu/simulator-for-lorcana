import { readFileSync, readdirSync } from 'node:fs';
import { expect, expectTypeOf, it } from 'vitest';
import type { Ability, CardRules, PlayRule, Cost, EventPattern, KeywordAbility, Amount, CardSelection, Condition, ContinuousRule, Effect, PlayerSelection, Comparison, CardFilter, PlayerChange } from '../../model/ability';
import { abilityExamples, actionCardExamples, cardRuleExamples, modifierExamples, playerModifierExamples, grantedAbilityExample } from '../../model/examples';
import { validateCardRules } from '../../model/validate';
import { cards as catalogCards } from '../fixtures/catalog';

it('represents deck-copy rules without removing catalog ability slots', () => {
    const catalog = { cards: catalogCards };
    const cases = [
        { card: 'Dalmatian Puppy - Tail Wagger', name: 'WHERE DID THEY ALL COME FROM?', maxCopies: 99,
          text: 'You may have up to 99 copies of Dalmatian Puppy - Tail Wagger in your deck.', next: undefined },
        { card: 'Microbots', name: 'LIMITLESS APPLICATIONS', maxCopies: 'Unlimited',
          text: 'You may have any number of cards named Microbots in your deck.', next: 'INSPIRED TECH' },
        { card: 'The Glass Slipper', name: 'PERFECT PAIR', maxCopies: 2,
          text: 'You may only have 2 copies of The Glass Slipper in your deck.', next: 'SEARCH THE KINGDOM' },
    ] as const;
    for (const example of cases) {
        const cards = catalog.cards.filter(card => card.fullName === example.card);
        expect(cards.length).toBeGreaterThan(0);
        for (const card of cards) {
            expect(card.abilities?.[0]?.name).toBe(example.name);
            expect(card.abilities?.[0]?.effect?.replace(/\s+/g, ' ').trim()).toBe(example.text);
            expect(card.abilities?.[1]?.name).toBe(example.next);
        }
        const ability: Ability = { type: 'Deck Construction', maxCopies: example.maxCopies, name: example.name };
        const rules: CardRules = { type: 'Item', abilities: [ability] };
        expect(validateCardRules(rules)).toEqual([]);
        expect(JSON.parse(JSON.stringify(ability))).toEqual(ability);
    }
});

it('validates numeric deck-copy limits without treating Unlimited as a number', () => {
    for (const maxCopies of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(validateCardRules({ type: 'Item', abilities: [{ type: 'Deck Construction', maxCopies }] })).not.toEqual([]);
    }
    expect(validateCardRules({ type: 'Item', abilities: [{ type: 'Deck Construction', maxCopies: 'Unlimited' }] })).toEqual([]);
});

it('uses one representation for each kind of granted ability', () => {
    type GrantedAbility = import('../../model/ability').GrantedAbility;
    expectTypeOf<Extract<import('../../model/ability').CardChange, { gainAbility: unknown }>['gainAbility']>().toEqualTypeOf<GrantedAbility>();
    expectTypeOf<Extract<import('../../model/game-state').CardModifier, { gainAbility: unknown }>['gainAbility']>().toEqualTypeOf<GrantedAbility>();
    expectTypeOf<{ type: 'Deck Construction'; maxCopies: 99 }>().not.toExtend<GrantedAbility>();
    expectTypeOf<{ type: 'Keyword'; keyword: { name: 'Rush' } }>().not.toExtend<GrantedAbility>();
    expectTypeOf<{ type: 'Keyword'; keyword: { name: 'Resist'; amount: 2 } }>().not.toExtend<GrantedAbility>();
    expectTypeOf<{ type: 'Keyword'; keyword: { name: 'Boost'; cost: [] } }>().toExtend<GrantedAbility>();
    expectTypeOf<{ type: 'Keyword'; keyword: { name: 'Shift'; cost: [] } }>().toExtend<GrantedAbility>();
    expectTypeOf<Exclude<Ability, { type: 'Keyword' | 'Deck Construction' }>>().toExtend<GrantedAbility>();
});

it('allows singing play rules only on actions', () => {
    expectTypeOf<{ type: 'Action'; effect: { type: 'Draw'; player: 'You'; amount: 1 }; playRules: [{ type: 'Sing Together'; cost: 7 }] }>().toExtend<CardRules>();
    type NonActionRules = Extract<CardRules, { type: 'Character' | 'Item' | 'Location' }>;
    expectTypeOf<NonNullable<NonActionRules['playRules']>[number]>().toEqualTypeOf<Exclude<PlayRule, { type: 'Sing' | 'Sing Together' }>>();
    expectTypeOf<{ type: 'Character'; abilities: []; playRules: [{ type: 'Sing'; cost: 3 }] }>().not.toExtend<CardRules>();
    expectTypeOf<{ type: 'Item'; abilities: []; playRules: [{ type: 'Sing Together'; cost: 7 }] }>().not.toExtend<CardRules>();
    expectTypeOf<{ type: 'Location'; abilities: []; playRules: [{ type: 'Sing'; cost: 3 }] }>().not.toExtend<CardRules>();
    expectTypeOf<{ type: 'Character'; abilities: []; playRules: [{ type: 'Alternate Cost'; cost: [] }] }>().toExtend<CardRules>();
    expectTypeOf<{ type: 'Location'; abilities: []; playRules: [{ type: 'Requirement'; when: { exists: 'Self' } }] }>().toExtend<CardRules>();
});

it('shares per-turn limit vocabulary without allowing meaningless counting modes', () => {
    expectTypeOf<Extract<Ability, { type: 'Activated' }>['limit']>().toEqualTypeOf<Extract<Ability, { type: 'Static' }>['limit']>();
    expectTypeOf<{ perTurn: 1; count: 'Occurrences' }>().not.toExtend<NonNullable<Extract<Ability, { type: 'Activated' }>['limit']>>();
    expectTypeOf<{ perTurn: 1; count: 'Uses' }>().not.toExtend<NonNullable<Extract<Ability, { type: 'Replacement' }>['replacement']['limit']>>();
    expectTypeOf<'usesPerTurn'>().not.toExtend<keyof Extract<Ability, { type: 'Activated' }>>();
    expectTypeOf<'firstPerTurn'>().not.toExtend<keyof Extract<Ability, { type: 'Replacement' }>['replacement']>();
});

it('represents Sing Together only as a play rule, while allowing keyword filters', () => {
    expectTypeOf<{ name: 'Sing Together'; amount: 7 }>().not.toExtend<KeywordAbility>();
    expectTypeOf<{ gainKeyword: 'Sing Together'; amount: 7 }>().not.toExtend<import('../../model/ability').CardChange>();
    expectTypeOf<{ keyword: 'Sing Together' }>().toExtend<CardFilter>();
    expectTypeOf<{ loseKeyword: 'Sing Together' }>().not.toExtend<import('../../model/ability').CardChange>();
    expectTypeOf<{ restriction: "Can't Gain Keyword"; keyword: 'Sing Together' }>().not.toExtend<import('../../model/ability').CardChange>();
    expectTypeOf<{ loseKeyword: 'Sing Together' }>().not.toExtend<import('../../model/game-state').CardModifier>();
    expectTypeOf<{ restriction: "Can't Gain Keyword"; keyword: 'Sing Together' }>().not.toExtend<import('../../model/game-state').CardModifier>();
    expectTypeOf<'name'>().not.toExtend<keyof Extract<Ability, { type: 'Keyword' }>>();
});

it('limits card filters on player prohibitions to playing cards', () => {
    expectTypeOf<{ restriction: "Can't Play"; where: { song: true } }>().toExtend<PlayerChange>();
    expectTypeOf<{ restriction: "Can't Gain Lore"; where: { song: true } }>().not.toExtend<PlayerChange>();
    expectTypeOf<{ restriction: "Can't Lose Lore"; where: { song: true } }>().not.toExtend<import('../../model/game-state').PlayerModifier>();
});

it('selects a free ability by printed title or Boost, but not both', () => {
    expectTypeOf<{ type: 'Free Ability'; cards: 'Self'; keyword: 'Boost' }>().toExtend<ContinuousRule>();
    expectTypeOf<{ type: 'Free Ability'; cards: 'Self'; name: 'SHAPESHIFT' }>().toExtend<ContinuousRule>();
    expectTypeOf<{ type: 'Free Ability'; cards: 'Self'; keyword: 'Resist' }>().not.toExtend<ContinuousRule>();
    expectTypeOf<{ type: 'Free Ability'; cards: 'Self'; keyword: 'Boost'; name: 'SHAPESHIFT' }>().not.toExtend<ContinuousRule>();
});

it('uses the same numeric comparisons in filters and conditions', () => {
    const comparisons: Comparison[] = [{ equal: 2 }, { lessThan: 2 }, { atMost: 2 }, { greaterThan: 2 }, { atLeast: 2 }];
    for (const comparison of comparisons) {
        const filter: CardFilter = { strength: comparison };
        const condition: Condition = { value: { stat: 'Strength', card: 'Self' }, is: comparison };
        expect(JSON.parse(JSON.stringify(condition)).is).toEqual(filter.strength);
    }
    expectTypeOf<Extract<Condition, { value: Amount }>['is']>().toEqualTypeOf<Comparison>();
    expectTypeOf<{ left: 1; comparison: 'At Least'; right: 2 }>().not.toExtend<Condition>();
});

it('expresses any matching card with exists and filter rather than a second quantifier', () => {
    expectTypeOf<{ exists: { filter: 'Selected Cards'; where: { classification: 'Dragon' } } }>().toExtend<Condition>();
    expectTypeOf<{ matches: 'Selected Cards'; where: {}; quantifier: 'Any' }>().not.toExtend<Condition>();
});

it('uses a live created rule for Atlantis and frozen targets for Kida', () => {
    expect(actionCardExamples.atlantis.effect).toEqual({
        type: 'Create Rule',
        rule: { type: 'Modify Cards', cards: { zone: 'Play', player: 'You', cardType: 'Character' }, modifier: { restriction: "Can't Be Challenged" } },
        duration: { until: 'Start Of Next Turn', player: 'You' },
    });
    expect(abilityExamples.kida.effect.type).toBe('Modify Cards');
    expectTypeOf<{ characters: { gainKeyword: 'Ward' } }>().not.toExtend<PlayerChange>();
});

it('keeps the review examples JSON-serializable', () => {
    expect(JSON.parse(JSON.stringify(abilityExamples))).toEqual(abilityExamples);
    expect(JSON.parse(JSON.stringify(actionCardExamples))).toEqual(actionCardExamples);
    expect(JSON.parse(JSON.stringify(cardRuleExamples))).toEqual(cardRuleExamples);
    expect(JSON.parse(JSON.stringify(modifierExamples))).toEqual(modifierExamples);
    expect(JSON.parse(JSON.stringify(playerModifierExamples))).toEqual(playerModifierExamples);
    expect(JSON.parse(JSON.stringify(grantedAbilityExample))).toEqual(grantedAbilityExample);
});

it('distinguishes explicit capture from the future rule event', () => {
    expectTypeOf<{ capture: 'Selected Cards' }>().toExtend<CardSelection>();
    expectTypeOf<{ capture: { result: 'Damage Removed' } }>().toExtend<Amount>();
    expectTypeOf<{ capture: 'Selected Player' }>().toExtend<PlayerSelection>();
    const createTrigger = actionCardExamples.nextStopOlympus.effect.effect.effects.find(effect => effect.type === 'Create Trigger');
    if (createTrigger === undefined) throw new Error('Next Stop, Olympus must create a one-use challenge trigger');
    expect(createTrigger.trigger.attacker).toEqual({ capture: 'Selected Cards' });
});

it('represents search, reveal-until and repetition without card-specific opcodes', () => {
    expect(abilityExamples.almaSearch.effect.effect.type).toBe('Search');
    expect(abilityExamples.fredRevealUntil.effect.effects[0]).toEqual({
        type: 'Reveal Until', player: 'You', where: { cardType: 'Character', classification: 'Floodborn' },
    });
    expect(abilityExamples.sisuRepeat.effect.until).toEqual({
        not: { every: { result: 'Revealed Cards' }, where: { cardType: 'Character', classification: 'Dragon' } },
    });
    expectTypeOf<{ type: 'Repeat'; times: 2; effect: { type: 'Draw'; player: 'You'; amount: 1 } }>().toExtend<Effect>();
});

it('supports cross-player aggregation and actual healed-card outputs', () => {
    expectTypeOf<{ result: 'Characters With Damage Removed' }>().toExtend<CardSelection>();
    expectTypeOf<{ distinct: 'Ink Type'; cards: { result: 'Revealed Cards' } }>().toExtend<Amount>();
    expect(abilityExamples.goofyHealing.effect.effects[1]).toEqual({ type: 'Ready', cards: { result: 'Characters With Damage Removed' } });
    expect(abilityExamples.headlessHorseman.effect.effects[1].type).toBe('For Each Player');
    expect(actionCardExamples.healingTotal.effect.effects[0]).toEqual({
        type: 'Remove Damage', cards: { zone: 'Play', player: 'You', cardType: 'Character' }, amount: { upTo: 4 }, distribution: 'Total',
    });
});

it('keeps printed identity outside state while describing genuine rule overrides', () => {
    expect(abilityExamples.turboShiftName.rule.modifier).toEqual({ countsAsName: 'King Candy', for: 'Shift' });
    expect(abilityExamples.elisaStatFloor.rule.modifier).toEqual({
        minimumStat: 'Strength', amount: { stat: 'Strength', card: 'Affected Card', printed: true },
    });
    expect(abilityExamples.captainAmelia.rule.modifier).toEqual({ restriction: "Can't Be Challenged", by: { classification: 'Pirate' } });
});

it('models active source areas, entry rules, and first-event versus chosen-use limits', () => {
    expect(abilityExamples.liloFromDiscard.from).toEqual(['Discard']);
    expect(abilityExamples.liloFromDiscard.effect).toEqual({ type: 'Optional', effect: { type: 'Play', cards: 'Self', exerted: true } });
    expect(abilityExamples.annaTemporaryShift.from).toEqual(['Hand']);
    expect(abilityExamples.entersWithDamage.rule).toEqual({ type: 'Enter Play', cards: 'Self', damage: 3 });
    expect(abilityExamples.powhatansStaff.effect.rule.exerted).toBe(true);
    expect(abilityExamples.liloFirstDamage.replacement.limit).toEqual({ perTurn: 1, count: "Occurrences" });
    expectTypeOf<{ type: 'Triggered'; trigger: { event: 'Quest' }; limit: { perTurn: 1; count: 'Occurrences' }; effect: { type: 'Draw'; player: 'You'; amount: 1 } }>().toExtend<Ability>();
    expectTypeOf<{ type: 'Triggered'; trigger: { event: 'Quest' }; limit: { perTurn: 1; count: 'Uses' }; effect: { type: 'Draw'; player: 'You'; amount: 1 } }>().toExtend<Ability>();
});

it('models replay destinations and instruction-specific Resist bypass', () => {
    expect(abilityExamples.ursulaReplay.effect).toEqual({ type: 'Optional', effect: { type: 'Play', cards: { event: 'Song' }, free: true, afterwards: 'Deck Bottom' } });
    expect(actionCardExamples.piercingAttack.effect.effect.ignoreResist).toBe(true);
    expectTypeOf<'ignoreResist'>().not.toExtend<keyof Extract<Effect, { type: 'Put Damage' }>>();
});

it('keeps two independent damage-movement targets without named bindings', () => {
    expectTypeOf<'Parent Selected Cards'>().toExtend<CardSelection>();
    expectTypeOf<'Parent Selected Cards'>().not.toExtend<PlayerSelection>();
    expect(abilityExamples.maleficent.effect.effect.effect.effect).toEqual({
        type: 'Move Damage', from: 'Parent Selected Cards', to: 'Selected Cards', amount: 1,
    });
});

it('represents random sampling separately from chosen cards and random ordering', () => {
    expectTypeOf<{ type: 'Random Cards'; from: 'Selected Cards'; count: 1; effect: { type: 'Discard'; cards: 'Selected Cards' } }>().toExtend<Effect>();
    expect(actionCardExamples.dangerousPlan.effect.effects[1]).toEqual({
        type: 'Random Cards', from: { zone: 'Hand', player: 'You' }, count: 1,
        effect: { type: 'Discard', cards: 'Selected Cards' },
    });
});

it('distinguishes whole-selection budgets and scalar characteristics', () => {
    expectTypeOf<{ sum: { stat: 'Strength'; cards: 'Selected Cards' } }>().toExtend<Amount>();
    expect(abilityExamples.leviathan.effect.effect.where).toEqual({ value: { sum: { stat: 'Strength', cards: 'Selected Cards' } }, is: { atMost: 10 } });
    expectTypeOf<{ matches: 'Selected Cards'; where: {} }>().not.toExtend<Condition>();
    expectTypeOf<{ every: 'Selected Cards'; where: {} }>().toExtend<Condition>();
});

it('gives named-card and same-character-name comparisons explicit consumers', () => {
    expect(abilityExamples.bruno.effect.effects[2].if).toEqual({
        every: { result: 'Revealed Cards' }, where: { namedCard: 'Named Card' },
    });
    const optionalPlay = abilityExamples.vinePod.effect.effect.effects.find(effect => effect.type === 'Optional');
    if (optionalPlay === undefined) throw new Error('Vine Pod must offer playing a same-named character');
    expect(optionalPlay.effect.from.where).toEqual({ sameNameAs: 'Selected Cards' });
});

it('represents singing and conditional alternate payments without interpreting text', () => {
    expect(actionCardExamples.secondStarToTheRight.playRules).toEqual([{ type: 'Sing Together', cost: 10 }]);
    expect(actionCardExamples.drawTwo.playRules).toEqual([{ type: 'Sing', cost: 3 }]);
    expectTypeOf<{ type: 'Sing Together' }>().not.toExtend<PlayRule>();
    expect(cardRuleExamples.clubDoor.playRules[0].cost).toEqual([]);
    expect(actionCardExamples.metamorphosis.effect.effect).toEqual({ type: 'Play', cards: 'Selected Cards', method: 'Shift', free: true });
});

it('describes event payment, banishment cause, singing, and transient turn queries', () => {
    expectTypeOf<{ event: 'Banish'; kind: 'Challenge'; source: 'Self' }>().toExtend<EventPattern>();
    expectTypeOf<{ event: 'Sing'; together: true; player: 'You' }>().toExtend<EventPattern>();
    expectTypeOf<{ event: 'Put Into Inkwell'; player: 'You' }>().toExtend<EventPattern>();
    expectTypeOf<{ event: 'Ink Paid' }>().toExtend<Amount>();
    expect(cardRuleExamples.escapePlan.playRules[0].when.value).toEqual({
        countEvents: { event: 'Move Card', to: 'Discard', player: 'You' }, during: 'This Turn',
    });
});

it('distinguishes additional payments from dependent effects', () => {
    expect(abilityExamples.rc.rule).toEqual({
        type: 'Additional Cost', cards: 'Self', for: ['Quest', 'Challenge'], cost: [{ type: 'Ink', amount: 1 }],
    });
    expect(abilityExamples.hercules.effect.effect.do).toEqual({ type: 'Discard', cards: { zone: 'Hand', player: 'You' } });
    const dependent = actionCardExamples.loseTheWay.effect.effect.effects.find(effect => effect.type === 'Optional');
    if (dependent === undefined) throw new Error('Lose the Way must offer its dependent effect');
    expect(dependent.effect.type).toBe('Do Then');
    expectTypeOf<{ performed: 'Optional Effect' }>().not.toExtend<Condition>();
});

it('puts action effects directly on cards, not in the ability union', () => {
    expectTypeOf<'Action'>().not.toExtend<Ability['type']>();
    expectTypeOf<Extract<CardRules, { type: 'Action' }>['effect']>().toEqualTypeOf<Effect>();
    expectTypeOf<Extract<CardRules, { type: 'Action' }>['abilities']>().toEqualTypeOf<Ability[] | undefined>();
    expectTypeOf<Extract<CardRules, { type: 'Character' | 'Item' | 'Location' }>['abilities']>().toEqualTypeOf<Ability[]>();
});

it('separates costs, resolving effects, and continuous rules', () => {
    expectTypeOf<Extract<Ability, { type: 'Activated' }>['cost']>().toEqualTypeOf<Cost[]>();
    expectTypeOf<{ type: 'Draw'; player: 'You'; amount: 2 }>().not.toExtend<ContinuousRule>();
    expectTypeOf<{ type: 'Optional'; effect: { type: 'Draw'; player: 'You'; amount: 1 } }>().not.toExtend<Cost>();
});

it('keeps player rules off individual cards', () => {
    type CardChange = import('../../model/ability').CardChange;
    type PlayerChange = import('../../model/ability').PlayerChange;
    type CardModifier = import('../../model/game-state').CardModifier;
    type PlayerModifier = import('../../model/game-state').PlayerModifier;
    expectTypeOf<{ restriction: "Can't Gain Lore" }>().not.toExtend<CardChange>();
    expectTypeOf<{ restriction: "Can't Play" }>().not.toExtend<CardModifier>();
    expectTypeOf<{ permission: 'Can Ink From Discard' }>().not.toExtend<CardChange>();
    expectTypeOf<{ permission: 'Can Play From Under' }>().not.toExtend<CardModifier>();
    expectTypeOf<{ restriction: "Can't Quest" }>().not.toExtend<PlayerChange>();
    expectTypeOf<{ permission: 'Can Challenge Ready Characters' }>().not.toExtend<PlayerModifier>();
    expectTypeOf<{ restriction: "Can't Lose Lore" }>().toExtend<PlayerChange>();
    expectTypeOf<{ permission: 'Can Play From Discard' }>().toExtend<PlayerModifier>();
});

it('uses control instructions rather than extra controls on play and payment', () => {
    type Play = Extract<Effect, { type: 'Play' }>;
    type PayCost = Extract<Effect, { type: 'Pay Cost' }>;
    expectTypeOf<'optional' | 'then' | 'otherwise'>().not.toExtend<keyof Play>();
    expectTypeOf<'optional'>().not.toExtend<keyof PayCost>();
    // @ts-expect-error Optional execution belongs on the enclosing Optional instruction.
    const optionalPlay: Effect = { type: 'Play', cards: 'Self', optional: true };
    // @ts-expect-error Play continuations belong on Do Then or Sequence.
    const playContinuation: Effect = { type: 'Play', cards: 'Self', then: { type: 'Draw', player: 'You', amount: 1 } };
    // @ts-expect-error Payment is offered by an enclosing Optional instruction.
    const optionalPayment: Effect = { type: 'Pay Cost', cost: [], optional: true, then: { type: 'Draw', player: 'You', amount: 1 } };
    void optionalPlay; void playContinuation; void optionalPayment;
});

it('requires exactly one repeat stopping rule', () => {
    expectTypeOf<{ type: 'Repeat'; until: { exists: 'Self' }; effect: { type: 'Draw'; player: 'You'; amount: 1 } }>().toExtend<Effect>();
    // @ts-expect-error A repeat cannot combine a count with a stopping condition.
    const ambiguous: Effect = { type: 'Repeat', times: 2, until: { exists: 'Self' }, effect: { type: 'Draw', player: 'You', amount: 1 } };
    // @ts-expect-error A repeat needs a count or a stopping condition.
    const unbounded: Effect = { type: 'Repeat', effect: { type: 'Draw', player: 'You', amount: 1 } };
    void ambiguous; void unbounded;
});

it('requires the appropriate keyword parameters', () => {
    // @ts-expect-error Resist requires an amount.
    const missingAmount: KeywordAbility = { name: 'Resist' };
    // @ts-expect-error Evasive does not take an amount.
    const extraAmount: KeywordAbility = { name: 'Evasive', amount: 2 };
    // @ts-expect-error Shift requires a cost.
    const missingCost: KeywordAbility = { name: 'Shift' };
    void missingAmount;
    void extraAmount;
    void missingCost;
    // @ts-expect-error Granted Resist also requires an amount.
    const missingGrantAmount: import('../../model/ability').CardChange = { gainKeyword: 'Resist' };
    // @ts-expect-error Granted Ward has no numeric parameter.
    const extraGrantAmount: import('../../model/ability').CardChange = { gainKeyword: 'Ward', amount: 2 };
    // @ts-expect-error A Shift grant needs its complete keyword definition.
    const incompleteShift: import('../../model/ability').CardChange = { gainKeyword: 'Shift' };
    // @ts-expect-error Cards put under a card must identify that card.
    const missingUnder: Effect = { type: 'Move Card', cards: 'Self', to: 'Under', faceDown: true };
    // @ts-expect-error Ordering belongs only to deck movement.
    const handOrder: Effect = { type: 'Move Card', cards: 'Self', to: 'Hand', order: 'Chosen' };
    // @ts-expect-error Shuffling and chosen ordering cannot both apply.
    const shuffleOrder: Effect = { type: 'Move Card', cards: 'Self', to: 'Deck', position: 'Shuffle', order: 'Chosen' };
    void missingGrantAmount; void extraGrantAmount; void incompleteShift;
    void missingUnder; void handOrder; void shuffleOrder;
});

it('uses fixed, typed context references instead of arbitrary binding names', () => {
    expectTypeOf<'Selected Cards'>().toExtend<CardSelection>();
    expectTypeOf<'Selected Player'>().toExtend<PlayerSelection>();
    expectTypeOf<'Selected Player'>().not.toExtend<CardSelection>();
    expectTypeOf<'Selected Cards'>().not.toExtend<PlayerSelection>();
    expectTypeOf<{ result: 'Looked At Cards' }>().toExtend<CardSelection>();
    expectTypeOf<{ result: 'Damage Removed' }>().toExtend<Amount>();
    expectTypeOf<{ result: 'Damage Removed' }>().not.toExtend<CardSelection>();
    expectTypeOf<{ result: 'Looked At Cards' }>().not.toExtend<Amount>();
    expectTypeOf<{ result: 'healing' }>().not.toExtend<Amount>();
    expectTypeOf<{ chosen: 'target' }>().not.toExtend<CardSelection>();
    expectTypeOf<'as'>().not.toExtend<keyof Extract<Effect, { type: 'Choose Cards' }>>();
    expectTypeOf<'as'>().not.toExtend<keyof Extract<Cost, { type: 'Choose Cards' }>>();
});

it('reuses fixed references in healing and deck rearrangement examples', () => {
    expect(abilityExamples.rapunzelHealing.effect.effect.effects).toEqual([
        { type: 'Remove Damage', cards: 'Selected Cards', amount: { upTo: 3 } },
        { type: 'Draw', player: 'You', amount: { result: 'Damage Removed' } },
    ]);
    const [look, chooseTop] = actionCardExamples.waterHasMemory.effect.effect.effects;
    expect(look).toEqual({
        type: 'Look', cards: { zone: 'Deck', player: 'Selected Player', take: 4 },
    });
    expect(chooseTop).toEqual({
        type: 'Choose Cards', from: { result: 'Looked At Cards' }, count: 1,
        effect: {
            type: 'Sequence', effects: [
                { type: 'Move Card', cards: 'Selected Cards', to: 'Deck', position: 'Top' },
                {
                    type: 'Move Card',
                    cards: { difference: [{ result: 'Looked At Cards' }, 'Selected Cards'] },
                    to: 'Deck', position: 'Bottom', order: 'Chosen',
                },
            ],
        },
    });
});
it('keeps model imports acyclic, including type-only imports', () => {
    const directory = 'src/model';
    const dependencies = new Map(readdirSync(directory).filter(file => file.endsWith('.ts')).map(file => {
        const source = readFileSync(`${directory}/${file}`, 'utf8');
        const imports = [...source.matchAll(/from\s+["']\.\/([^"']+)["']/g)].map(match => `${match[1]}.ts`);
        return [file, imports];
    }));
    while (dependencies.size > 0) {
        const leaves = [...dependencies].filter(([, imports]) => imports.every(file => !dependencies.has(file)));
        expect(leaves.length, `Circular model imports remain among: ${[...dependencies.keys()].join(', ')}`).toBeGreaterThan(0);
        for (const [file] of leaves) dependencies.delete(file);
    }
});
