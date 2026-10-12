/** Real-text representability checks. These do not execute the proposed model. */
import { cards } from '../fixtures/catalog';
import { expect, it } from 'vitest';
import type { CardRules, Effect } from '../../model/ability';
import { abilityExamples, actionCardExamples } from '../../model/examples';
import { validateCardRules } from '../../model/validate';

const catalog = { cards };
const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();
const woodyModes: Effect[] = [
    { type: 'Optional', effect: { type: 'Choose Cards', count: 1,
        from: { zone: 'Discard', player: 'You', cardType: 'Character', where: { cost: { atMost: 2 } } },
        effect: { type: 'Move Card', cards: 'Selected Cards', to: 'Hand' } } },
    { type: 'Optional', effect: { type: 'Choose Cards', count: 1,
        from: { zone: 'Hand', player: 'You', cardType: 'Character', where: { cost: { atMost: 2 } } },
        effect: { type: 'Play', cards: 'Selected Cards', free: true } } },
];

const cases = [
    { name: 'Winnie the Pooh & Piglet - Hunny Mages',
        text: 'This character gets +1 ◊ for each different ink type of characters you have in play.',
        rules: { type: 'Character', abilities: [{ type: 'Static', rule: {
            type: 'Modify Cards', cards: 'Self', modifier: { stat: 'Lore', amount: {
                distinct: 'Ink Type', cards: { zone: 'Play', player: 'You', cardType: 'Character' },
            } },
        } }] },
    },
    { name: 'Baymax - Armored Companion',
        text: 'When you play this character and whenever he quests, you may remove up to 2 damage from another chosen character of yours. Gain 1 lore for each 1 damage removed this way.',
        rules: { type: 'Character', abilities: [{ type: 'Triggered',
            trigger: { anyOf: [{ event: 'Play', card: 'Self' }, { event: 'Quest', card: 'Self' }] },
            effect: { type: 'Sequence', effects: [
                { type: 'Optional', effect: { type: 'Choose Cards', count: 1,
                    from: { zone: 'Play', player: 'You', cardType: 'Character', exclude: 'Self' },
                    effect: { type: 'Remove Damage', cards: 'Selected Cards', amount: { upTo: 2 } } } },
                { type: 'Gain Lore', player: 'You', amount: { result: 'Damage Removed' } },
            ] },
        }] } },
    { name: 'Stolen Scimitar',
        text: 'Chosen character gets +1 ¤ this turn. If a character named Aladdin is chosen, he gets +2 ¤ instead.',
        rules: { type: 'Item', abilities: [{ type: 'Activated', name: 'SLASH', cost: [{ type: 'Exert', cards: 'Self' }], effect: {
            type: 'Choose Cards', from: { zone: 'Play', cardType: 'Character' }, count: 1, effect: {
                type: 'Conditional', if: { every: 'Selected Cards', where: { name: 'Aladdin' } },
                then: { type: 'Modify Cards', cards: 'Selected Cards', modifier: { stat: 'Strength', amount: 2 }, duration: { until: 'End Of Turn' } },
                otherwise: { type: 'Modify Cards', cards: 'Selected Cards', modifier: { stat: 'Strength', amount: 1 }, duration: { until: 'End Of Turn' } },
            },
        } }] } },
    { name: 'Snuggly Duckling - Disreputable Pub',
        text: 'Whenever a character with 3 ¤ or more challenges another character while here, gain 1 lore. If the challenging character has 6 ¤ or more, gain 3 lore instead.',
        rules: { type: 'Location', abilities: [{ type: 'Triggered', trigger: { event: 'Challenge',
            attacker: { zone: 'Play', cardType: 'Character', where: { at: 'Self', strength: { atLeast: 3 } } },
            defender: { zone: 'Play', cardType: 'Character' },
        }, effect: {
            type: 'Conditional', if: { every: { event: 'Attacker' }, where: { strength: { atLeast: 6 } } },
            then: { type: 'Gain Lore', player: 'You', amount: 3 },
            otherwise: { type: 'Gain Lore', player: 'You', amount: 1 },
        } }] } },
    { name: "Seven Dwarfs' Mine - Secure Fortress",
        text: 'During your turn, the first time you move a character here, you may deal 1 damage to chosen character. If the moved character is a Knight, deal 2 damage instead.',
        rules: { type: 'Location', abilities: [{ type: 'Triggered',
            trigger: { event: 'Move To Location', location: 'Self', when: { duringTurnOf: 'You' } },
            limit: { perTurn: 1, count: 'Occurrences' }, effect: { type: 'Optional', effect: {
                type: 'Choose Cards', from: { zone: 'Play', cardType: 'Character' }, count: 1, effect: {
                    type: 'Conditional', if: { every: { event: 'Card' }, where: { classification: 'Knight' } },
                    then: { type: 'Deal Damage', cards: 'Selected Cards', amount: 2 },
                    otherwise: { type: 'Deal Damage', cards: 'Selected Cards', amount: 1 },
                },
            } },
        }] } },
    { name: 'Dale - Mischievous Ranger',
        text: 'When you play this character, you may put the top 3 cards of your deck into your discard to give chosen character -3 ¤ until the start of your next turn.',
        rules: { type: 'Character', abilities: [abilityExamples.daleMillThenDebuff] } },
    { name: 'Raksha - Fearless Mother',
        text: 'Once during your turn, you may pay 1 ⬡ less to move this character to a location.',
        rules: { type: 'Character', abilities: [abilityExamples.rakshaMovement] } },
    { name: 'Friar Tuck - Priest of Nottingham',
        text: 'When you play this character, the player or players with the most cards in their hand chooses and discards a card.',
        rules: { type: 'Character', abilities: [abilityExamples.friarTuckLargestHand] } },
    { name: 'Search for Clues',
        text: 'The player or players with the most cards in their hands choose and discard 2 cards. If you have a Detective character in play, gain 1 lore.',
        rules: { type: 'Action', effect: { type: 'Sequence', effects: [
            { type: 'For Each Player', players: { from: 'All', rank: { order: 'Highest', by: { count: { zone: 'Hand', player: 'Selected Player' } } } },
                effect: { type: 'Choose Cards', from: { zone: 'Hand', player: 'Selected Player' }, count: 2, player: 'Selected Player', effect: { type: 'Discard', cards: 'Selected Cards' } } },
            { type: 'Conditional', if: { exists: { zone: 'Play', player: 'You', cardType: 'Character', where: { classification: 'Detective' } } },
                then: { type: 'Gain Lore', player: 'You', amount: 1 } },
        ] } } },
    { name: 'Merlin - Envisioning the Future',
        text: 'When you play this character, you may draw a card from the bottom of your deck.',
        rules: { type: 'Character', abilities: [abilityExamples.merlinBottomDraw] } },
    { name: 'Roz - Always Watching',
        text: 'Each opponent plays with the top card of their deck faceup.',
        rules: { type: 'Character', abilities: [abilityExamples.rozTopCard] } },
    { name: "The Sorcerer's Tower - Wondrous Workspace",
        text: 'Your characters named Magic Broom may move here for free.',
        rules: { type: 'Location', abilities: [abilityExamples.sorcerersTowerMovement] } },
    { name: 'Prince Charming - Protector of the Realm',
        text: 'Each turn, only one character can challenge.',
        rules: { type: 'Character', abilities: [abilityExamples.princeCharmingChallengers] } },
    {
        name: "I've Got a Dream",
        text: "Ready chosen character of yours at a location. They can't quest for the rest of this turn. Gain lore equal to that location's ◊.",
        rules: actionCardExamples.iveGotADream,
    },
    {
        name: 'Flynn Rider - High-Climbing Rogue',
        text: 'Whenever an opponent chooses this character for an action or ability, they choose and discard a card.',
        rules: { type: 'Character', abilities: [abilityExamples.flynnHighClimbingRogue] },
    },
    {
        name: 'Morph - Little Imitator',
        text: 'You can shift any character on top of this character. (This includes all Shift variants.)',
        rules: { type: 'Character', abilities: [abilityExamples.morphLittleImitator] },
    },
    {
        name: 'Belle - Always Reading',
        text: 'You pay 1 ⬡ less to shift a character on top of this character.',
        rules: { type: 'Character', abilities: [abilityExamples.belleAlwaysReading] },
    },
    {
        name: 'Meilin Lee - Superficially Obedient',
        text: 'When you shift a character on top of her, this character gains Evasive until the start of your next turn. (Only characters with Evasive can challenge them.)',
        rules: { type: 'Character', abilities: [abilityExamples.meilinSuperficiallyObedient] },
    },
    {
        name: 'Arthur - Determined Squire',
        text: "Skip your turn's Draw step.",
        rules: { type: 'Character', abilities: [abilityExamples.arthurDeterminedSquire] },
    },
    {
        name: 'Remember Who You Are',
        text: 'If chosen opponent has more cards in their hand than you, draw cards until you have the same number.',
        rules: { type: 'Action', effect: { type: 'Choose Player', from: 'Opponents', effect: {
            type: 'Conditional',
            if: { value: { count: { zone: 'Hand', player: 'Selected Player' } }, is: { greaterThan: { count: { zone: 'Hand', player: 'You' } } } },
            then: { type: 'Draw', player: 'You', amount: { subtract: [
                { count: { zone: 'Hand', player: 'Selected Player' } }, { count: { zone: 'Hand', player: 'You' } },
            ] } },
        } } },
    },
    {
        name: 'Goliath - Clan Leader',
        text: "At the end of each player's turn, if they have more than 2 cards in their hand, they choose and discard cards until they have 2. If they have fewer than 2 cards in their hand, they draw until they have 2.",
        rules: { type: 'Character', abilities: [{ type: 'Triggered', trigger: { event: 'Turn End', player: 'All' }, effect: {
            type: 'Choose Player', from: { event: 'Player' }, effect: {
                type: 'Conditional',
                if: { value: { count: { zone: 'Hand', player: 'Selected Player' } }, is: { greaterThan: 2 } },
                then: { type: 'Choose Cards', player: 'Selected Player',
                    from: { zone: 'Hand', player: 'Selected Player' },
                    count: { subtract: [{ count: { zone: 'Hand', player: 'Selected Player' } }, 2] },
                    effect: { type: 'Discard', cards: 'Selected Cards' } },
                otherwise: { type: 'Draw', player: 'Selected Player', amount: { subtract: [2, { count: { zone: 'Hand', player: 'Selected Player' } }] } },
            },
        } }] },
    },
    {
        name: 'Woody - Helping a Friend',
        text: 'When you play this character, choose one of the following. If you have another Toy character in play, choose both instead: • You may return a character card with cost 2 or less from your discard to your hand. • You may play a character with cost 2 or less for free.',
        rules: { type: 'Character', abilities: [{ type: 'Triggered', trigger: { event: 'Play', card: 'Self' }, effect: {
            type: 'Conditional', if: { exists: { zone: 'Play', player: 'You', cardType: 'Character', exclude: 'Self', where: { classification: 'Toy' } } },
            then: { type: 'Sequence', effects: woodyModes }, otherwise: { type: 'Choose Mode', options: woodyModes },
        } }] },
    },
    {
        name: 'Daisy Duck - Paranormal Investigator',
        text: "While this character is exerted, cards enter opponents' inkwells exerted.",
        rules: { type: 'Character', abilities: [{ type: 'Replacement', replacement: {
            event: { event: 'Put Into Inkwell', card: { zone: 'Any', player: 'Opponents' },
                when: { every: 'Self', where: { exerted: true } } },
            instead: { type: 'Move Card', cards: { event: 'Card' }, to: 'Inkwell', exerted: true },
        } }] },
    },
    {
        name: 'Fairy Godmother - Magical Benefactor',
        text: "Whenever you put a card under this character, you may banish chosen opposing character. If you do, their player may reveal the top card of their deck. If that card is a character or item card, they may play it for free. Otherwise, they put it on the bottom of their deck.",
        rules: { type: 'Character', abilities: [{ type: 'Triggered', trigger: {
            event: 'Put Under', card: { zone: 'Under', under: 'Self' }, player: 'You',
        }, effect: { type: 'Optional', effect: { type: 'Do Then',
            do: { type: 'Choose Cards', count: 1, from: { zone: 'Play', player: 'Opponents', cardType: 'Character' },
                effect: { type: 'Banish', cards: 'Selected Cards' } },
            then: { type: 'Optional', player: { ownerOf: { result: 'Banished Cards' } }, effect: { type: 'Sequence', effects: [
                { type: 'Reveal', cards: { zone: 'Deck', player: { ownerOf: { result: 'Banished Cards' } }, take: 1 } },
                { type: 'Conditional', if: { every: { result: 'Revealed Cards' }, where: { or: [{ cardType: 'Character' }, { cardType: 'Item' }] } },
                    then: { type: 'Optional', player: { ownerOf: { result: 'Revealed Cards' } },
                        effect: { type: 'Play', cards: { result: 'Revealed Cards' }, player: { ownerOf: { result: 'Revealed Cards' } }, free: true } },
                    otherwise: { type: 'Move Card', cards: { result: 'Revealed Cards' }, to: 'Deck', position: 'Bottom' } },
            ] } },
        } } }] },
    },
] satisfies { name: string; text: string; rules: CardRules }[];

for (const example of cases) {
    it(`represents the verified instruction from ${example.name}`, () => {
        const cards = catalog.cards.filter(card => card.fullName === example.name);
        expect(cards.length).toBeGreaterThan(0);
        const texts = cards.flatMap(card => [...(card.effects ?? []), ...(card.abilities ?? []).flatMap(ability => ability.effect === undefined ? [] : [ability.effect])]);
        expect(texts.map(normalize)).toContain(normalize(example.text));
        expect(validateCardRules(example.rules)).toEqual([]);
        expect(JSON.parse(JSON.stringify(example.rules))).toEqual(example.rules);
    });
}

it('flags real once-per-game instructions before unsupported usage limits are needed', () => {
    const unsupported = catalog.cards.flatMap(card => {
        const texts = [...(card.effects ?? []), ...(card.abilities ?? []).flatMap(ability => ability.effect === undefined ? [] : [ability.effect])];
        return texts.filter(text => /\b(?:once|one time)\b.{0,40}\bgame\b/i.test(normalize(text)))
            .map(text => ({ card: card.fullName, text }));
    });
    expect(unsupported).toEqual([]);
});
