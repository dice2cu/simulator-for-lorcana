import { describe, expect, it } from 'vitest';
import { startAction, startEffect, startTurn } from '../../engine/engine';
import { getLegalActions } from '../../engine/actions';
import type { GameState, PlayerPosition } from '../../model/game-state';
import type { Card, CharacterCard, ItemCard } from '../../model/card';

const basic: CharacterCard = { fullName: 'Basic', names: ['Basic'], type: 'Character', colors: ['Amber'], subtypes: [],
    cost: 1, inkwell: true, strength: 2, willpower: 10, lore: 1 };
const hero = { fullName: basic.fullName, i: 1 }, enemy = { ...hero, i: 2 };
function setup(...cards: Card[]) {
    const player = (): PlayerPosition => ({ lore: 0, turnsTaken: 0, deck: [], hand: [], discard: [], inkwell: [], play: [] });
    const p1 = player(), p2 = player();
    const state: GameState = { turn: { number: 1, player: 1 }, players: { 1: p1, 2: p2 } };
    return { state, p1, p2, options: { card: (name: string) => [...cards, basic].find(card => card.fullName === name) } };
}

describe('granted ability occurrences and suppression', () => {
    it('as-if-name Shift permissions fill a Duo name but do not waive classification requirements', () => {
        const morph: CharacterCard = { ...basic, fullName: 'Name Substitute', names: ['Name Substitute'], abilities: [{ type: 'Static', rule: {
            type: 'Can Shift Onto', cards: { zone: 'Hand', player: 'You', cardType: 'Character' }, onto: 'Self',
        } }] };
        const duo: CharacterCard = { ...basic, fullName: 'Duo', names: ['Left', 'Right'], abilities: [{ type: 'Keyword',
            keyword: { name: 'Shift', cost: [], count: 2, names: ['Left', 'Right'] } }] };
        const left: CharacterCard = { ...basic, fullName: 'Left', names: ['Left'] };
        const puppy: CharacterCard = { ...basic, fullName: 'Puppy', names: ['Puppy'], subtypes: ['Puppy'], abilities: [{ type: 'Keyword',
            keyword: { name: 'Shift', cost: [], onto: { zone: 'Play', player: 'You', cardType: 'Character', where: { classification: 'Puppy' } } } }] };
        const { state, p1, options } = setup(morph, duo, left, puppy);
        const substitute = { fullName: morph.fullName, i: 1 }, base = { fullName: left.fullName, i: 2 }, top = { fullName: duo.fullName, i: 3 };
        p1.play = [{ card: substitute }, { card: base }]; p1.hand = [top, { fullName: puppy.fullName, i: 4 }];
        const actions = getLegalActions(state, options);
        expect(actions.some(action => action.type === 'Shift' && action.card.fullName === duo.fullName)).toBe(true);
        expect(actions.some(action => action.type === 'Shift' && action.card.fullName === puppy.fullName)).toBe(false);
    });
    it('restoring a suppressed grant does not reset its once-per-turn use', () => {
        const suppressor: ItemCard = { ...basic, fullName: 'Suppression Switch', names: ['Suppression Switch'], type: 'Item', abilities: [
            { type: 'Activated', cost: [], effect: { type: 'Modify Cards', cards: { zone: 'Play', player: 'You', cardType: 'Character' },
                modifier: { loseAbility: 'All' }, duration: { whileInPlay: 'Self' } } },
            { type: 'Activated', cost: [], effect: { type: 'Banish', cards: 'Self' } },
        ] };
        const { state, p1, options } = setup(suppressor);
        const switchCard = { fullName: suppressor.fullName, i: 3 };
        p1.play = [{ card: hero, modifiers: [{ gainAbility: { type: 'Activated', cost: [], limit: { perTurn: 1, count: 'Uses' },
            effect: { type: 'Gain Lore', player: 'You', amount: 1 } } }] }, { card: switchCard }];
        const live = startTurn(state, options);
        const request = live.request;
        if (request?.type !== 'Action') throw new Error('Missing actions');
        const grant = request.actions.find(action => action.type === 'Activate' && 'rule' in action);
        if (!grant) throw new Error('Missing grant');
        live.submit({ type: 'Action', action: grant });
        live.submit({ type: 'Action', action: { type: 'Activate', player: 1, ability: { card: switchCard, i: 0 } } });
        live.submit({ type: 'Action', action: { type: 'Activate', player: 1, ability: { card: switchCard, i: 1 } } });
        expect(live.position?.players[1]?.lore).toBe(1);
        expect(live.request?.type === 'Action' && live.request.actions.some(action => action.type === 'Activate' && 'rule' in action)).toBe(false);
    });
    it('counts identical grants from two physical providers independently', () => {
        const provider: CharacterCard = { ...basic, fullName: 'Duplicate Provider', names: ['Duplicate Provider'], abilities: [{ type: 'Static', rule: {
            type: 'Modify Cards', cards: { zone: 'Play', player: 'You', cardType: 'Character', where: { name: 'Basic' } }, modifier: {
                gainAbility: { type: 'Activated', cost: [], limit: { perTurn: 1, count: 'Uses' }, effect: { type: 'Gain Lore', player: 'You', amount: 1 } },
            },
        } }] };
        const { state, p1, options } = setup(provider);
        p1.play = [{ card: hero }, ...[3, 4].map(i => ({ card: { fullName: provider.fullName, i } }))];
        const live = startTurn(state, options);
        const request = live.request;
        if (request?.type !== 'Action') throw new Error('Missing actions');
        const actions = request.actions.filter(action => action.type === 'Activate');
        expect(actions).toHaveLength(2);
        live.submit({ type: 'Action', action: actions[0] });
        live.submit({ type: 'Action', action: actions[1] });
        expect(live.position?.players[1]?.lore).toBe(2);
        expect(live.request?.type === 'Action' && live.request.actions.some(action => action.type === 'Activate')).toBe(false);
    });
    it('identical granted activations have independent limits and stable live rule slots', () => {
        const { state, p1, options } = setup();
        p1.play = [{ card: hero, modifiers: [0, 1].map(() => ({ gainAbility: { type: 'Activated' as const, cost: [],
            limit: { perTurn: 1, count: 'Uses' as const }, effect: { type: 'Gain Lore' as const, player: 'You' as const, amount: 1 } } })) }];
        const live = startTurn(state, options);
        const request = live.request;
        if (request?.type !== 'Action') throw new Error('Missing actions');
        const granted = request.actions.filter(action => action.type === 'Activate' && 'rule' in action);
        expect(granted).toHaveLength(2);
        live.submit({ type: 'Action', action: granted[0] });
        const remaining = live.request;
        if (remaining?.type !== 'Action') throw new Error('Missing next actions');
        expect(remaining.actions).not.toContainEqual(granted[0]);
        expect(remaining.actions).toContainEqual(granted[1]);
        live.submit({ type: 'Action', action: granted[1] });
        expect(live.position?.players[1]?.lore).toBe(2);
    });

    it('a granted leave trigger retains its recipient as Self after banishment', () => {
        const { state, p1, p2, options } = setup();
        p1.play = [{ card: hero }]; p2.play = [{ card: enemy, exerted: true, damage: 9, modifiers: [{ gainAbility: {
            type: 'Triggered', trigger: { event: 'Banish', card: 'Self', kind: 'Challenge' }, effect: { type: 'Move Card', cards: 'Self', to: 'Hand' },
        } }] }];
        const result = startAction(state, { type: 'Challenge', player: 1, attacker: hero, defender: enemy }, options).result;
        expect(result?.players[2]?.play).toEqual([]);
        expect(result?.players[2]?.hand).toEqual([enemy]);
        expect(result?.players[2]?.discard).toEqual([]);
    });

    it('a granted static permission makes ready opposing characters legal challenge targets', () => {
        const { state, p1, p2, options } = setup();
        p1.play = [{ card: hero, modifiers: [{ gainAbility: { type: 'Static', rule: {
            type: 'Modify Cards', cards: 'Self', modifier: { permission: 'Can Challenge Ready Characters' },
        } } }] }]; p2.play = [{ card: enemy }];
        expect(getLegalActions(state, options)).toContainEqual({ type: 'Challenge', player: 1, attacker: hero, defender: enemy });
    });

    it('suppresses a named static ability without removing the printed slot', () => {
        const stone: CharacterCard = { ...basic, abilities: [{ type: 'Static', name: 'STONE BY DAY', rule: {
            type: 'Modify Cards', cards: 'Self', modifier: { restriction: "Can't Quest" },
        } }] };
        const { state, p1, options } = setup(stone);
        p1.play = [{ card: hero }];
        expect(getLegalActions(state, options)).not.toContainEqual({ type: 'Quest', player: 1, card: hero });
        const changed = startEffect(state, { type: 'Modify Cards', cards: 'Self', modifier: { loseAbility: { name: 'STONE BY DAY' } } },
            { card: hero, player: 1, kind: 'Ability' }, options).result;
        if (!changed) throw new Error('Suppression did not resolve');
        expect(getLegalActions(changed, options)).toContainEqual({ type: 'Quest', player: 1, card: hero });
        expect(stone.abilities?.[0]).toMatchObject({ type: 'Static', name: 'STONE BY DAY' });
    });

    it('offers a continuously granted Shift on a card still in hand', () => {
        const provider: CharacterCard = { ...basic, fullName: 'Shift Provider', abilities: [{ type: 'Static', rule: {
            type: 'Modify Cards', cards: { zone: 'Hand', player: 'You', cardType: 'Character' }, modifier: {
                gainAbility: { type: 'Keyword', keyword: { name: 'Shift', cost: [] } },
            },
        } }] };
        const { state, p1, options } = setup(provider);
        const top = { ...hero, i: 3 };
        p1.hand = [top]; p1.play = [{ card: hero }, { card: { fullName: provider.fullName, i: 4 } }];
        const action = getLegalActions(state, options).find(action => action.type === 'Shift' && 'rule' in action);
        if (!action) throw new Error('Missing granted Shift');
        const result = startAction(state, action, options).result;
        expect(result?.players[1]?.play[0].card).toEqual(top);
        expect(result?.players[1]?.play[0].under).toEqual([{ card: hero, faceDown: false }]);
    });
});
