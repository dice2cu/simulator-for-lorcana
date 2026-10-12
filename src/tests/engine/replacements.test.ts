import { describe, expect, it } from 'vitest';
import { startEffect } from '../../engine/engine';
import { getCard } from '../../cards';
import type { GameState, PlayerPosition } from '../../model/game-state';
import type { CharacterCard, ItemCard } from '../../model/card';

const basic: CharacterCard = { fullName: 'Test', names: ['Test'], type: 'Character', cost: 1, inkwell: true, colors: ['Amber'],
    subtypes: [], strength: 1, willpower: 10, lore: 1 };
const target = { fullName: basic.fullName, i: 1 };
const source = { card: { fullName: 'Dinglehopper', i: 99 }, player: 1 as const, kind: 'Ability' as const };
function setup() {
    const player = (): PlayerPosition => ({ lore: 0, turnsTaken: 0, deck: [], hand: [], discard: [], inkwell: [], play: [] });
    const p1 = player(), p2 = player();
    const state: GameState = { turn: { number: 1, player: 1 }, players: { 1: p1, 2: p2 } };
    const options = { card: (name: string) => name === basic.fullName ? basic : getCard(name) };
    return { state, p1, p2, options };
}

describe('proposed-event replacements', () => {
    it('a prevented lethal banishment does not create an endless cleanup loop', () => {
        const { state, p2, options } = setup();
        const protectedCard: CharacterCard = { ...basic, abilities: [{ type: 'Replacement', replacement: {
            event: { event: 'Banish', card: 'Self' },
        } }] };
        p2.play = [{ card: target }];
        const live = startEffect(state, { type: 'Put Damage', cards: { cards: [target] }, amount: 10 }, source,
            { card: name => name === basic.fullName ? protectedCard : options.card(name) });
        expect(live.result?.players[2]?.play[0].damage).toBe(10);
        expect(live.result?.players[2]?.discard).toEqual([]);
    });
    it('Beast takes counters after damage modifiers, without receiving dealt damage itself', () => {
        const { state, p2, options } = setup();
        const beast = { fullName: 'Beast - Selfless Protector', i: 2 };
        p2.play = [{ card: target, modifiers: [{ gainKeyword: 'Resist', amount: 1 }] },
            { card: beast, modifiers: [{ gainKeyword: 'Resist', amount: 5 }] }];
        const live = startEffect(state, { type: 'Deal Damage', cards: { cards: [target] }, amount: 3 }, source, options);
        expect(live.result?.players[2]?.play[0].damage ?? 0).toBe(0);
        expect(live.result?.players[2]?.play[1].damage).toBe(2);
    });

    it('offers competing replacements to the affected player and consumes only the chosen shield', () => {
        const { state, p2, options } = setup();
        const beast = { fullName: 'Beast - Selfless Protector', i: 2 };
        p2.play = [{ card: target, modifiers: [{ preventDamage: 'Next' }] }, { card: beast }];
        const live = startEffect(state, { type: 'Deal Damage', cards: { cards: [target] }, amount: 2 }, source, options);
        const request = live.request;
        if (request?.type !== 'Choose Replacement') throw new Error('Missing replacement choice');
        expect(request.player).toBe(2);
        const shield = request.options.find(option => option.source?.card.fullName === target.fullName);
        if (!shield) throw new Error('Missing shield');
        live.submit({ type: 'Decision', answer: { type: 'Choose Replacement', replacement: shield.reference } });
        expect(live.result?.players[2]?.play[0].modifiers).toEqual([]);
        expect(live.result?.players[2]?.play[1].damage ?? 0).toBe(0);
    });

    it('offers replacements as public data, so later events still record', () => {
        const { state, p2, options } = setup();
        const beast = { fullName: 'Beast - Selfless Protector', i: 2 }, bystander = { ...target, i: 3 };
        p2.play = [{ card: target, modifiers: [{ preventDamage: 'Next' }] }, { card: beast }, { card: bystander }];
        const live = startEffect(state, { type: 'Sequence', effects: [
            { type: 'Deal Damage', cards: { cards: [target] }, amount: 2 },
            { type: 'Deal Damage', cards: { cards: [bystander] }, amount: 1 },
        ] }, source, options);
        const request = live.request;
        if (request?.type !== 'Choose Replacement') throw new Error('Missing replacement choice');
        for (const option of request.options) expect(Object.keys(option).sort()).toEqual(['player', 'reference', 'replacement', 'source']);
        const shield = request.options.find(option => option.source?.card.fullName === target.fullName);
        if (!shield) throw new Error('Missing shield');
        live.submit({ type: 'Decision', answer: { type: 'Choose Replacement', replacement: shield.reference } });
        // Beast takes the bystander's counter instead, which records further events.
        expect(live.result?.players[2]?.play[1].damage).toBe(1);
    });

    it('Lilo prevents only the first damage occurrence on an opposing turn', () => {
        const { state, p2, options } = setup();
        const lilo = { fullName: 'Lilo - Bundled Up', i: 2 };
        p2.play = [{ card: lilo }];
        const live = startEffect(state, { type: 'Sequence', effects: [
            { type: 'Deal Damage', cards: { cards: [lilo] }, amount: 1 },
            { type: 'Deal Damage', cards: { cards: [lilo] }, amount: 1 },
        ] }, source, options);
        expect(live.result?.players[2]?.play[0].damage).toBe(1);
    });

    it('Kronk prevents an effect discard but not a discard paid as a cost', () => {
        const { state, p1, options } = setup();
        const kronk = { fullName: 'Kronk - Laid Back', i: 2 };
        p1.play = [{ card: kronk }]; p1.hand = [target];
        const prevented = startEffect(state, { type: 'Discard', cards: { cards: [target] } }, source, options).result;
        if (!prevented) throw new Error('Discard did not finish');
        expect(prevented.players[1]?.hand).toEqual([target]);
        const paid = startEffect(prevented, { type: 'Pay Cost', cost: [{ type: 'Discard', cards: { cards: [target] } }],
            then: { type: 'Gain Lore', player: 'You', amount: 1 } }, source, options);
        paid.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Discard', player: 1, cards: [target] }] } });
        expect(paid.result?.players[1]?.discard).toEqual([target]);
        expect(paid.result?.players[1]?.lore).toBe(1);
    });

    it('the Duo replaces lethal banishment with exerted ink for the shifted stack', () => {
        const { state, p2, options } = setup();
        const duo = { fullName: 'Mickey Mouse & Minnie Mouse - Adventuring Duo', i: 2 };
        p2.play = [{ card: duo, under: [{ card: target, faceDown: false }] }];
        const live = startEffect(state, { type: 'Put Damage', cards: { cards: [duo] }, amount: 5 }, source, options);
        expect(live.result?.players[2]?.play).toEqual([]);
        expect(live.result?.players[2]?.inkwell).toEqual([{ card: duo, exerted: true }, { card: target, exerted: true }]);
        expect(live.result?.players[2]?.discard).toEqual([]);
    });

    it('a damage adjustment keeps attribution and is applied once to the proposed event', () => {
        const { state, p2, options } = setup();
        const provider: ItemCard = { ...basic, fullName: 'Damage Adjustment', type: 'Item', abilities: [{ type: 'Replacement', replacement: {
            event: { event: 'Deal Damage', card: { zone: 'Play', player: 'You' } }, damage: { amount: { add: [{ event: 'Amount' }, 1] } },
        } }] };
        p2.play = [{ card: target }, { card: { fullName: provider.fullName, i: 2 } }];
        const live = startEffect(state, { type: 'Deal Damage', cards: { cards: [target] }, amount: 2 }, source,
            { card: name => name === provider.fullName ? provider : options.card(name) });
        expect(live.result?.players[2]?.play[0].damage).toBe(3);
    });
});
