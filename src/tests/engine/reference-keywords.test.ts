import { expect, it } from 'vitest';
import { getCard } from '../../cards';
import { startEffect } from '../../engine/engine';
import { Rules } from '../../engine/rules';
import type { Keyword } from '../../model/ability';
import type { CharacterCard } from '../../model/card';
import type { GameState, PlayerPosition } from '../../model/game-state';

// These rows retain the reference effect IDs, 3/4/1 characters and matching/nonmatching expectations.
const cases: { id: string; source: string; name: string; keyword: Keyword; amount: number }[] = [
    { id: '8766448f2fa4', source: 'Merlin - Back from Bermuda', name: 'Arthur', keyword: 'Resist', amount: 1 },
    { id: 'f87b12cef129', source: "Captain Hook's Rapier", name: 'Captain Hook', keyword: 'Challenger', amount: 1 },
    { id: '6202ecf34cbf', source: 'Honker Muddlefoot - Timid Genius', name: 'Darkwing Duck', keyword: 'Resist', amount: 1 },
    { id: 'fd4cfe252639', source: 'Grimorum Arcanorum', name: 'Demona', keyword: 'Rush', amount: 1 },
    { id: '23545b716951', source: 'Jetsam - Ursula\'s "Baby"', name: 'Flotsam', keyword: 'Challenger', amount: 2 },
    { id: 'b4aec6608440', source: "Jetsam - Ursula's Spy", name: 'Flotsam', keyword: 'Evasive', amount: 1 },
    { id: '1bc7ddacbd70', source: 'Jetsam - Riffraff', name: 'Flotsam', keyword: 'Ward', amount: 1 },
    { id: '1e6c6952a5e4', source: 'Hera - Queen of the Gods', name: 'Hercules', keyword: 'Evasive', amount: 1 },
    { id: 'd4ba49842d65', source: "Flotsam - Ursula's Spy", name: 'Jetsam', keyword: 'Rush', amount: 1 },
    { id: '3c2d526859a0', source: 'Maid Marian - Badminton Ace', name: 'Lady Kluck', keyword: 'Resist', amount: 1 },
    { id: 'e22d4acacc14', source: 'Nani - Heist Mastermind', name: 'Lilo', keyword: 'Support', amount: 1 },
    { id: 'd1f78f3358e9', source: 'Diablo - Protecting His Mistress', name: 'Maleficent', keyword: 'Resist', amount: 1 },
    { id: '29c25494efba', source: 'Minnie Mouse - Sweetheart Princess', name: 'Mickey Mouse', keyword: 'Support', amount: 1 },
    { id: 'd2f1a217b755', source: "Tinker Bell - Peter Pan's Ally", name: 'Peter Pan', keyword: 'Challenger', amount: 1 },
    { id: '99e642b246e2', source: 'Mickey Mouse - Night Watch', name: 'Pluto', keyword: 'Resist', amount: 1 },
    { id: 'f26f51e0857f', source: 'Bo Peep - Caring Shepherd', name: 'Woody', keyword: 'Bodyguard', amount: 1 },
    { id: '5ca99e6a7383', source: 'Hera - Queen of the Gods', name: 'Zeus', keyword: 'Ward', amount: 1 },
];

it.each(cases)('$id: $source grants $keyword only to your characters named $name', scenario => {
    const character = (name: string): CharacterCard => ({ fullName: name, names: [name], type: 'Character', colors: [], subtypes: [],
        cost: 1, inkwell: true, strength: 3, willpower: 4, lore: 1 });
    const matching = character(scenario.name), nonmatching = character('Nonmatching');
    const options = { card: (name: string) => name === matching.fullName ? matching : name === nonmatching.fullName ? nonmatching : getCard(name) };
    const source = { fullName: scenario.source, i: 1 }, target = { fullName: matching.fullName, i: 2 }, other = { fullName: nonmatching.fullName, i: 3 };
    const opposing = { ...target, i: 4 };
    if (!getCard(source.fullName)) throw new Error(`Missing reference source: ${source.fullName}`);
    const player = (): PlayerPosition => ({ lore: 0, turnsTaken: 0, deck: [], hand: [], discard: [], play: [], inkwell: [] });
    const p1 = player(), p2 = player();
    p1.play = [{ card: source }, { card: target }, { card: other }]; p2.play = [{ card: opposing }];
    const state: GameState = { turn: { number: 1, player: 1 }, players: { 1: p1, 2: p2 } };
    const rules = new Rules(state, options.card);
    expect(rules.keyword(target, scenario.keyword)).toBe(scenario.amount);
    expect(rules.keyword(other, scenario.keyword)).toBe(0);
    expect(rules.keyword(opposing, scenario.keyword)).toBe(0);
    const removed = startEffect(state, { type: 'Banish', cards: { cards: [source] } }, { card: source, player: 1, kind: 'Ability' }, options);
    if (!removed.result) throw new Error('Unexpected decision when removing the keyword provider');
    expect(new Rules(removed.result, options.card).keyword(target, scenario.keyword)).toBe(0);
});
