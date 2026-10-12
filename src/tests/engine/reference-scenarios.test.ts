import { describe, expect, it } from 'vitest';
import { startAction, startEffect, startTurn } from '../../engine/engine';
import { getCard } from '../../cards';
import { Rules } from '../../engine/rules';
import { getLegalActions } from '../../engine/actions';
import type { GameState, PlayerPosition } from '../../model/game-state';
import type { CharacterCard } from '../../model/card';
import type { CardIdentifier } from '../../model/identity';
import { sameCard } from '../../engine/identity';
import { playGame } from '../../player/runner';
import { ScriptedPlayer } from '../player/scripted-player';

function player(): PlayerPosition { return { lore: 0, turnsTaken: 0, deck: [], hand: [], discard: [], play: [], inkwell: [] }; }
function setup(): { state: GameState; p1: PlayerPosition; p2: PlayerPosition } {
    const p1 = player(), p2 = player();
    return { state: { turn: { number: 1, player: 1 }, players: { 1: p1, 2: p2 } }, p1, p2 };
}
function ink(p: PlayerPosition, count: number): CardIdentifier[] {
    const cards = Array.from({ length: count }, (_, i) => ({ fullName: 'Dinglehopper', i: i + 100 }));
    p.inkwell = cards.map(card => ({ card, exerted: false }));
    return cards;
}

describe('reference outcomes on the new state', () => {
    it('Twin Fire cannot hit its first target again after choosing the discard cost', () => {
        const { state, p1, p2 } = setup();
        const source = { fullName: 'Twin Fire', i: 1 };
        const discarded = { fullName: 'Dinglehopper', i: 2 };
        const first = { fullName: 'Mickey Mouse - True Friend', i: 3 };
        const second = { fullName: 'Mickey Mouse - True Friend', i: 4 };
        p1.hand = [discarded];
        p2.play = [{ card: first }, { card: second }];
        const card = getCard(source.fullName);
        if (card?.type !== 'Action') throw new Error('Missing Twin Fire');
        const live = startEffect(state, card.effect, { card: source, player: 1, kind: 'Action' });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [first] } });
        live.submit({ type: 'Decision', answer: { type: 'Optional', accept: true } });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [discarded] } });
        expect(live.request).toMatchObject({ type: 'Choose Cards', cards: [second] });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [second] } });
        expect(live.result?.players[2]?.play.map(card => card.damage)).toEqual([2, 2]);
        expect(live.result?.players[1]?.discard).toEqual([discarded]);
    });
    it('Goofy moves the other character to the event location, not onto that character', () => {
        const { state, p1 } = setup();
        const goofy = { fullName: 'Goofy - Set for Adventure', i: 1 };
        const ally = { fullName: 'Mickey Mouse - True Friend', i: 2 };
        const location = { fullName: 'Motunui - Island Paradise', i: 3 };
        p1.play = [{ card: goofy }, { card: ally }, { card: location }];
        p1.deck = [{ fullName: 'Dinglehopper', i: 4 }];
        ink(p1, 1);
        const player = new ScriptedPlayer()
            .action(action => action.type === 'Move' && sameCard(action.card, goofy) && sameCard(action.location, location))
            .on('Pay Cost', request => {
                expect(request.cost).toEqual([{ type: 'Ink', amount: 1 }]);
                expect(request.optional).toBe(false);
                expect(request.ink[0].cards).toHaveLength(1);
                return { type: 'Decision', answer: { type: 'Pay Cost', pay: true,
                    payment: [{ type: 'Ink', player: 1, cards: request.ink[0].cards }] } };
            })
            .on('Optional', () => ({ type: 'Decision', answer: { type: 'Optional', accept: true } }))
            .on('Choose Cards', request => {
                expect(request).toMatchObject({ cards: [ally], min: 1, max: 1 });
                return { type: 'Decision', answer: { type: 'Choose Cards', cards: [ally] } };
            })
            .action(action => action.type === 'End Turn');
        const result = playGame([
            { player: 1, deck: [], controller: player },
            { player: 2, deck: [], controller: new ScriptedPlayer() },
        ], { seed: 1, from: state, turns: 1, audit: true }).final;
        expect(result.players[1]?.play[1].location).toEqual(location);
        expect(result.players[1]?.hand).toHaveLength(1);
    });
    it('Moana readies characters at her location, not characters located on Moana herself', () => {
        const { state, p1 } = setup();
        const moana = { fullName: 'Moana - Born Leader', i: 1 };
        const ally = { fullName: 'Mickey Mouse - True Friend', i: 2 };
        const elsewhere = { fullName: 'Mickey Mouse - True Friend', i: 3 };
        const location = { fullName: 'Motunui - Island Paradise', i: 4 };
        p1.play = [
            { card: moana, location }, { card: ally, location, exerted: true },
            { card: elsewhere, exerted: true }, { card: location },
        ];
        const live = startAction(state, { type: 'Quest', player: 1, card: moana });
        const result = live.result;
        if (!result) throw new Error('Quest did not complete');
        expect(result.players[1]?.play[1].exerted).toBe(false);
        expect(result.players[1]?.play[2].exerted).toBe(true);
        expect(new Rules(result).restricted(ally, "Can't Quest")).toBe(true);
        expect(new Rules(result).restricted(elsewhere, "Can't Quest")).toBe(false);
    });
    it('Everybody\'s Got a Weakness moves damage to one chosen recipient and draws the actual total', () => {
        const { state, p1, p2 } = setup();
        const source = { fullName: "Everybody's Got a Weakness", i: 1 };
        const first = { fullName: 'Mickey Mouse - True Friend', i: 2 };
        const second = { fullName: 'Mickey Mouse - True Friend', i: 3 };
        const target = { fullName: 'Goofy - Super Goof', i: 4 };
        p1.play = [{ card: first, damage: 2 }, { card: second, damage: 1 }];
        p2.play = [{ card: target }];
        p1.deck = [{ fullName: 'Dinglehopper', i: 5 }, { fullName: 'Dinglehopper', i: 6 }];
        const definition = getCard(source.fullName);
        if (definition?.type !== 'Action') throw new Error('Missing action');
        const live = startEffect(state, definition.effect, { card: source, player: 1, kind: 'Action' });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [target] } });
        const result = live.result;
        if (!result) throw new Error('The single choice did not complete the effect');
        expect(result.players[1]?.play.map(card => card.damage ?? 0)).toEqual([1, 0]);
        expect(result.players[2]?.play[0].damage).toBe(2);
        expect(result.players[1]?.hand).toHaveLength(2);
    });
    it('Lose the Way prevents the exerted character from readying, not the discarded card', () => {
        const { state, p1, p2 } = setup();
        const action = { fullName: 'Lose the Way', i: 1 };
        const discarded = { fullName: 'Dinglehopper', i: 2 };
        const target = { fullName: 'Mickey Mouse - True Friend', i: 3 };
        p1.hand = [discarded]; p2.play = [{ card: target }];
        p2.deck = [{ fullName: 'Dinglehopper', i: 4 }];
        const definition = getCard(action.fullName);
        if (definition?.type !== 'Action') throw new Error('Missing action');
        const live = startEffect(state, definition.effect, { card: action, player: 1, kind: 'Action' });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [target] } });
        live.submit({ type: 'Decision', answer: { type: 'Optional', accept: true } });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [discarded] } });
        const result = live.result;
        if (!result) throw new Error('Effect did not finish');
        expect(result.players[1]?.discard).toEqual([discarded]);
        expect(result.players[2]?.play[0].exerted).toBe(true);
        const next = startTurn({ ...result, turn: { number: 2, player: 2 } });
        expect(next.position?.players[2]?.play[0].exerted).toBe(true);
        expect(next.request).toMatchObject({ type: 'Action', player: 2 });
    });
    it('moves every damage counter for Can\'t Hold it Back Anymore without an amount choice', () => {
        const { state, p1, p2 } = setup();
        const action = { fullName: "Can't Hold it Back Anymore", i: 1 };
        const mine = { fullName: 'Mickey Mouse - True Friend', i: 2 };
        const theirs = { fullName: 'Donald Duck - Boisterous Fowl', i: 3 };
        const recipient = { fullName: 'Goofy - Super Goof', i: 4 };
        p1.play = [{ card: mine, damage: 2 }]; p2.play = [{ card: theirs, damage: 1 }, { card: recipient }];
        const definition = getCard(action.fullName);
        if (definition?.type !== 'Action') throw new Error('Missing action');
        const live = startEffect(state, definition.effect, { card: action, player: 1, kind: 'Action' });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [recipient] } });
        expect(live.request).toBeUndefined();
        expect(live.result?.players[1]?.play[0].damage).toBe(0);
        expect(live.result?.players[2]?.play[0].damage).toBe(0);
        expect(live.result?.players[2]?.play[1]).toMatchObject({ damage: 3, exerted: true });
    });
    it('each player chooses their own free character for The Return of Hercules', () => {
        const { state, p1, p2 } = setup();
        const action = { fullName: 'The Return of Hercules', i: 1 };
        const mine = { fullName: 'Mickey Mouse - True Friend', i: 2 };
        const theirs = { fullName: 'Donald Duck - Boisterous Fowl', i: 3 };
        p1.hand = [action, mine]; p2.hand = [theirs];
        ink(p1, 5);
        p1.deck = [{ fullName: 'Dinglehopper', i: 4 }];
        const first = new ScriptedPlayer()
            .action(candidate => candidate.type === 'Play' && sameCard(candidate.card, action))
            .on('Pay Cost', request => {
                expect(request.cost).toEqual([{ type: 'Ink', amount: 5 }]);
                expect(request.ink[0].cards).toHaveLength(5);
                return { type: 'Decision', answer: { type: 'Pay Cost', pay: true,
                    payment: [{ type: 'Ink', player: 1, cards: request.ink[0].cards }] } };
            })
            .on('Optional', request => {
                expect(request.player).toBe(1);
                return { type: 'Decision', answer: { type: 'Optional', accept: true } };
            })
            .on('Choose Cards', request => {
                expect(request).toMatchObject({ player: 1, cards: [mine], min: 1, max: 1 });
                return { type: 'Decision', answer: { type: 'Choose Cards', cards: [mine] } };
            })
            .action(candidate => candidate.type === 'End Turn');
        const second = new ScriptedPlayer()
            .on('Optional', request => {
                expect(request.player).toBe(2);
                return { type: 'Decision', answer: { type: 'Optional', accept: true } };
            })
            .on('Choose Cards', (request, view) => {
                expect(request).toMatchObject({ player: 2, cards: [theirs], min: 1, max: 1 });
                expect(typeof view.players[1]?.hand).toBe('number');
                return { type: 'Decision', answer: { type: 'Choose Cards', cards: [theirs] } };
            });
        const result = playGame([
            { player: 1, deck: [], controller: first },
            { player: 2, deck: [], controller: second },
        ], { seed: 1, from: state, turns: 1, audit: true }).final;
        expect(result.players[1]?.play.map(card => card.card)).toEqual([mine]);
        expect(result.players[2]?.play.map(card => card.card)).toEqual([theirs]);
    });
    it('singing spends the next-action discount from Dr. Facilier\'s Cards', () => {
        const { state, p1 } = setup();
        const item = { fullName: "Dr. Facilier's Cards", i: 1 }, singer = { fullName: 'Mickey Mouse - True Friend', i: 2 };
        const song = { fullName: 'Friends on the Other Side', i: 3 }, next = { fullName: 'Fire the Cannons!', i: 4 };
        p1.play = [{ card: item }, { card: singer }]; p1.hand = [song, next];
        p1.deck = [5, 6, 7].map(i => ({ fullName: 'Dinglehopper', i }));
        const activation = startAction(state, { type: 'Activate', player: 1, ability: { card: item, i: 0 } });
        activation.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Exert', player: 1, cards: [item] }] } });
        if (!activation.result) throw new Error('Missing discount');
        expect(activation.result.players[1]?.modifiers).toHaveLength(1);
        const live = startAction(activation.result, { type: 'Sing', player: 1, song, singers: [singer] });
        if (!live.result) throw new Error('Song did not finish');
        expect(live.result.players[1]?.modifiers).toEqual([]);
        expect(getLegalActions(live.result).some(action => action.type === 'Play' && action.card.fullName === next.fullName)).toBe(false);
    });

    it('a free character play also spends Lantern\'s next-character discount', () => {
        const { state, p1 } = setup();
        const lantern = { fullName: 'Lantern', i: 1 }, first = { fullName: 'Mickey Mouse - True Friend', i: 2 };
        p1.play = [{ card: lantern }]; p1.hand = [first, { fullName: 'Mickey Mouse - True Friend', i: 3 }];
        const activation = startAction(state, { type: 'Activate', player: 1, ability: { card: lantern, i: 0 } });
        activation.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Exert', player: 1, cards: [lantern] }] } });
        if (!activation.result) throw new Error('Missing Lantern discount');
        const played = startEffect(activation.result, { type: 'Play', cards: { cards: [first] }, free: true }, { card: lantern, player: 1, kind: 'Ability' });
        expect(played.result?.players[1]?.play.map(state => state.card)).toEqual([lantern, first]);
        expect(played.result?.players[1]?.modifiers).toEqual([]);
    });

    it.each([[3, 6, false], [4, 7, true], [6, 9, true], [7, 7, true]])(
        'Capsize with %i ink checks its second condition after the first instruction', (initialInk, finalInk, banishes) => {
            const { state, p1, p2 } = setup();
            const card = { fullName: 'Capsize', i: 1 }, target = { fullName: 'Mickey Mouse - True Friend', i: 2 };
            p1.hand = [card]; p1.deck = [3, 4, 5, 6].map(i => ({ fullName: 'Dinglehopper', i }));
            p2.play = [{ card: target }]; const paid = ink(p1, initialInk).slice(0, 3);
            const live = startAction(state, { type: 'Play', player: 1, card });
            live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: paid }] } });
            if (banishes) {
                expect(live.request).toMatchObject({ type: 'Choose Cards', player: 2 });
                live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [target] } });
            }
            expect(live.result?.players[1]?.inkwell).toHaveLength(finalInk);
            expect(live.result?.players[2]?.discard).toEqual(banishes ? [target] : []);
            expect(live.result?.players[2]?.play).toHaveLength(banishes ? 0 : 1);
        },
    );

    // Reference ability be2578cce757. The lore outcome is unchanged from the old test.
    it.each([[0, 1], [1, 0]])('Scrooge gains end-turn lore when an opponent has %i lore', (opposingLore, expected) => {
        const { state, p1, p2 } = setup();
        p1.play = [{ card: { fullName: 'Scrooge McDuck - Ebenezer Scrooge', i: 1 }, exerted: true }];
        p1.deck = [{ fullName: 'Dinglehopper', i: 2 }]; p2.lore = opposingLore;
        const first = new ScriptedPlayer().action(action => action.type === 'End Turn');
        const result = playGame([
            { player: 1, deck: [], controller: first },
            { player: 2, deck: [], controller: new ScriptedPlayer() },
        ], { seed: 1, from: state, turns: 1, audit: true }).final;
        expect(result.players[1]?.lore).toBe(expected);
    });

    // Reference ability 51124f94642a. Spending the ink exercises the actual turn lifecycle.
    it.each([false, true])('Randall checks ink exhaustion at turn end (spend all: %s)', spendAll => {
        const { state, p1 } = setup();
        p1.play = [{ card: { fullName: 'Randall Boggs - Scary Smart', i: 1 } }];
        p1.deck = [{ fullName: 'Dinglehopper', i: 2 }]; ink(p1, 2);
        const filler = { fullName: 'Mickey Mouse - True Friend', i: 3 };
        // Mickey costs 3, so use the two-cost action to spend both ink cards.
        const ransack = { fullName: 'Ransack', i: 4 };
        p1.hand = [ransack, filler];
        if (spendAll) p1.deck = [{ fullName: 'Dinglehopper', i: 5 }, { fullName: 'Dinglehopper', i: 6 }, ...p1.deck];
        const first = new ScriptedPlayer();
        if (spendAll) {
            first.action(action => action.type === 'Play' && sameCard(action.card, ransack))
                .on('Pay Cost', request => {
                    expect(request.cost).toEqual([{ type: 'Ink', amount: 2 }]);
                    expect(request.ink[0].cards).toHaveLength(2);
                    return { type: 'Decision', answer: { type: 'Pay Cost', pay: true,
                        payment: [{ type: 'Ink', player: 1, cards: request.ink[0].cards }] } };
                })
                .on('Choose Cards', request => {
                    expect(request).toMatchObject({ min: 2, max: 2 });
                    const discarded = [{ fullName: 'Dinglehopper', i: 5 }, { fullName: 'Dinglehopper', i: 6 }];
                    for (const card of discarded) expect(request.cards).toContainEqual(card);
                    return { type: 'Decision', answer: { type: 'Choose Cards', cards: discarded } };
                });
        }
        first.action(action => action.type === 'End Turn');
        const result = playGame([
            { player: 1, deck: [], controller: first },
            { player: 2, deck: [], controller: new ScriptedPlayer() },
        ], { seed: 1, from: state, turns: 1, audit: true }).final;
        expect(result.players[1]?.lore).toBe(spendAll ? 1 : 0);
    });

    // Reference ability d7feee051d4a. Preserve the extra-card expectation, but satisfy its trigger.
    it('Milo draws at turn end only after cards actually entered discard this turn', () => {
        const { state, p1 } = setup();
        const milo = { fullName: 'Milo Thatch - Getting His Hands Dirty', i: 1 }, action = { fullName: 'Ransack', i: 2 };
        const draws = [3, 4, 5, 6].map(i => ({ fullName: 'Dinglehopper', i }));
        p1.play = [{ card: milo }]; p1.hand = [action]; p1.deck = draws; const paid = ink(p1, 2);
        const live = startTurn(state);
        live.submit({ type: 'Action', action: { type: 'Play', player: 1, card: action } });
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: paid }] } });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: draws.slice(0, 2) } });
        expect(live.position?.players[1]?.hand).toEqual([]);
        live.submit({ type: 'Action', action: { type: 'End Turn', player: 1 } });
        expect(live.result?.players[1]?.hand).toEqual([draws[2]]);
        expect(live.result?.players[1]?.deck).toEqual([draws[3]]);
    });

    it('two Ursulas cannot replay a sung song twice after it has left the discard', () => {
        const { state, p1, p2 } = setup();
        const first = { fullName: 'Ursula - Deceiver of All', i: 1 }, second = { ...first, i: 2 };
        const song = { fullName: "A Pirate's Life", i: 3 };
        p1.play = [{ card: first }, { card: second }]; p1.hand = [song]; p2.lore = 10;
        const live = startAction(state, { type: 'Sing', player: 1, song, singers: [first, second] });
        expect(live.request?.type).toBe('Choose Trigger');
        const choice = live.request;
        if (choice?.type !== 'Choose Trigger') throw new Error('Missing Ursula ordering');
        live.submit({ type: 'Decision', answer: { type: 'Choose Trigger', trigger: choice.options[0].reference } });
        live.submit({ type: 'Decision', answer: { type: 'Optional', accept: true } });
        expect(live.position?.players[1]?.deck).toEqual([song]);
        live.submit({ type: 'Decision', answer: { type: 'Optional', accept: true } });
        expect(live.result?.players[1]?.lore).toBe(4);
        expect(live.result?.players[2]?.lore).toBe(6);
        expect(live.result?.players[1]?.deck).toEqual([song]);
        expect(live.result?.players[1]?.discard).toEqual([]);
    });

    it('I2I can read its singing characters while its action effect resolves', () => {
        const { state, p1, p2 } = setup();
        const singer: CharacterCard = { type: 'Character', fullName: 'Singer Fixture', names: ['Singer Fixture'], colors: [], subtypes: [],
            cost: 5, inkwell: false, strength: 1, willpower: 5, lore: 1 };
        const first = { fullName: singer.fullName, i: 1 }, second = { ...first, i: 2 }, song = { fullName: 'I2I', i: 3 };
        p1.play = [{ card: first }, { card: second }]; p1.hand = [song];
        p1.deck = [4, 5].map(i => ({ fullName: 'Dinglehopper', i }));
        p2.deck = [6, 7].map(i => ({ fullName: 'Dinglehopper', i }));
        const options = { card: (name: string) => name === singer.fullName ? singer : getCard(name) };
        const live = startAction(state, { type: 'Sing', player: 1, song, singers: [first, second] }, options);
        const result = live.result;
        if (!result) throw new Error('Song did not finish');
        expect(result.players[1]?.hand).toHaveLength(2);
        expect(result.players[2]?.hand).toHaveLength(2);
        expect(result.players[1]?.lore).toBe(2);
        expect(result.players[2]?.lore).toBe(2);
        expect(result.players[1]?.play.map(state => state.exerted)).toEqual([false, false]);
        expect(new Rules(result, options.card).restricted(first, "Can't Quest")).toBe(true);
        expect(new Rules(result, options.card).restricted(second, "Can't Quest")).toBe(true);
    });
    it('The Queen gains the discarded character\'s lore, not her own exertion or ink resources', () => {
        const { state, p1 } = setup();
        const queen = { fullName: 'The Queen - Disguised Peddler', i: 1 }, discarded = { fullName: 'Mickey Mouse - True Friend', i: 2 };
        p1.play = [{ card: queen }]; p1.hand = [discarded];
        const definition = getCard(discarded.fullName);
        if (!definition || definition.type !== 'Character') throw new Error('Missing discarded character');
        const live = startAction(state, { type: 'Activate', player: 1, ability: { card: queen, i: 0 } });
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [
            { type: 'Exert', player: 1, cards: [queen] }, { type: 'Discard', player: 1, cards: [discarded] },
        ] } });
        expect(live.result?.players[1]?.lore).toBe(definition.lore);
        expect(live.result?.players[1]?.discard).toEqual([discarded]);
    });

    it('Powhatan\'s Staff changes only the next character\'s entry, then its grant expires', () => {
        const { state, p1, p2 } = setup();
        p1.deck = [200, 201].map(i => ({ fullName: 'Dinglehopper', i }));
        const staff = { fullName: "Powhatan's Staff", i: 1 }, first = { fullName: 'Mickey Mouse - True Friend', i: 2 }, second = { ...first, i: 3 };
        p1.play = [{ card: staff }]; p1.hand = [first, second]; const paid = ink(p1, 7);
        const live = startTurn(state);
        live.submit({ type: 'Action', action: { type: 'Activate', player: 1, ability: { card: staff, i: 0 } } });
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [
            { type: 'Exert', player: 1, cards: [staff] }, { type: 'Ink', player: 1, cards: paid.slice(0, 1) },
        ] } });
        for (const [i, card] of [first, second].entries()) {
            live.submit({ type: 'Action', action: { type: 'Play', player: 1, card } });
            live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: paid.slice(1 + i * 3, 4 + i * 3) }] } });
        }
        const current = live.position;
        if (!current) throw new Error('Missing live position');
        expect(current.players[1]?.play[1]).toMatchObject({ card: first, exerted: true });
        expect(current.players[1]?.play[2]).toMatchObject({ card: second, exerted: false });
        expect(new Rules(current).keyword(first, 'Bodyguard')).toBe(1);
        expect(new Rules(current).keyword(second, 'Bodyguard')).toBe(0);
        expect(current.players[1]?.modifiers).toEqual([]);
        live.submit({ type: 'Action', action: { type: 'End Turn', player: 1 } });
        const next = live.result;
        if (!next) throw new Error('Missing next turn');
        const opponentTurn = startTurn({ ...next, players: { ...next.players, 2: { ...p2, deck: [202, 203].map(i => ({ fullName: 'Dinglehopper', i })) } } });
        opponentTurn.submit({ type: 'Action', action: { type: 'End Turn', player: 2 } });
        const back = opponentTurn.result;
        if (!back) throw new Error('Missing return turn');
        const returningPlayer = back.players[1];
        if (!returningPlayer) throw new Error('Missing returning player');
        const expired = startTurn({ ...back, players: { ...back.players, 1: { ...returningPlayer, deck: [{ fullName: 'Dinglehopper', i: 201 }] } } });
        const position = expired.position;
        if (!position) throw new Error('Missing expiration position');
        expect(new Rules(position).keyword(first, 'Bodyguard')).toBe(0);
    });
    it('Angela suppresses another Gargoyle\'s printed Stone By Day rule continuously', () => {
        const { state, p1 } = setup();
        const angela = { fullName: 'Angela - Night Warrior', i: 1 }, gargoyle = { fullName: 'Brooklyn - Second in Command', i: 2 };
        p1.play = [{ card: angela }, { card: gargoyle }];
        p1.hand = [3, 4, 5].map(i => ({ fullName: 'Dinglehopper', i }));
        const definition = getCard(gargoyle.fullName);
        if (!definition?.abilities?.some(ability => 'name' in ability && ability.name === 'STONE BY DAY')) throw new Error('Missing Stone By Day');
        expect(new Rules(state).restricted(gargoyle, "Can't Ready")).toBe(false);
        const withoutAngela: GameState = { ...state, players: { ...state.players, 1: { ...p1, play: [{ card: gargoyle }] } } };
        expect(new Rules(withoutAngela).restricted(gargoyle, "Can't Ready")).toBe(true);
    });
    it('Pain gains lore from effective strength without recursively evaluating his lore bonus', () => {
        const { state, p1 } = setup();
        const pain = { fullName: 'Pain - Underworld Imp', i: 1 };
        p1.play = [{ card: pain, modifiers: [{ stat: 'Strength', amount: 5 }] }];
        const definition = getCard(pain.fullName);
        if (!definition || definition.type !== 'Character') throw new Error('Missing Pain');
        const rules = new Rules(state);
        expect(rules.characteristic(pain, 'Strength')).toBe(definition.strength + 5);
        expect(rules.characteristic(pain, 'Lore')).toBe(definition.lore + 2);
    });

    it('Peter Pan\'s Shadow grants Evasive to another Rush character without changing its Rush', () => {
        const { state, p1 } = setup();
        const shadow = { fullName: "Peter Pan's Shadow - Not Sewn On", i: 1 }, rush = { fullName: 'Maui - Hero to All', i: 2 };
        p1.play = [{ card: shadow }, { card: rush }];
        const rules = new Rules(state);
        expect(rules.keyword(rush, 'Rush')).toBe(1);
        expect(rules.keyword(rush, 'Evasive')).toBe(1);
        expect(rules.keyword(shadow, 'Evasive')).toBe(1);
    });

    it('Raksha\'s optional movement discount is shared across her moves and used only once per turn', () => {
        const { state, p1 } = setup();
        const raksha = { fullName: 'Raksha - Fearless Mother', i: 1 };
        const first = { fullName: 'The Queen\'s Castle - Mirror Chamber', i: 2 }, second = { ...first, i: 3 };
        p1.play = [{ card: raksha }, { card: first }, { card: second }]; const paid = ink(p1, 2);
        const live = startTurn(state);
        while (live.request?.type === 'Choose Trigger') live.submit({ type: 'Decision', answer: { type: 'Choose Trigger', trigger: live.request.options[0].reference } });
        live.submit({ type: 'Action', action: { type: 'Move', player: 1, card: raksha, location: first } });
        expect(live.request?.type).toBe('Optional Cost Rule');
        live.submit({ type: 'Decision', answer: { type: 'Optional Cost Rule', accept: true } });
        expect(live.position?.players[1]?.play[0].location).toEqual(first);
        live.submit({ type: 'Action', action: { type: 'Move', player: 1, card: raksha, location: second } });
        expect(live.request?.type).toBe('Pay Cost');
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: paid.slice(0, 1) }] } });
        expect(live.position?.players[1]?.play[0].location).toEqual(second);
    });
    it('Metamorphosis shifts from discard for free and inherits the base state', () => {
        const { state, p1 } = setup();
        const base = { fullName: 'Hercules - True Hero', i: 1 }, top = { fullName: 'Hercules - Divine Hero', i: 2 };
        p1.play = [{ card: base, exerted: true, damage: 1 }]; p1.discard = [top];
        const spell = getCard('Metamorphosis');
        if (!spell || spell.type !== 'Action') throw new Error('Missing Metamorphosis');
        const live = startEffect(state, spell.effect, { card: { fullName: spell.fullName, i: 3 }, player: 1, kind: 'Action' });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [top] } });
        live.submit({ type: 'Action', action: { type: 'Shift', player: 1, card: top, onto: [base], ability: 0 } });
        expect(live.result?.players[1]?.discard).toEqual([]);
        expect(live.result?.players[1]?.play).toEqual([expect.objectContaining({ card: top, damage: 1, exerted: true, under: [{ card: base, faceDown: false }] })]);
        expect(live.result?.players[1]?.inkwell).toEqual([]);
    });
    it('Belle can pay her own static alternate cost from hand by banishing an item', () => {
        const { state, p1 } = setup();
        const belle = { fullName: 'Belle - Apprentice Inventor', i: 1 }, item = { fullName: 'Dinglehopper', i: 2 };
        p1.hand = [belle]; p1.play = [{ card: item }];
        const action = getLegalActions(state).find(action => action.type === 'Play' && action.alternateCost);
        if (!action) throw new Error('Missing Belle alternate cost');
        const live = startAction(state, action);
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Banish', player: 1, cards: [item] }] } });
        expect(live.result?.players[1]?.discard).toEqual([item]);
        expect(live.result?.players[1]?.play[0].card).toEqual(belle);
    });

    it('a Magic Broom can move to the Sorcerer\'s Tower using its free alternate cost', () => {
        const { state, p1 } = setup();
        const broom = { fullName: 'Magic Broom - Bucket Brigade', i: 1 }, tower = { fullName: "The Sorcerer's Tower - Wondrous Workspace", i: 2 };
        p1.play = [{ card: broom }, { card: tower }];
        const action = getLegalActions(state).find(action => action.type === 'Move' && action.alternateCost);
        if (!action) throw new Error('Missing free movement');
        const live = startAction(state, action);
        expect(live.result?.players[1]?.play[0].location).toEqual(tower);
        expect(live.result?.players[1]?.inkwell).toEqual([]);
    });

    it('Temporary Shift does not return a later card shifted over Sun Yee', () => {
        const { state, p1 } = setup();
        const base = { fullName: 'Test Red Panda', i: 1 }, sun = { fullName: 'Sun Yee - Red Panda Spirit', i: 2 };
        const top = { fullName: 'Permanent Red Panda', i: 3 };
        const panda: CharacterCard = { fullName: base.fullName, names: ['Test Red Panda'], type: 'Character', colors: ['Ruby'], subtypes: ['Red Panda'],
            cost: 1, inkwell: true, strength: 1, willpower: 10, lore: 1 };
        const permanent: CharacterCard = { ...panda, fullName: top.fullName, abilities: [{ type: 'Keyword', keyword: {
            name: 'Shift', cost: [], onto: { zone: 'Play', player: 'You', cardType: 'Character' },
        } }] };
        p1.play = [{ card: base, damage: 3 }]; p1.hand = [sun, top]; p1.deck = [{ fullName: 'Dinglehopper', i: 4 }];
        const paid = ink(p1, 2);
        const live = startTurn(state, { card: name => name === base.fullName ? panda : name === top.fullName ? permanent : getCard(name) });
        live.submit({ type: 'Action', action: { type: 'Shift', player: 1, card: sun, onto: [base], ability: 0 } });
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: paid }] } });
        live.submit({ type: 'Action', action: { type: 'Shift', player: 1, card: top, onto: [sun], ability: 0 } });
        live.submit({ type: 'Action', action: { type: 'End Turn', player: 1 } });
        expect(live.result?.players[1]?.hand).toEqual([]);
        expect(live.result?.players[1]?.play[0]).toMatchObject({ card: top, damage: 3, under: [{ card: sun }, { card: base }] });
        expect(live.result?.players[1]?.modifiers).toEqual([]);
    });

    it('Temporary Shift returns only Sun Yee and uncovers the original character', () => {
        const { state, p1 } = setup();
        const base = { fullName: 'Test Red Panda', i: 1 }, top = { fullName: 'Sun Yee - Red Panda Spirit', i: 2 };
        const panda: CharacterCard = { fullName: base.fullName, names: ['Test Red Panda'], type: 'Character', colors: ['Ruby'], subtypes: ['Red Panda'],
            cost: 1, inkwell: true, strength: 1, willpower: 10, lore: 1 };
        p1.play = [{ card: base, damage: 3 }]; p1.hand = [top]; const paid = ink(p1, 2);
        const live = startTurn(state, { card: name => name === base.fullName ? panda : getCard(name) });
        live.submit({ type: 'Action', action: { type: 'Shift', player: 1, card: top, onto: [base], ability: 0 } });
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: paid }] } });
        live.submit({ type: 'Action', action: { type: 'Quest', player: 1, card: top } });
        live.submit({ type: 'Action', action: { type: 'End Turn', player: 1 } });
        expect(live.result?.players[1]?.hand).toEqual([top]);
        expect(live.result?.players[1]?.play[0]).toMatchObject({ card: base, damage: 0, exerted: true });
        expect(live.result?.players[1]?.discard).toEqual([]);
    });

    it.each([
        ['Sleepy - Nodding Off', { exerted: true }],
        ['Mother Gothel - Withered and Wicked', { damage: 3 }],
    ])('%s applies its entry state before play finishes', (name, expected) => {
        const { state, p1 } = setup();
        if (typeof name !== 'string') throw new Error('Invalid card name');
        const card = { fullName: name, i: 1 };
        const definition = getCard(name);
        if (!definition) throw new Error('Missing entry card');
        p1.hand = [card]; const paid = ink(p1, definition.cost);
        const live = startAction(state, { type: 'Play', player: 1, card });
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: paid }] } });
        expect(live.result?.players[1]?.play[0]).toMatchObject(expected);
    });

    it('Mim cannot choose to return two characters when only one other character exists', () => {
        const { state, p1 } = setup();
        const mim = { fullName: 'Madam Mim - Purple Dragon', i: 1 }, goat = { fullName: 'Merlin - Goat', i: 2 };
        p1.hand = [mim]; p1.play = [{ card: goat }];
        const definition = getCard(mim.fullName);
        if (!definition) throw new Error('Missing Mim');
        const paid = ink(p1, definition.cost);
        const live = startAction(state, { type: 'Play', player: 1, card: mim });
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: paid }] } });
        expect(live.result?.players[1]?.play.map(card => card.card)).toEqual([goat]);
        expect(live.result?.players[1]?.discard).toEqual([mim]);
    });

    it('Mim offers both alternatives when returning the required character is possible', () => {
        const { state, p1 } = setup();
        const mim = { fullName: 'Madam Mim - Snake', i: 1 }, goat = { fullName: 'Merlin - Goat', i: 2 };
        p1.hand = [mim]; p1.play = [{ card: goat }];
        const definition = getCard(mim.fullName);
        if (!definition) throw new Error('Missing Mim');
        const paid = ink(p1, definition.cost);
        const live = startAction(state, { type: 'Play', player: 1, card: mim });
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: paid }] } });
        expect(live.request).toMatchObject({ type: 'Choose Mode', options: [{ mode: 0 }, { mode: 1 }] });
        live.submit({ type: 'Decision', answer: { type: 'Choose Mode', mode: 1 } });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [goat] } });
        expect(live.result?.players[1]?.hand).toEqual([goat]);
        expect(live.result?.players[1]?.play.map(card => card.card)).toEqual([mim]);
        expect(live.result?.players[1]?.lore).toBe(1);
    });

    it('Lantern discounts only the next character and consumes the rule when played', () => {
        const { state, p1 } = setup();
        const lantern = { fullName: 'Lantern', i: 1 };
        const first = { fullName: 'Test Character', i: 2 }, second = { ...first, i: 3 };
        const character: CharacterCard = { fullName: first.fullName, names: ['Test Character'], type: 'Character', colors: ['Amber'],
            subtypes: [], cost: 2, inkwell: true, strength: 1, willpower: 2, lore: 1 };
        p1.play = [{ card: lantern }]; p1.hand = [first, second];
        const paid = ink(p1, 3);
        const live = startTurn(state, { card: name => name === first.fullName ? character : getCard(name) });
        live.submit({ type: 'Action', action: { type: 'Activate', player: 1, ability: { card: lantern, i: 0 } } });
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Exert', player: 1, cards: [lantern] }] } });
        expect(live.position?.players[1]?.modifiers).toHaveLength(1);
        live.submit({ type: 'Action', action: { type: 'Play', player: 1, card: first } });
        expect(live.request).toMatchObject({ type: 'Pay Cost', cost: [{ type: 'Ink', amount: 1 }] });
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: [paid[0]] }] } });
        expect(live.position?.players[1]?.modifiers).toEqual([]);
        live.submit({ type: 'Action', action: { type: 'Play', player: 1, card: second } });
        expect(live.request).toMatchObject({ type: 'Pay Cost', cost: [{ type: 'Ink', amount: 2 }] });
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: paid.slice(1) }] } });
        expect(live.position?.players[1]?.play.map(card => card.card)).toEqual([lantern, first, second]);
    });

    // Preserves reference/card-abilities/banish-all-items-bd282bc1b258.test.ts.
    it('bd282bc1b258: Banish all items', () => {
        const { state, p1, p2 } = setup();
        const action = { fullName: "I Find 'Em, I Flatten 'Em", i: 1 };
        p1.hand = [action];
        const paid = ink(p1, 10);
        p1.play = [{ card: { fullName: 'Dinglehopper', i: 2 } }];
        p2.play = [{ card: { fullName: 'Magic Mirror', i: 3 } }];
        const definition = getCard(action.fullName);
        if (!definition) throw new Error('Missing action');
        const live = startAction(state, { type: 'Play', player: 1, card: action });
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: paid.slice(0, definition.cost) }] } });
        expect(live.result?.players[1]?.play).toHaveLength(0);
        expect(live.result?.players[2]?.play).toHaveLength(0);
    });

    // Preserves reference/card-abilities/at-the-end-of-your-turn-remove-up-to-2-damage-from-each-of-y-e96c1fac46ab.test.ts.
    it('e96c1fac46ab: Piglet heals each character at turn end', () => {
        const { state, p1 } = setup();
        const piglet = { fullName: 'Piglet - Cocoa Maker', i: 1 };
        const other = { fullName: 'Other', i: 2 };
        const definition: CharacterCard = { type: 'Character', fullName: other.fullName, names: ['Other'], colors: ['Amber'], subtypes: [],
            cost: 1, inkwell: true, strength: 1, willpower: 10, lore: 1 };
        p1.play = [{ card: piglet, damage: 5 }, { card: other, damage: 4 }];
        const ability = getCard(piglet.fullName)?.abilities?.find(ability => ability.type === 'Triggered');
        if (!ability || ability.type !== 'Triggered') throw new Error('Missing Piglet trigger');
        // The legacy fixture already has lethal damage before turn-end healing.
        // Preserve its effect expectation in isolation, not as a legal whole-turn position.
        const live = startEffect(state, ability.effect, { card: piglet, player: 1, kind: 'Ability' },
            { card: name => name === other.fullName ? definition : getCard(name) });
        live.submit({ type: 'Decision', answer: { type: 'Choose Amount', amount: 2 } });
        live.submit({ type: 'Decision', answer: { type: 'Choose Amount', amount: 2 } });
        expect(live.result?.players[1]?.play.map(card => card.damage)).toEqual([3, 2]);
    });

    it('Rapunzel draws for actual damage removed, not the requested maximum', () => {
        const { state, p1 } = setup();
        const rapunzel = { fullName: 'Rapunzel - Gifted with Healing', i: 1 };
        const target = { fullName: 'Merlin - Goat', i: 2 };
        const draws = [3, 4, 5].map(i => ({ fullName: 'Dinglehopper', i }));
        p1.hand = [rapunzel]; p1.deck = draws;
        p1.play = [{ card: target, damage: 2 }];
        const paid = ink(p1, 4);
        const live = startAction(state, { type: 'Play', player: 1, card: rapunzel });
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: paid }] } });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [target] } });
        live.submit({ type: 'Decision', answer: { type: 'Choose Amount', amount: 2 } });
        expect(live.result?.players[1]?.play[0].damage).toBe(0);
        expect(live.result?.players[1]?.hand).toEqual(draws.slice(0, 2));
        expect(live.result?.players[1]?.deck).toEqual(draws.slice(2));
    });

    it('retains Merlin Goat departure triggers after the source is gone', () => {
        const { state, p1 } = setup();
        const goat = { fullName: 'Merlin - Goat', i: 1 };
        p1.play = [{ card: goat }];
        const live = startEffect(state, { type: 'Banish', cards: { cards: [goat] } }, { card: goat, player: 1, kind: 'Ability' });
        expect(live.result?.players[1]?.lore).toBe(1);
        expect(live.result?.players[1]?.discard).toEqual([goat]);
    });

    it('activates a real item using its printed ability slot and a complete payment', () => {
        const { state, p1 } = setup();
        const mirror = { fullName: 'Magic Mirror', i: 1 }, draw = { fullName: 'Dinglehopper', i: 2 };
        p1.play = [{ card: mirror }]; p1.deck = [draw];
        const paid = ink(p1, 4);
        const live = startAction(state, { type: 'Activate', player: 1, ability: { card: mirror, i: 0 } });
        expect(() => live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Exert', player: 1, cards: [mirror] }] } })).toThrow();
        expect(live.position?.players[1]?.play[0].exerted).toBeUndefined();
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [
            { type: 'Exert', player: 1, cards: [mirror] }, { type: 'Ink', player: 1, cards: paid },
        ] } });
        expect(live.result?.players[1]?.hand).toEqual([draw]);
        expect(live.result?.players[1]?.play[0].exerted).toBe(true);
        expect(p1.play[0].exerted).toBeUndefined();
    });

    it('Gruesome and Grim plays, grants Rush, then banishes the captured character at turn end', () => {
        const { state, p1 } = setup();
        const song = { fullName: 'Gruesome and Grim', i: 1 }, goat = { fullName: 'Merlin - Goat', i: 2 };
        p1.hand = [song, goat];
        const paid = ink(p1, 3);
        const live = startTurn(state);
        live.submit({ type: 'Action', action: { type: 'Play', player: 1, card: song } });
        live.submit({ type: 'Decision', answer: { type: 'Pay Cost', pay: true, payment: [{ type: 'Ink', player: 1, cards: paid }] } });
        live.submit({ type: 'Decision', answer: { type: 'Choose Cards', cards: [goat] } });
        expect(live.position?.players[1]?.lore).toBe(1);
        expect(live.position?.players[1]?.play[0].modifiers).toContainEqual({ gainKeyword: 'Rush' });
        live.submit({ type: 'Action', action: { type: 'End Turn', player: 1 } });
        expect(live.result?.players[1]?.play).toHaveLength(0);
        expect(live.result?.players[1]?.discard).toEqual([song, goat]);
        expect(live.result?.players[1]?.lore).toBe(2);
        expect(live.result?.players[1]?.modifiers).toEqual([]);
    });

    it('Restoring Atlantis protects characters played later and expires at the next turn start', () => {
        const { state, p1 } = setup();
        const atlantis = { fullName: 'Restoring Atlantis', i: 1 }, goat = { fullName: 'Merlin - Goat', i: 2 };
        p1.hand = [goat];
        const definition = getCard(atlantis.fullName);
        if (definition?.type !== 'Action') throw new Error('Missing Atlantis action');
        const protectedState = startEffect(state, definition.effect, { card: atlantis, player: 1, kind: 'Action' }).result;
        if (!protectedState) throw new Error('Protection was not installed');
        const played = startEffect(protectedState, { type: 'Play', cards: { cards: [goat] }, free: true }, { card: atlantis, player: 1, kind: 'Action' }).result;
        if (!played) throw new Error('Character was not played');
        expect(new Rules(played).restricted(goat, "Can't Be Challenged")).toBe(true);
        const next: GameState = { ...played, turn: { number: 3, player: 1 }, players: { ...played.players,
            1: { ...player(), ...played.players[1], deck: [{ fullName: 'Dinglehopper', i: 9 }] } } };
        const live = startTurn(next);
        const position = live.position;
        if (!position) throw new Error('Turn did not start');
        expect(new Rules(position).restricted(goat, "Can't Be Challenged")).toBe(false);
    });
});
