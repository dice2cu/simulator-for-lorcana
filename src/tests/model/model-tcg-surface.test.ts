/** Named counterparts for the supplied TCG Effect/StaticEffect union members.
 * This checks the declarative surface, not a converter or execution equivalence.
 * Legacy aliases share fixtures rather than adding opcodes to our model.
 */
import { expect, it } from 'vitest';
import type { CardRules } from '../../model/ability';
import { abilityExamples, actionCardExamples } from '../../model/examples';
import { validateCardRules } from '../../model/validate';

const character = { zone: 'Play', cardType: 'Character' } as const;
const hand = { zone: 'Hand', player: 'You' } as const;
const top = { zone: 'Deck', player: 'You', take: 3 } as const;

const families = [
    { tcg: ['DrawEffect', 'DrawUntilHandSizeEffect', 'DrawUntilEffect'], rules: { type: 'Action', effect: {
        type: 'Draw', player: 'You', amount: { max: [0, { subtract: [7, { count: hand }] }] },
    } } },
    { tcg: ['DiscardEffect', 'DiscardUntilEffect'], rules: { type: 'Action', effect: {
        type: 'Choose Cards', from: hand, player: 'You', count: { max: [0, { subtract: [{ count: hand }, 2] }] },
        effect: { type: 'Discard', cards: 'Selected Cards' },
    } } },
    { tcg: ['MillEffect'], rules: { type: 'Action', effect: { type: 'Move Card', cards: top, to: 'Discard' } } },
    { tcg: ['ScryEffect', 'PutOnDeckEffect'], rules: actionCardExamples.waterHasMemory },
    { tcg: ['DealDamageEffect', 'TakeDamageEffect'], rules: { type: 'Action', effect: {
        type: 'Choose Cards', from: character, count: 1, effect: { type: 'Deal Damage', cards: 'Selected Cards', amount: 2, ignoreResist: true },
    } } },
    { tcg: ['PutDamageEffect'], rules: { type: 'Action', effect: { type: 'Put Damage', cards: character, amount: 1 } } },
    { tcg: ['RemoveDamageEffect', 'HealEffect'], rules: { type: 'Action', effect: { type: 'Sequence', effects: [
        { type: 'Remove Damage', cards: character, amount: { upTo: 3 }, distribution: 'Total' },
        { type: 'Ready', cards: { result: 'Characters With Damage Removed' } },
    ] } } },
    { tcg: ['MoveDamageEffect'], rules: { type: 'Action', effect: {
        type: 'Choose Cards', from: character, count: 1, effect: { type: 'Choose Cards', from: { ...character, exclude: 'Selected Cards' }, count: 1,
            effect: { type: 'Move Damage', from: 'Parent Selected Cards', to: 'Selected Cards', amount: { upTo: 2 } } },
    } } },
    { tcg: ['GainLoreEffect', 'LoseLoreEffect', 'LoreLossEffect'], rules: { type: 'Action', effect: { type: 'Sequence', effects: [
        { type: 'Lose Lore', player: 'Opponents', amount: 2 },
        { type: 'Gain Lore', player: 'You', amount: { result: 'Lore Lost' } },
    ] } } },
    { tcg: ['ExertEffect', 'ReadyEffect', 'BanishEffect', 'SelectTargetEffect'], rules: { type: 'Action', effect: {
        type: 'Choose Cards', from: character, count: 1, effect: { type: 'Sequence', effects: [
            { type: 'Exert', cards: 'Selected Cards' }, { type: 'Ready', cards: 'Selected Cards' }, { type: 'Banish', cards: 'Selected Cards' },
        ] },
    } } },
    { tcg: ['ReturnToHandEffect', 'ReturnFromDiscardEffect', 'PutInHandEffect', 'PutIntoHandEffect'], rules: { type: 'Action', effect: {
        type: 'Choose Cards', from: { zone: 'Discard', player: 'You', where: { song: true, cost: { atMost: 4 } } }, count: { upTo: 1 },
        effect: { type: 'Move Card', cards: 'Selected Cards', to: 'Hand' },
    } } },
    { tcg: ['ReturnRandomFromInkwellEffect'], rules: { type: 'Action', effect: { type: 'For Each Player', players: 'All', effect: {
        type: 'Random Cards', from: { zone: 'Inkwell', player: 'Selected Player' },
        count: { max: [0, { subtract: [{ count: { zone: 'Inkwell', player: 'Selected Player' } }, 3] }] },
        effect: { type: 'Move Card', cards: 'Selected Cards', to: 'Hand' },
    } } } },
    { tcg: ['PutIntoInkwellEffect', 'AddToInkwellEffect', 'MoveToInkwellEffect'], rules: { type: 'Action', effect: {
        type: 'Move Card', cards: top, to: 'Inkwell', exerted: true,
    } } },
    { tcg: ['PutUnderEffect', 'PutCardUnderEffect', 'MoveCardsFromUnderEffect'], rules: { type: 'Character', abilities: [{ type: 'Activated', cost: [], effect: {
        type: 'Move Card', cards: { zone: 'Under', under: 'Self' }, to: 'Under',
        under: { zone: 'Play', player: 'You', cardType: 'Item', where: { name: 'The Black Cauldron' } }, faceDown: false,
    } }] } },
    { tcg: ['ShuffleIntoDeckEffect'], rules: { type: 'Action', effect: { type: 'Move Card', cards: character, to: 'Deck', position: 'Shuffle', wholeStack: true } } },
    { tcg: ['PutOnBottomEffect', 'PutOnTopEffect'], rules: { type: 'Action', effect: { type: 'Choose Player', from: 'Opponents', effect: {
        type: 'Move Card', cards: { zone: 'Play', player: 'Selected Player' }, to: 'Deck', position: 'Top', order: 'Chosen', player: 'Selected Player',
    } } } },
    { tcg: ['PlayCardEffect', 'PlayForFreeEffect'], rules: { type: 'Action', effect: { type: 'Choose Cards', from: hand, count: 1, effect: {
        type: 'Optional', effect: { type: 'Do Then',
            do: { type: 'Play', cards: 'Selected Cards', method: 'Play Or Shift', free: true, exerted: true },
            then: { type: 'Sequence', effects: [
                { type: 'Modify Cards', cards: 'Selected Cards', modifier: { gainKeyword: 'Rush' }, duration: { until: 'End Of Turn' } },
                { type: 'Delay', until: { turnEnd: 'You' }, effect: { type: 'Banish', cards: { capture: 'Selected Cards' } } },
            ] } },
    } } } },
    { tcg: ['EnablePlayFromDiscardEffect', 'PlayFromDiscardEffect'], rules: { type: 'Character', abilities: [{ type: 'Static', rule: {
        type: 'Conditional', if: { every: 'Self', where: { exerted: true } },
        then: { type: 'Modify Players', players: 'You', modifier: { permission: 'Can Play From Discard',
            cards: { zone: 'Discard', player: 'You', cardType: 'Character' }, exerted: true } },
    } }] } },
    { tcg: ['EnablePlayFromUnderEffect'], rules: { type: 'Item', abilities: [{ type: 'Static', rule: {
        type: 'Modify Players', players: 'You', modifier: { permission: 'Can Play From Under', cards: { zone: 'Under', under: 'Self', cardType: 'Character' } },
    } }] } },
    { tcg: ['MoveToLocationEffect', 'MoveEffect'], rules: { type: 'Character', abilities: [{ type: 'Activated', cost: [], effect: {
        type: 'Choose Cards', from: { zone: 'Play', player: 'You', cardType: 'Location' }, count: 1, effect: { type: 'Sequence', effects: [
            { type: 'Move To Location', cards: { union: ['Self', { ...character, player: 'You', exclude: 'Self' }] }, location: 'Selected Cards', free: true },
            { type: 'Gain Lore', player: 'You', amount: { count: { result: 'Moved Cards' } } },
        ] },
    } }] } },
    { tcg: ['MoveCostReductionEffect'], rules: { type: 'Character', abilities: [abilityExamples.rakshaMovement] } },
    { tcg: ['GrantAbilitiesWhileHereEffect'], rules: { type: 'Location', abilities: [{ type: 'Static', rule: { type: 'Together', rules: [
        { type: 'Modify Cards', cards: { ...character, where: { at: 'Self' } }, modifier: { gainKeyword: 'Ward' } },
        { type: 'Modify Cards', cards: { ...character, where: { at: 'Self' } }, modifier: { gainAbility: {
            type: 'Activated', cost: [{ type: 'Exert', cards: 'Self' }], effect: { type: 'Draw', player: 'You', amount: 1 },
        } } },
    ] } }] } },
    { tcg: ['ModifyStatEffect', 'StatFloorEffect'], rules: { type: 'Character', abilities: [{ type: 'Static', rule: { type: 'Together', rules: [
        { type: 'Modify Cards', cards: 'Self', modifier: { stat: 'Strength', amount: { count: { zone: 'Play', player: 'You', cardType: 'Item' } } } },
        { type: 'Modify Cards', cards: 'Self', modifier: { minimumStat: 'Strength', amount: { stat: 'Strength', card: 'Self', printed: true } } },
    ] } }] } },
    { tcg: ['DamageSourceStatOverrideEffect'], rules: { type: 'Character', abilities: [{ type: 'Static', rule: { type: 'Challenge Damage', cards: character, stat: 'Willpower' } }] } },
    { tcg: ['GainKeywordEffect', 'GrantKeywordEffect', 'GrantKeywordsEffect', 'GainKeywordsEffect', 'LoseKeywordEffect'], rules: { type: 'Action', effect: {
        type: 'Sequence', effects: [
            { type: 'Modify Cards', cards: character, modifier: { gainKeyword: 'Resist', amount: 2 }, duration: { until: 'End Of Turn' } },
            { type: 'Modify Cards', cards: character, modifier: { gainKeyword: 'Rush' }, duration: { until: 'End Of Turn' } },
            { type: 'Modify Cards', cards: character, modifier: { loseKeyword: 'Ward' }, duration: { until: 'End Of Turn' } },
        ],
    } } },
    { tcg: ['RestrictionEffect', 'ChallengeReadyEffect'], rules: { type: 'Character', abilities: [{ type: 'Static', rule: { type: 'Together', rules: [
        { type: 'Modify Cards', cards: 'Self', modifier: { restriction: "Can't Be Challenged", by: { cost: { atMost: 3 } } } },
        { type: 'Modify Cards', cards: 'Self', modifier: { permission: 'Can Challenge Ready Characters' } },
        { type: 'Additional Cost', cards: 'Self', for: ['Quest', 'Challenge'], cost: [{ type: 'Ink', amount: 1 }] },
    ] } }] } },
    { tcg: ['GrantAbilityEffect', 'GainAbilityEffect'], rules: { type: 'Action', effect: {
        type: 'Modify Cards', cards: character, modifier: { gainAbility: { type: 'Triggered', trigger: { event: 'Quest', card: 'Self' },
            effect: { type: 'Optional', effect: { type: 'Draw', player: 'You', amount: 1 } } } }, duration: { until: 'End Of Turn' },
    } } },
    { tcg: ['CostReductionEffect', 'CostIncreaseEffect'], rules: { type: 'Item', abilities: [abilityExamples.lantern, { type: 'Static', rule: {
        type: 'Modify Cost', cards: { zone: 'Any', where: { or: [{ cardType: 'Action' }, { cardType: 'Item' }] } }, for: 'Play', amount: 2,
    } }] } },
    { tcg: ['NameACardEffect', 'RevealAndConditionalEffect', 'RevealAndRouteEffect'], rules: { type: 'Action', effect: { type: 'Sequence', effects: [
        { type: 'Name Card' }, { type: 'Reveal', cards: { ...top, take: 1 } },
        { type: 'Conditional', if: { every: { result: 'Revealed Cards' }, where: { namedCard: 'Named Card' } },
            then: { type: 'Sequence', effects: [
                { type: 'Optional', effect: { type: 'Play', cards: { result: 'Revealed Cards' }, free: true } },
                { type: 'Conditional', if: { exists: { filter: { result: 'Revealed Cards' }, where: { zone: 'Deck' } } },
                    then: { type: 'Move Card', cards: { result: 'Revealed Cards' }, to: 'Deck', position: 'Bottom' } },
            ] },
            otherwise: { type: 'Move Card', cards: { result: 'Revealed Cards' }, to: 'Deck', position: 'Bottom' } },
    ] } } },
    { tcg: ['RevealTopCardEffect'], rules: { type: 'Item', abilities: [{ type: 'Static', rule: { type: 'Reveal Cards', cards: { ...top, take: 1 } } }] } },
    { tcg: ['RevealUntilMatchEffect'], rules: { type: 'Action', effect: { type: 'Reveal Until', player: 'You', where: { cardType: 'Character' } } } },
    { tcg: ['SequenceEffect', 'CompoundEffect', 'ChoiceEffect', 'ModalEffect', 'OrEffect', 'ConditionalEffect', 'OptionalEffect'], rules: { type: 'Action', effect: {
        type: 'Conditional', if: { exists: character }, then: { type: 'Choose Mode', options: [
            { type: 'Optional', effect: { type: 'Draw', player: 'You', amount: 1 } },
            { type: 'Sequence', effects: [{ type: 'Gain Lore', player: 'You', amount: 1 }, { type: 'Lose Lore', player: 'Opponents', amount: 1 }] },
        ] }, otherwise: { type: 'Or', options: [{ type: 'Draw', player: 'You', amount: 1 }, { type: 'Gain Lore', player: 'You', amount: 1 }] },
    } } },
    { tcg: ['ForEachEffect', 'ForEachOpponentEffect', 'ForEachPlayerEffect', 'RepeatEffect'], rules: { type: 'Action', effect: {
        type: 'For Each Player', players: 'Opponents', effect: { type: 'For Each Card', cards: { ...character, player: 'Selected Player' }, effect: {
            type: 'Repeat', times: 2, effect: { type: 'Deal Damage', cards: 'Selected Cards', amount: 1 },
        } },
    } } },
    { tcg: ['RevealHandEffect', 'RevealDeckEffect', 'RevealEffect', 'RevealTopEffect'], rules: { type: 'Action', effect: {
        type: 'Reveal', cards: { union: [hand, top] },
    } } },
    { tcg: ['RevealInkwellEffect'], rules: { type: 'Action', effect: {
        type: 'Reveal', cards: { zone: 'Inkwell', player: 'You' },
    } } },
    { tcg: ['LookAtCardsEffect', 'LookEffect', 'LookAtTopEffect', 'LookAtDeckEffect'], rules: { type: 'Action', effect: {
        type: 'Look', cards: { union: [{ zone: 'Inkwell', player: 'You' }, { ...top, position: 'Bottom' }] }, player: 'You',
    } } },
    { tcg: ['SearchDeckEffect', 'SearchEffect'], rules: { type: 'Action', effect: { type: 'Sequence', effects: [
        { type: 'Search', from: { zone: 'Deck', player: 'You', where: { and: [{ cardType: 'Character' }, { classification: 'Madrigal' }], not: { cost: { greaterThan: 5 } } } },
            count: { upTo: 1 }, effect: { type: 'Sequence', effects: [{ type: 'Reveal', cards: 'Selected Cards' }, { type: 'Move Card', cards: 'Selected Cards', to: 'Hand' }] } },
        { type: 'Shuffle', player: 'You' },
    ] } } },
    { tcg: ['EntersPlayEffect', 'EntersPlayWithEffect', 'EntersWithDamageEffect'], rules: { type: 'Character', abilities: [{ type: 'Static', rule: {
        type: 'Enter Play', cards: 'Self', exerted: true, damage: 2,
    } }] } },
    { tcg: ['WinConditionEffect', 'AdditionalInkwellEffect'], rules: { type: 'Character', abilities: [{ type: 'Static', rule: { type: 'Together', rules: [
        { type: 'Modify Players', players: 'Opponents', modifier: { victoryLore: 25 } },
        { type: 'Modify Players', players: 'You', modifier: { additionalInk: 1 } },
    ] } }] } },
    { tcg: ['PropertyModificationEffect'], rules: { type: 'Character', abilities: [{ type: 'Static', rule: { type: 'Together', rules: [
        { type: 'Modify Cards', cards: 'Self', modifier: { gainClassification: 'Hero' } },
        { type: 'Modify Cards', cards: 'Self', modifier: { countsAsName: 'Turbo', for: 'Shift' } },
        { type: 'Modify Cards', cards: 'Self', modifier: { stat: 'Cost To Sing', amount: 2 } },
    ] } }] } },
    { tcg: ['CostEffectEffect', 'PayCostEffect'], rules: { type: 'Character', abilities: [{ type: 'Activated', cost: [], effect: {
        type: 'Optional', effect: { type: 'Pay Cost', cost: [{ type: 'Ink', amount: 2 }], then: {
            type: 'Do Then', do: { type: 'Banish', cards: 'Self' }, then: { type: 'Draw', player: 'You', amount: 3 },
        } },
    } }] } },
    { tcg: ['CreateTriggeredAbilityEffect', 'TriggeredEffectWrapper'], rules: { type: 'Action', effect: {
        type: 'Create Trigger', trigger: { event: 'Quest', card: { ...character, player: 'You' } },
        effect: { type: 'Lose Lore', player: 'Opponents', amount: 1 }, duration: { until: 'End Of Turn' },
    } } },
    { tcg: ['ReplacementEffect', 'PreventDamageEffect', 'PreventionEffect', 'ProtectionEffect'], rules: { type: 'Character', abilities: [{ type: 'Replacement',
        replacement: { event: { event: 'Deal Damage', card: 'Self', kind: 'Challenge' }, limit: { perTurn: 1, count: 'Occurrences' } },
    }] } },
    { tcg: ['CountEffect'], rules: { type: 'Action', effect: { type: 'Gain Lore', player: 'You', amount: { count: character } } } },
    { tcg: ['SupportEffect'], rules: { type: 'Character', abilities: [{ type: 'Keyword', keyword: { name: 'Support' } }] } },
    { tcg: ['SuppressAbilityEffect'], rules: { type: 'Character', abilities: [{ type: 'Static', rule: {
        type: 'Modify Cards', cards: { ...character, player: 'You', where: { classification: 'Gargoyle' } }, modifier: { loseAbility: { name: 'Stone by Day' } },
    } }] } },
    // These occur in StaticEffect but not the ordinary Effect union.
    { tcg: ['GrantHandInkabilityEffect', 'GrantDiscardInkabilityEffect', 'SelfPlayConditionEffect'], rules: { type: 'Character',
        playRules: [{ type: 'Requirement', when: { value: { count: { ...character, player: 'You' } }, is: { atLeast: 5 } } }],
        abilities: [{ type: 'Static', rule: { type: 'Together', rules: [
            { type: 'Modify Cards', cards: hand, modifier: { inkable: true } },
            { type: 'Modify Players', players: 'You', modifier: { permission: 'Can Ink From Discard' } },
        ] } }],
    } },
] satisfies { tcg: string[]; rules: CardRules }[];

for (const family of families) {
    it(`represents TCG family ${family.tcg.join(', ')}`, () => {
        expect(validateCardRules(family.rules)).toEqual([]);
        expect(JSON.parse(JSON.stringify(family.rules))).toEqual(family.rules);
    });
}

it('does not claim the same audited TCG member in multiple families', () => {
    const names = families.flatMap(family => family.tcg);
    expect(new Set(names).size).toBe(names.length);
});
