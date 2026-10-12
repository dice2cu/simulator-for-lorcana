import { describe, expect, it } from 'vitest';
import { startAction, startEffect, startTurn } from '../../engine/engine';
import { applyTurn, resumeTurn } from '../../engine/resume';
import { getLegalActions } from '../../engine/actions';
import { InvalidInput } from '../../engine/invalid-input';
import { Rules } from '../../engine/rules';
import { getCard } from '../../cards';
import type { CharacterCard, Card } from '../../model/card';
import type { GameState, PlayerPosition } from '../../model/game-state';
import type { CardIdentifier } from '../../model/identity';
import type { DecisionAnswer, TurnStep } from '../../model/turn';

const character: CharacterCard = { fullName: 'Test Hero', type: 'Character', names: ['Test Hero'], colors: ['Amber'], cost: 1,
    inkwell: true, subtypes: [], strength: 2, willpower: 3, lore: 2 };
const hero = { fullName: character.fullName, i: 1 };
const options = { card: (name: string): Card | undefined => name === character.fullName ? character : getCard(name) };
function base(): GameState {
    const player = (i: number): PlayerPosition => ({ lore: 0, turnsTaken: 0, deck: [{ ...hero, i }], hand: [], play: [], discard: [], inkwell: [] });
    return { turn: { number: 1, player: 1 }, players: { 1: player(900), 2: player(901) } };
}
function required(state: GameState, number: 1 | 2): PlayerPosition {
    const p = state.players[number];
    if (!p) throw new Error('Missing fixture player');
    return p;
}
const end: TurnStep = { type: 'Action', action: { type: 'End Turn', player: 1 } };

it('passes the trigger bag clockwise from the active player in a multiplayer game', () => {
    const state = base();
    state.turn.player = 2;
    required(state, 2).deck.push({ ...hero, i: 902 });
    state.players[3] = { lore: 0, turnsTaken: 0, hand: [], deck: [{ ...hero, i: 903 }], discard: [], inkwell: [], play: [] };
    for (const player of [1, 2, 3] as const) {
        const position = state.players[player];
        if (!position) throw new Error('Missing player');
        position.modifiers = [{ source: { card: { ...hero, i: player }, player, kind: 'Ability' }, uses: 1,
            trigger: { event: 'Turn End', player: 'All' },
            effect: { type: 'Optional', effect: { type: 'Gain Lore', player: 'You', amount: 1 } },
        }];
    }
    const live = startTurn(state, options);
    live.submit({ type: 'Action', action: { type: 'End Turn', player: 2 } });
    for (const player of [2, 3, 1] as const) {
        expect(live.request).toMatchObject({ type: 'Optional', player });
        live.submit({ type: 'Decision', answer: { type: 'Optional', accept: true } });
    }
    expect(live.result?.players[1]?.lore).toBe(1);
    expect(live.result?.players[2]?.lore).toBe(1);
    expect(live.result?.players[3]?.lore).toBe(1);
    expect(applyTurn(state, JSON.parse(JSON.stringify(live.turn)), options)).toEqual(live.result);
});

it('makes simultaneous player choices in active-player seat order', () => {
    const state = base(), third = { ...hero, i: 3 }, second = { ...hero, i: 2 };
    state.turn.player = 2;
    required(state, 1).hand = [hero]; required(state, 2).hand = [second];
    state.players[3] = { lore: 0, turnsTaken: 0, hand: [third], deck: [], discard: [], inkwell: [], play: [] };
    const live = startEffect(state, { type: 'For Each Player', players: 'All', effect: {
        type: 'Choose Cards', player: 'Selected Player', from: { zone: 'Hand', player: 'Selected Player' }, count: 1,
        effect: { type: 'Discard', cards: 'Selected Cards' },
    } }, { card: hero, player: 1, kind: 'Ability' }, options);
    for (const [player, card] of [[2, second], [3, third], [1, hero]] as const) {
        expect(live.request).toMatchObject({ type: 'Choose Cards', player });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [card] } });
    }
    expect(live.result?.players[1]?.discard).toEqual([hero]);
});

it('continues multiplayer after deck-out and expires static effects at the absent player\'s seat', () => {
    const state = base(), p1 = required(state, 1), p2 = required(state, 2);
    const third = { ...hero, i: 3 }, stolen = { ...hero, i: 4 };
    p1.deck = []; p1.play = [{ card: hero }];
    p1.modifiers = [{ rule: { type: 'Modify Cards', cards: { zone: 'Play', player: 'Opponents' }, modifier: { restriction: "Can't Ready" } },
        source: { card: hero, player: 1, kind: 'Ability' }, expires: { startOfNextTurn: 1, afterTurn: 1 } }];
    p2.deck = [900, 901].map(i => ({ ...hero, i }));
    p2.play = [{ card: { ...hero, i: 2 }, exerted: true }, { card: stolen, owner: 1 }];
    state.players[3] = { lore: 0, turnsTaken: 0, hand: [], deck: [902, 903].map(i => ({ ...hero, i })),
        play: [{ card: third, exerted: true }], discard: [], inkwell: [] };
    const first = startTurn(state, options); first.submit(end);
    const afterFirst = first.result;
    if (!afterFirst) throw new Error('Missing continuing game');
    expect(first.outcome).toBeUndefined();
    expect(afterFirst.players[1]).toBeUndefined();
    expect(afterFirst.players[2]?.play.map(state => state.card)).toEqual([{ ...hero, i: 2 }]);
    expect(afterFirst.turn).toEqual({ number: 2, player: 2 });
    expect(applyTurn(state, JSON.parse(JSON.stringify(first.turn)), options)).toEqual(afterFirst);
    const second = startTurn(afterFirst, options);
    expect(second.position?.players[2]?.play[0]?.exerted).toBe(true);
    second.submit({ type: 'Action', action: { type: 'End Turn', player: 2 } });
    if (!second.result) throw new Error('Missing third turn');
    const thirdTurn = startTurn(second.result, options);
    expect(thirdTurn.position?.players[3]?.play[0]?.exerted).toBe(true);
    thirdTurn.submit({ type: 'Action', action: { type: 'End Turn', player: 3 } });
    if (!thirdTurn.result) throw new Error('Missing next round');
    expect(thirdTurn.result.turn).toEqual({ number: 4, player: 2 });
    const next = startTurn(thirdTurn.result, options);
    expect(next.position?.players[2]?.play[0]?.exerted).toBe(false);
});

describe('complete turns', () => {
    it('inks, pays, plays and prevents questing while drying, then replays exactly', () => {
        const state = base(), p = required(state, 1);
        const ink = { ...hero, i: 2 };
        p.hand = [hero, ink];
        const live = startTurn(state, options);
        expect(live.request?.type).toBe('Action');
        live.submit({ type: 'Action', action: { type: 'Ink', player: 1, card: ink } });
        expect(() => live.submit({ type: 'Action', action: { type: 'Ink', player: 1, card: hero } })).toThrow(InvalidInput);
        live.submit({ type: 'Action', action: { type: 'Play', player: 1, card: hero } });
        expect(live.request?.type).toBe('Pay Cost');
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: [ink] }] } });
        expect(() => live.submit({ type: 'Action', action: { type: 'Quest', player: 1, card: hero } })).toThrow(InvalidInput);
        live.submit(end);
        expect(live.result?.turn).toEqual({ number: 2, player: 2 });
        expect(live.result?.players[1]?.play).toEqual([{ card: hero, drying: true, exerted: false }]);
        expect(applyTurn(state, JSON.parse(JSON.stringify(live.turn)), options)).toEqual(live.result);
        expect(p.hand).toEqual([hero, ink]);
        const prefix = live.turn.steps.slice(0, 2);
        expect(resumeTurn(state, prefix, options).request?.type).toBe('Pay Cost');
        expect(() => applyTurn(state, { steps: prefix }, options)).toThrow('incomplete');
        expect(() => applyTurn(state, { steps: [...live.turn.steps, end] }, options)).toThrow('already complete');
    });

    it('readies and dries cards, and only the first player skips the first draw', () => {
        const state = base();
        required(state, 1).play = [{ card: hero, exerted: true, drying: true }];
        required(state, 1).deck = [{ ...hero, i: 2 }];
        const first = startTurn(state, options);
        expect(first.position?.players[1]?.hand).toHaveLength(0);
        expect(first.position?.players[1]?.play[0]).toMatchObject({ exerted: false, drying: false });
        first.submit(end);
        const next = first.result;
        if (!next) throw new Error('Missing next turn');
        const withDeck = { ...next, players: { ...next.players, 2: { ...required(next, 2), deck: [{ ...hero, i: 3 }] } } };
        const second = startTurn(withDeck, options);
        expect(second.position?.players[2]?.hand).toEqual([{ ...hero, i: 3 }]);
    });

    it('an empty deck loses at turn end, not when a draw is attempted', () => {
        const state = base();
        state.turn = { number: 2, player: 2 };
        required(state, 2).deck = [];
        const live = startTurn(state, options);
        expect(live.request?.type).toBe('Action');
        expect(live.outcome).toBeUndefined();
        live.submit({ type: 'Action', action: { type: 'End Turn', player: 2 } });
        expect(live.request).toBeUndefined();
        expect(live.outcome).toEqual({ reason: 'Empty Deck', winners: [1] });
        expect(applyTurn(state, live.turn, options)).toEqual(live.result);
    });

    it('finishes all effects before checking a transient lore victory', () => {
        const state = base();
        required(state, 1).lore = 19;
        const live = startEffect(state, { type: 'Sequence', effects: [
            { type: 'Gain Lore', player: 'You', amount: 2 },
            { type: 'Lose Lore', player: 'You', amount: 3 },
        ] }, { card: hero, player: 1, kind: 'Ability' }, options);
        expect(live.result?.players[1]?.lore).toBe(18);
        expect(live.outcome).toBeUndefined();
    });

    it('a start-of-turn trigger refills the deck before the normal draw', () => {
        const refill: CharacterCard = { ...character, abilities: [{ type: 'Triggered', trigger: { event: 'Turn Start', player: 'You' },
            effect: { type: 'Move Card', cards: { zone: 'Discard', player: 'You' }, to: 'Deck', position: 'Top' } }] };
        const lookup = { card: (name: string) => name === hero.fullName ? refill : getCard(name) };
        const state = base(), drawn = { ...hero, i: 3 };
        state.turn = { number: 3, player: 1 };
        required(state, 1).deck = [];
        required(state, 1).discard = [drawn];
        required(state, 1).play = [{ card: hero }];
        const live = startTurn(state, lookup);
        expect(live.position?.players[1]?.hand).toEqual([drawn]);
        expect(live.outcome).toBeUndefined();
        live.submit(end);
        expect(live.outcome).toEqual({ reason: 'Empty Deck', winners: [2] });
        expect(applyTurn(state, live.turn, lookup)).toEqual(live.result);
    });

    it('an end-of-turn trigger can prevent empty-deck loss', () => {
        const refill: CharacterCard = { ...character, abilities: [{ type: 'Triggered', trigger: { event: 'Turn End', player: 'You' },
            effect: { type: 'Move Card', cards: { zone: 'Discard', player: 'You' }, to: 'Deck', position: 'Top' } }] };
        const lookup = { card: (name: string) => name === hero.fullName ? refill : getCard(name) };
        const state = base(), returned = { ...hero, i: 3 };
        required(state, 1).deck = [];
        required(state, 1).discard = [returned];
        required(state, 1).play = [{ card: hero }];
        const live = startTurn(state, lookup);
        live.submit(end);
        expect(live.outcome).toBeUndefined();
        expect(live.result?.players[1]?.deck).toEqual([returned]);
        expect(live.result?.turn.player).toBe(2);
    });

    it('start-of-next-turn protection still applies while cards ready, then expires', () => {
        const state = base();
        state.turn = { number: 3, player: 1 };
        required(state, 1).play = [{ card: hero, exerted: true, modifiers: [
            { restriction: "Can't Ready", expires: { startOfNextTurn: 1, afterTurn: 1 } },
        ] }];
        const live = startTurn(state, options);
        expect(live.position?.players[1]?.play[0]).toMatchObject({ exerted: true, modifiers: [] });
    });

    it('during-your-turn restrictions begin after the Ready step', () => {
        const restricted: CharacterCard = { ...character, abilities: [{ type: 'Static', rule: { type: 'Conditional',
            if: { duringTurnOf: 'You' }, then: { type: 'Modify Cards', cards: 'Self', modifier: { restriction: "Can't Ready" } },
        } }] };
        const lookup = { card: (name: string) => name === hero.fullName ? restricted : getCard(name) };
        const state = base();
        required(state, 1).play = [{ card: hero, exerted: true }];
        const live = startTurn(state, lookup);
        expect(live.position?.players[1]?.play[0].exerted).toBe(false);
        if (!live.position) throw new Error('Missing ready position');
        expect(new Rules(live.position, lookup.card).restricted(hero, "Can't Ready")).toBe(true);
    });

    it('deals challenge damage simultaneously and banishes both characters', () => {
        const state = base(), other = { ...hero, i: 2 };
        required(state, 1).play = [{ card: hero, damage: 1 }];
        required(state, 2).play = [{ card: other, damage: 1, exerted: true }];
        const live = startAction(state, { type: 'Challenge', player: 1, attacker: hero, defender: other }, options);
        expect(live.result?.players[1]?.discard).toEqual([hero]);
        expect(live.result?.players[2]?.discard).toEqual([other]);
        expect(live.result?.players[1]?.play).toHaveLength(0);
        expect(live.result?.players[2]?.play).toHaveLength(0);
    });

    it('resolves an actual Merlin Goat play trigger from the embedded catalog', () => {
        const state = base(), goat = { fullName: 'Merlin - Goat', i: 8 };
        required(state, 1).hand = [goat];
        const definition = getCard(goat.fullName);
        if (!definition) throw new Error('Missing catalog card');
        const ink = Array.from({ length: definition.cost }, (_, i) => ({ card: { ...hero, i: i + 20 }, exerted: false }));
        required(state, 1).inkwell = ink;
        const live = startAction(state, { type: 'Play', player: 1, card: goat }, options);
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: ink.map(entry => entry.card) }] } });
        expect(live.result?.players[1]?.lore).toBe(1);
        expect(live.result?.players[1]?.play[0].card).toEqual(goat);
    });

    it('applies a static strength aura through the same query used for challenges', () => {
        const aura: CharacterCard = { ...character, fullName: 'Test Aura', abilities: [{ type: 'Static', rule: { type: 'Modify Cards',
            cards: { zone: 'Play', player: 'You', cardType: 'Character', exclude: 'Self' }, modifier: { stat: 'Strength', amount: 2 } } }] };
        const state = base();
        required(state, 1).play = [{ card: hero }, { card: { fullName: aura.fullName, i: 2 } }];
        const lookup = (name: string) => name === aura.fullName ? aura : options.card(name);
        expect(new Rules(state, lookup).characteristic(hero, 'Strength')).toBe(4);
        expect(getLegalActions(state, { card: lookup }).some(action => action.type === 'Quest')).toBe(true);
    });

    it('preserves selected deck ordering through explicit order decisions', () => {
        const state = base(), cards = [hero, { ...hero, i: 2 }, { ...hero, i: 3 }];
        required(state, 2).deck = cards;
        const live = startEffect(state, { type: 'Sequence', effects: [
            { type: 'Look', cards: { zone: 'Deck', player: 'Opponents', take: 3 } },
            { type: 'Move Card', cards: { result: 'Looked At Cards' }, to: 'Deck', position: 'Top', order: 'Chosen' },
        ] }, { card: hero, player: 1, kind: 'Ability' }, options);
        live.submit({ type: 'Decision', answer: { type: 'Order Cards', cards: [cards[2], cards[0], cards[1]] } });
        expect(live.result?.players[2]?.deck).toEqual([cards[2], cards[0], cards[1]]);
    });
});

it('finishes 1000 seeded self-play games with conservation and deterministic turn records', () => {
    let randomState = 12345;
    const random = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; };
    const identities = (state: GameState): CardIdentifier[] => Object.values(state.players).flatMap(p => p ? [...p.deck, ...p.hand, ...p.discard,
        ...p.inkwell.map(card => card.card), ...p.play.flatMap(card => [card.card, ...(card.under?.map(under => under.card) ?? [])])] : []);
    for (let game = 0; game < 1000; game++) {
        let state = base();
        for (const number of [1, 2] as const) {
            const cards = Array.from({ length: 30 }, (_, i) => ({ ...hero, i: number * 100 + i }));
            const p = required(state, number);
            p.hand = cards.slice(0, 7); p.deck = cards.slice(7);
        }
        const original = identities(state).map(card => card.i).sort((a, b) => a - b);
        let finished = false;
        for (let turn = 0; turn < 100 && !finished; turn++) {
            const before = state, live = startTurn(before, options);
            for (let request = live.request; request; request = live.request) {
                if (request.type === 'Action') {
                    const action = request.actions[Math.floor(random() * request.actions.length)];
                    live.submit({ type: 'Action', action });
                } else if (request.type === 'Pay Cost') {
                    if (typeof request.player !== 'number') throw new Error('Unexpected collective payment');
                    const p = live.position?.players[request.player], cost = request.cost[0];
                    if (!p || cost.type !== 'Ink' || typeof cost.amount !== 'number') throw new Error('Unexpected payment');
                    const answer: DecisionAnswer = { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: request.player,
                        cards: p.inkwell.filter(card => !card.exerted).slice(0, cost.amount).map(card => card.card) }] };
                    live.submit({ type: 'Decision', answer });
                } else throw new Error(`Unexpected self-play request: ${request.type}`);
            }
            const result = live.result;
            if (!result) throw new Error('Turn did not complete');
            expect(identities(result).map(card => card.i).sort((a, b) => a - b)).toEqual(original);
            // One complete game is enough to check every turn's serialized reconstruction.
            if (game === 0) expect(applyTurn(before, JSON.parse(JSON.stringify(live.turn)), options)).toEqual(result);
            state = result;
            finished = live.outcome !== undefined;
        }
        expect(finished).toBe(true);
    }
}, 120000);
