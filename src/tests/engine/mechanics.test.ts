import { describe, expect, it } from "vitest";
import { startAction, startEffect, startTurn } from "../../engine/engine";
import { getLegalActions } from "../../engine/actions";
import { Rules } from "../../engine/rules";
import { emptyResults } from "../../engine/effect-results";
import { getCard } from "../../cards";
import type { Card, CharacterCard, ItemCard, ActionCard, LocationCard } from "../../model/card";
import type { GameState, PlayerPosition } from "../../model/game-state";
import type { CardIdentifier } from "../../model/identity";

const basic: CharacterCard = {
    fullName: "Basic",
    names: ["Basic"],
    type: "Character",
    cost: 1,
    inkwell: true,
    colors: ["Amber"],
    subtypes: [],
    strength: 2,
    willpower: 10,
    lore: 1,
};
const hero: CardIdentifier = { fullName: basic.fullName, i: 1 };
const other: CardIdentifier = { ...hero, i: 2 };
function setup(...definitions: Card[]) {
    const p1: PlayerPosition = { lore: 0, turnsTaken: 0, deck: [], hand: [], discard: [], inkwell: [], play: [] };
    const p2: PlayerPosition = { ...p1, deck: [], hand: [], discard: [], inkwell: [], play: [] };
    const state: GameState = { turn: { number: 1, player: 1 }, players: { 1: p1, 2: p2 } };
    const options = { card: (name: string) => [...definitions, basic].find((card) => card.fullName === name) };
    return { state, p1, p2, options, source: { card: hero, player: 1 as const, kind: "Ability" as const } };
}

describe("keywords, costs and lasting changes", () => {
    it.each([false, true])("Hades cannot draw from an optional choice with no eligible opposing character (Ward=%s)", (ward) => {
        const hades = getCard("Hades - Looking for a Deal");
        if (!hades) throw new Error("Missing Hades");
        const { state, p1, p2, options } = setup(hades);
        const card = { fullName: hades.fullName, i: 99 };
        p1.hand = [card];
        p1.deck = [3, 4, 5].map((i) => ({ ...hero, i }));
        p1.inkwell = [10, 11, 12, 13, 14].map((i) => ({ card: { ...hero, i }, exerted: false }));
        if (ward) p2.play = [{ card: other, modifiers: [{ gainKeyword: "Ward" }] }];
        const live = startAction(state, { type: "Play", player: 1, card }, options);
        const payment = live.request;
        if (payment?.type !== "Pay Cost") throw new Error("Missing play payment");
        live.submit({
            type: "Decision",
            answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: p1.inkwell.map((ink) => ink.card) }] },
        });
        expect(live.request?.type).toBe("Optional");
        live.submit({ type: "Decision", answer: { type: "Optional", accept: true } });
        expect(live.result?.players[1]?.hand).toEqual([]);
        expect(live.result?.players[1]?.deck).toEqual(p1.deck);
        expect(live.request).toBeUndefined();
    });

    it("does not request an optional decision from a nonexistent selected card's player", () => {
        const { state, options, source } = setup();
        const live = startEffect(
            state,
            {
                type: "Choose Cards",
                from: { zone: "Play", player: "Opponents" },
                count: { upTo: 1 },
                effect: { type: "Optional", player: { ownerOf: "Selected Cards" }, effect: { type: "Draw", player: "You", amount: 1 } },
            },
            source,
            options,
        );
        expect(live.result).toEqual(state);
        expect(live.request).toBeUndefined();
    });

    it("Whirlpool resolves on an empty opposing board without inventing a future restriction", () => {
        const whirlpool = getCard("Whirlpool");
        if (!whirlpool || whirlpool.type !== "Action") throw new Error("Missing Whirlpool");
        const { state, options, source } = setup(whirlpool);
        const result = startEffect(state, whirlpool.effect, { ...source, card: { fullName: whirlpool.fullName, i: 99 }, kind: "Action" }, options).result;
        expect(result).toEqual(state);
    });

    it("Whirlpool affects only existing characters and expires at each opposing player's own turn boundary", () => {
        const whirlpool = getCard("Whirlpool");
        if (!whirlpool || whirlpool.type !== "Action") throw new Error("Missing Whirlpool");
        const { state, p2, options, source } = setup(whirlpool);
        p2.play = [{ card: hero }];
        state.players[3] = { lore: 0, turnsTaken: 1, deck: [], hand: [], discard: [], inkwell: [], play: [{ card: other }] };
        const result = startEffect(state, whirlpool.effect, { ...source, card: { fullName: whirlpool.fullName, i: 99 }, kind: "Action" }, options).result;
        if (!result) throw new Error("Missing completed Whirlpool");
        expect(result.players[2]?.play[0]).toMatchObject({
            exerted: true,
            modifiers: [{ restriction: "Can't Ready At Start Of Turn", expires: { endOfNextTurn: 2, afterTurn: 1 } }],
        });
        expect(result.players[3]?.play[0]).toMatchObject({
            exerted: true,
            modifiers: [{ restriction: "Can't Ready At Start Of Turn", expires: { endOfNextTurn: 3, afterTurn: 1 } }],
        });
        expect(result.players[1]?.modifiers ?? []).toEqual([]);
        const later: GameState = structuredClone(result);
        const opponent = later.players[2];
        if (!opponent) throw new Error("Missing opponent");
        const newcomer = { ...hero, i: 3 };
        opponent.play.push({ card: newcomer });
        expect(new Rules(later, options.card).restricted(newcomer, "Can't Ready At Start Of Turn")).toBe(false);
        expect(new Rules(later, options.card).restricted(hero, "Can't Ready At Start Of Turn")).toBe(true);
        later.turn = { number: 2, player: 2 };
        opponent.deck = [4, 5].map((i) => ({ ...hero, i }));
        opponent.play[1].exerted = true;
        const turn = startTurn(later, options);
        expect(turn.request?.type).toBe("Action");
        expect(turn.position?.players[2]?.play.map((card) => card.exerted)).toEqual([true, false]);
        turn.submit({ type: "Action", action: { type: "End Turn", player: 2 } });
        expect(turn.result?.players[2]?.play[0].modifiers ?? []).toEqual([]);
        expect(turn.result?.players[3]?.play[0].modifiers).toHaveLength(1);
    });

    it("shares printed discovery without sharing limits or custom card definitions", () => {
        const provider: CharacterCard = {
            ...basic,
            abilities: [
                {
                    type: "Static",
                    limit: { perTurn: 1, count: "Uses" },
                    rule: { type: "Modify Cost", for: "Play", cards: { zone: "Hand", player: "You" }, amount: -1 },
                },
            ],
        };
        const { state, p1, options, source } = setup(provider);
        p1.play = [{ card: hero }];
        p1.hand = [other];
        const snapshot = startEffect(state, { type: "Sequence", effects: [] }, source, options).result;
        if (!snapshot) throw new Error("Missing snapshot");
        expect(new Rules(snapshot, options.card).cost(other)).toBe(0);
        expect(
            new Rules(snapshot, options.card, {
                usedAbilities: [{ card: hero, ability: 0, uses: 1 }],
            }).cost(other),
        ).toBe(1);
        const plainLookup = (name: string) => (name === basic.fullName ? basic : undefined);
        expect(new Rules(snapshot, plainLookup).cost(other)).toBe(1);
        expect(new Rules(snapshot, options.card).cost(other)).toBe(0);
    });

    it("declining a conditional body clears outputs from both possible branches", () => {
        expect(
            emptyResults({
                type: "Optional",
                effect: {
                    type: "Conditional",
                    if: { value: 1, is: { equal: 1 } },
                    then: { type: "Remove Damage", cards: "Self", amount: 1 },
                    otherwise: { type: "Banish", cards: "Self" },
                },
            }),
        ).toEqual({
            "Damage Removed": 0,
            groups: {
                "Characters With Damage Removed": [],
                "Banished Cards": [],
            },
        });
    });

    it.each([0, -1])("a strength-dependent discount does not participate in its own characteristic query (%s)", (modifier) => {
        const provider: CharacterCard = {
            ...basic,
            abilities: [
                {
                    type: "Static",
                    rule: {
                        type: "Conditional",
                        if: { exists: { filter: "Self", where: { strength: { atLeast: 2 } } } },
                        then: { type: "Modify Cost", for: "Play", cards: { zone: "Hand", player: "You" }, amount: -1 },
                    },
                },
            ],
        };
        const { state, p1, options } = setup(provider);
        p1.play = [{ card: hero, modifiers: [{ stat: "Strength", amount: modifier }] }];
        p1.hand = [other];
        const rules = new Rules(state, options.card);
        expect(rules.characteristic(hero, "Strength")).toBe(2 + modifier);
        expect(rules.cost(other)).toBe(modifier === 0 ? 0 : 1);
    });

    it("shares location indexes without sharing contextual stats or retaining a moved card's old zone", () => {
        const challenger: CharacterCard = { ...basic, abilities: [{ type: "Keyword", keyword: { name: "Challenger", amount: 3 } }] };
        const { state, p1, options, source } = setup(challenger);
        const hand = { fullName: "Hand Card", i: hero.i };
        const handDefinition: CharacterCard = { ...basic, fullName: hand.fullName };
        const lookup = (name: string) => (name === hand.fullName ? handDefinition : options.card(name));
        p1.play = [{ card: hero, under: [{ card: other, faceDown: true, owner: 2 }] }];
        p1.hand = [hand];
        const snapshot = startEffect(state, { type: "Sequence", effects: [] }, source, { card: lookup }).result;
        if (!snapshot) throw new Error("Missing snapshot");
        const normal = new Rules(snapshot, lookup),
            challenging = new Rules(snapshot, lookup, { challenge: { attacker: hero, defender: hand } });
        expect(normal.locate(hero)?.zone).toBe("Play");
        expect(normal.locate(hand)?.zone).toBe("Hand");
        expect(normal.locate(other)).toMatchObject({ player: 1, zone: "Under", under: { owner: 2, faceDown: true } });
        expect(challenging.locate(hero)).toBe(normal.locate(hero));
        expect(normal.characteristic(hero, "Strength")).toBe(2);
        expect(challenging.characteristic(hero, "Strength")).toBe(5);
        const moved = startEffect(snapshot, { type: "Move Card", cards: { cards: [hand] }, to: "Discard" }, source, { card: lookup }).result;
        if (!moved) throw new Error("Missing moved snapshot");
        expect(new Rules(moved, lookup).locate(hand)?.zone).toBe("Discard");
        expect(normal.locate(hand)?.zone).toBe("Hand");
    });

    it("Singer does not stack but singing-cost bonuses still add to it", () => {
        const singer: CharacterCard = { ...basic, cost: 2, abilities: [{ type: "Keyword", keyword: { name: "Singer", amount: 4 } }] };
        const { state, p1, options } = setup(singer);
        p1.play = [
            {
                card: hero,
                modifiers: [
                    { gainKeyword: "Singer", amount: 6 },
                    { stat: "Cost To Sing", amount: 2 },
                ],
            },
        ];
        const rules = new Rules(state, options.card);
        expect(rules.keyword(hero, "Singer")).toBe(4);
        expect(rules.characteristic(hero, "Cost To Sing")).toBe(6);
    });

    it("a one-use discount stored on a card is spent only on the committed play", () => {
        const { state, p1, options, source } = setup();
        p1.play = [
            {
                card: hero,
                modifiers: [
                    {
                        source,
                        uses: 1,
                        rule: {
                            type: "Modify Cost",
                            for: "Play",
                            cards: { zone: "Hand", player: "You" },
                            amount: -1,
                        },
                    },
                ],
            },
        ];
        p1.hand = [other, { ...hero, i: 3 }];
        p1.deck = [{ ...hero, i: 4 }];
        const live = startTurn(state, options);
        expect(live.request?.type).toBe("Action");
        expect(live.position?.players[1]?.play[0].modifiers).toHaveLength(1);
        live.submit({ type: "Action", action: { type: "Play", player: 1, card: other } });
        expect(live.position?.players[1]?.play[0].modifiers).toEqual([]);
        const request = live.request;
        if (request?.type !== "Action") throw new Error("Missing action request");
        expect(request.actions.some((action) => action.type === "Play")).toBe(false);
    });

    it("a card-stored trigger follows its affected character through Shift and is consumed once", () => {
        const upgraded: CharacterCard = { ...basic, fullName: "Upgraded Basic", abilities: [{ type: "Keyword", keyword: { name: "Shift", cost: [] } }] };
        const { state, p1, options, source } = setup(upgraded);
        const top = { fullName: upgraded.fullName, i: 3 };
        p1.hand = [top];
        p1.deck = [other];
        p1.play = [
            {
                card: hero,
                modifiers: [{ source, uses: 1, trigger: { event: "Quest", card: "Affected Card" }, effect: { type: "Gain Lore", player: "You", amount: 2 } }],
            },
        ];
        const live = startTurn(state, options);
        live.submit({ type: "Action", action: { type: "Shift", player: 1, card: top, onto: [hero], ability: 0 } });
        live.submit({ type: "Action", action: { type: "Quest", player: 1, card: top } });
        expect(live.position?.players[1]?.lore).toBe(3);
        expect(live.position?.players[1]?.play[0].modifiers).toEqual([]);
        live.submit({ type: "Action", action: { type: "End Turn", player: 1 } });
        expect(live.result?.players[1]?.lore).toBe(3);
    });

    it("an independent physical-source trigger cannot affect a later replay of its source", () => {
        const { state, p1, options, source } = setup();
        p1.play = [{ card: hero, damage: 3 }];
        p1.deck = [other];
        const next = startEffect(
            state,
            {
                type: "Sequence",
                effects: [
                    {
                        type: "Create Trigger",
                        trigger: { event: "Turn End", player: "You", when: { exists: { filter: "Self", where: { zone: "Play" } } } },
                        uses: 1,
                        duration: { until: "End Of Turn" },
                        effect: { type: "Move Card", cards: "Self", to: "Hand", wholeStack: false },
                    },
                    { type: "Move Card", cards: "Self", to: "Hand" },
                    { type: "Play", cards: "Self", free: true },
                ],
            },
            source,
            options,
        ).result;
        if (!next) throw new Error("Missing replayed source");
        const live = startTurn(next, options);
        live.submit({ type: "Action", action: { type: "End Turn", player: 1 } });
        expect(live.result?.players[1]?.play.map((state) => state.card)).toEqual([hero]);
        expect(live.result?.players[1]?.hand).toEqual([]);
        expect(live.result?.players[1]?.modifiers).toEqual([]);
    });

    it("Shift inherits conditional applied bonuses and a captured delayed banishment", () => {
        const upgraded: CharacterCard = { ...basic, fullName: "Upgraded Basic", abilities: [{ type: "Keyword", keyword: { name: "Shift", cost: [] } }] };
        const location: LocationCard = {
            fullName: "Fort",
            names: ["Fort"],
            type: "Location",
            colors: [],
            subtypes: [],
            cost: 0,
            inkwell: false,
            moveCost: 0,
            willpower: 20,
            lore: 0,
        };
        const olympus = getCard("Olympus Would Be That Way");
        if (!olympus || olympus.type !== "Action") throw new Error("Missing Olympus");
        const { state, p1, p2, options, source } = setup(upgraded, location);
        const top = { fullName: upgraded.fullName, i: 3 },
            fort = { fullName: location.fullName, i: 4 };
        p1.play = [{ card: hero }];
        p1.hand = [top];
        p1.deck = [other];
        p2.play = [{ card: fort }];
        const pending = startEffect(
            state,
            {
                type: "Sequence",
                effects: [olympus.effect, { type: "Delay", until: { turnEnd: "You" }, effect: { type: "Banish", cards: { capture: { cards: [hero] } } } }],
            },
            source,
            options,
        ).result;
        if (!pending) throw new Error("Effects did not finish");
        const turn = startTurn(pending, options);
        turn.submit({ type: "Action", action: { type: "Shift", player: 1, card: top, onto: [hero], ability: 0 } });
        if (!turn.position) throw new Error("Shift did not finish");
        expect(new Rules(turn.position, options.card, { challenge: { attacker: top, defender: fort } }).characteristic(top, "Strength")).toBe(5);
        turn.submit({ type: "Action", action: { type: "End Turn", player: 1 } });
        expect(turn.result?.players[1]?.play).toEqual([]);
        expect(turn.result?.players[1]?.discard).toEqual([top, hero]);
    });
    it("Support does not stack with further grants of the same keyword", () => {
        const supporter: CharacterCard = { ...basic, abilities: [{ type: "Keyword", keyword: { name: "Support" } }] };
        const { state, p1, options } = setup(supporter);
        p1.play = [{ card: hero, modifiers: [{ gainKeyword: "Support" }, { gainKeyword: "Support" }] }, { card: other }];
        expect(new Rules(state, options.card).keyword(hero, "Support")).toBe(1);
        const live = startAction(state, { type: "Quest", player: 1, card: hero }, options);
        live.submit({ type: "Decision", answer: { type: "Optional", accept: true } });
        live.submit({ type: "Decision", answer: { type: "Choose Cards", cards: [other] } });
        expect(live.request).toBeUndefined();
        if (!live.result) throw new Error("Quest did not finish");
        expect(new Rules(live.result, options.card).characteristic(other, "Strength")).toBe(4);
    });
    it("Vanish does not banish a new play after the chosen character changes zone", () => {
        const illusion: CharacterCard = { ...basic, abilities: [{ type: "Keyword", keyword: { name: "Vanish" } }] };
        const { state, p1, p2, options } = setup(illusion);
        p1.play = [{ card: hero }];
        p2.play = [{ card: other }];
        const live = startEffect(
            state,
            {
                type: "Choose Cards",
                from: { zone: "Play", player: "Opponents" },
                count: 1,
                effect: {
                    type: "Sequence",
                    effects: [
                        { type: "Move Card", cards: "Selected Cards", to: "Hand" },
                        { type: "Play", player: "Opponents", cards: "Selected Cards", free: true },
                    ],
                },
            },
            { card: other, player: 2, kind: "Action" },
            options,
        );
        live.submit({ type: "Decision", answer: { type: "Choose Cards", cards: [hero] } });
        expect(live.result?.players[1]?.play.map((state) => state.card)).toEqual([hero]);
        expect(live.result?.players[1]?.discard).toEqual([]);
    });

    it("a granted Vanish keyword is an active trigger, not just a label", () => {
        const { state, p1, p2, options } = setup();
        p1.play = [{ card: hero, modifiers: [{ gainKeyword: "Vanish" }] }];
        p2.play = [{ card: other }];
        const live = startEffect(
            state,
            { type: "Choose Cards", from: { zone: "Play", player: "Opponents" }, count: 1, effect: { type: "Sequence", effects: [] } },
            { card: other, player: 2, kind: "Action" },
            options,
        );
        live.submit({ type: "Decision", answer: { type: "Choose Cards", cards: [hero] } });
        expect(live.result?.players[1]?.play).toEqual([]);
        expect(live.result?.players[1]?.discard).toEqual([hero]);
    });
    it("combines Challenger with negative strength before clamping combat damage", () => {
        const challenger: CharacterCard = { ...basic, abilities: [{ type: "Keyword", keyword: { name: "Challenger", amount: 3 } }] };
        const { state, p1, p2, options } = setup(challenger);
        p1.play = [{ card: hero, modifiers: [{ stat: "Strength", amount: -4 }] }];
        p2.play = [{ card: other, exerted: true }];
        expect(new Rules(state, options.card).characteristic(hero, "Strength")).toBe(0);
        const live = startAction(state, { type: "Challenge", player: 1, attacker: hero, defender: other }, options);
        expect(live.result?.players[2]?.play[0]?.damage).toBe(1);
    });
    it("challenge triggers and last-known values include Challenger strength", () => {
        const challenger: CharacterCard = {
            ...basic,
            willpower: 1,
            abilities: [
                { type: "Keyword", keyword: { name: "Challenger", amount: 3 } },
                {
                    type: "Triggered",
                    trigger: { event: "Challenge", attacker: "Self", when: { every: "Self", where: { strength: { atLeast: 5 } } } },
                    effect: { type: "Gain Lore", player: "You", amount: 1 },
                },
                {
                    type: "Triggered",
                    trigger: { event: "Banish", card: "Self" },
                    effect: { type: "Gain Lore", player: "You", amount: { stat: "Strength", card: "Self" } },
                },
            ],
        };
        const defender: CharacterCard = { ...basic, fullName: "Defender", strength: 1 };
        const { state, p1, p2, options } = setup(challenger, defender);
        const target = { fullName: defender.fullName, i: 2 };
        p1.play = [{ card: hero }];
        p2.play = [{ card: target, exerted: true }];
        const live = startAction(state, { type: "Challenge", player: 1, attacker: hero, defender: target }, options);
        expect(live.result?.players[1]?.lore).toBe(6);
        expect(live.result?.players[1]?.discard).toEqual([hero]);
    });
    it("Faline compares against an empty opposing board without requiring positive strength", () => {
        const faline = getCard("Faline - Playful Fawn");
        if (!faline || faline.type !== "Character") throw new Error("Missing Faline");
        const { state, p1, p2, options } = setup(faline);
        const card = { fullName: faline.fullName, i: 3 };
        p1.play = [{ card, modifiers: [{ stat: "Strength", amount: -2 }] }];
        expect(new Rules(state, options.card).characteristic(card, "Lore")).toBe(3);
        p2.play = [{ card: other, modifiers: [{ stat: "Strength", amount: -2 }] }];
        expect(new Rules(state, options.card).characteristic(card, "Lore")).toBe(1);
        p1.play.push({ card: hero });
        expect(new Rules(state, options.card).characteristic(card, "Lore")).toBe(3);
    });
    it("Olympus adds strength only against locations, only to existing characters, until the turn ends", () => {
        const printed = getCard("Olympus Would Be That Way");
        if (!printed || printed.type !== "Action") throw new Error("Missing Olympus action");
        // Payment is covered separately. Exercise the real embedded effect without a payment decision.
        const action: ActionCard = { ...printed, cost: 0 };
        const location: LocationCard = {
            fullName: "Fort",
            names: ["Fort"],
            type: "Location",
            colors: [],
            subtypes: [],
            cost: 0,
            inkwell: false,
            moveCost: 0,
            willpower: 20,
            lore: 0,
        };
        const { state, p1, p2, options, source } = setup(action, location);
        const fort = { fullName: location.fullName, i: 3 },
            spell = { fullName: action.fullName, i: 4 };
        p1.play = [{ card: hero }];
        p1.hand = [spell, other];
        p1.deck = [{ ...hero, i: 5 }];
        p2.play = [{ card: fort }];
        const played = startAction(state, { type: "Play", player: 1, card: spell }, options).result;
        if (!played) throw new Error("Action did not finish");
        expect(new Rules(played, options.card).characteristic(hero, "Strength")).toBe(2);
        expect(new Rules(played, options.card, { challenge: { attacker: hero, defender: fort } }).characteristic(hero, "Strength")).toBe(5);
        expect(new Rules(played, options.card, { challenge: { attacker: hero, defender: other } }).characteristic(hero, "Strength")).toBe(2);
        const added = startEffect(played, { type: "Play", cards: { cards: [other] }, free: true }, source, options).result;
        if (!added) throw new Error("New character did not finish playing");
        expect(new Rules(added, options.card, { challenge: { attacker: other, defender: fort } }).characteristic(other, "Strength")).toBe(2);
        const challenged = startAction(added, { type: "Challenge", player: 1, attacker: hero, defender: fort }, options).result;
        if (!challenged) throw new Error("Challenge did not finish");
        expect(challenged.players[2]?.play[0]?.damage).toBe(5);
        const turn = startTurn(challenged, options);
        turn.submit({ type: "Action", action: { type: "End Turn", player: 1 } });
        if (!turn.result) throw new Error("Turn did not finish");
        expect(new Rules(turn.result, options.card, { challenge: { attacker: hero, defender: fort } }).characteristic(hero, "Strength")).toBe(2);
    });
    it("action cleanup does not move a card that already left the resolving zone", () => {
        const returning: ActionCard = {
            ...basic,
            type: "Action",
            fullName: "Returning Action",
            cost: 0,
            effect: { type: "Move Card", cards: "Self", to: "Hand" },
        };
        const { state, p1, options } = setup(returning);
        const card = { fullName: returning.fullName, i: 3 };
        p1.hand = [card];
        const live = startAction(state, { type: "Play", player: 1, card }, options);
        expect(live.result?.players[1]?.hand).toEqual([card]);
        expect(live.result?.players[1]?.discard).toEqual([]);
    });
    it("a delayed banishment does not affect a new play of the same physical card", () => {
        const { state, p1, options, source } = setup();
        p1.play = [{ card: hero }];
        p1.deck = [other];
        const next = startEffect(
            state,
            {
                type: "Sequence",
                effects: [
                    { type: "Delay", until: { turnEnd: "You" }, effect: { type: "Banish", cards: "Self" } },
                    { type: "Move Card", cards: "Self", to: "Hand" },
                    { type: "Play", cards: "Self", free: true },
                ],
            },
            source,
            options,
        ).result;
        if (!next) throw new Error("Missing replayed character");
        const live = startTurn(next, options);
        live.submit({ type: "Action", action: { type: "End Turn", player: 1 } });
        expect(live.result?.players[1]?.play.map((card) => card.card)).toEqual([hero]);
        expect(live.result?.players[1]?.discard).toEqual([]);
    });
    it("a player may fail to find a matching card when searching a private deck", () => {
        const { state, p1, options, source } = setup();
        p1.deck = [hero, other];
        const live = startEffect(
            state,
            {
                type: "Search",
                from: { zone: "Deck", player: "You", cardType: "Character" },
                count: 1,
                effect: { type: "Move Card", cards: "Selected Cards", to: "Hand" },
            },
            source,
            options,
        );
        expect(live.request).toMatchObject({ type: "Choose Cards", min: 0, max: 1 });
        live.submit({ type: "Decision", answer: { type: "Choose Cards", cards: [] } });
        expect(live.result?.players[1]?.deck).toEqual([hero, other]);
        expect(live.result?.players[1]?.hand).toEqual([]);
    });
    it("nested additional costs bind the affected character rather than the rule provider", () => {
        const tax: ItemCard = {
            ...basic,
            type: "Item",
            fullName: "Quest Tax",
            abilities: [
                {
                    type: "Static",
                    rule: {
                        type: "Additional Cost",
                        for: ["Quest"],
                        cards: { zone: "Play", player: "You", cardType: "Character" },
                        cost: [
                            {
                                type: "Choose Cards",
                                from: { zone: "Play", player: "You", cardType: "Character", exclude: "Affected Card" },
                                count: 1,
                                cost: [{ type: "Banish", cards: "Selected Cards" }],
                            },
                        ],
                    },
                },
            ],
        };
        const { state, p1, options } = setup(tax);
        p1.play = [{ card: hero }, { card: other }, { card: { fullName: tax.fullName, i: 3 } }];
        const live = startAction(state, { type: "Quest", player: 1, card: hero }, options);
        expect(live.request).toMatchObject({ type: "Pay Cost", cost: [{ type: "Choose Cards", from: { cards: [other] } }] });
        live.submit({ type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Banish", player: 1, cards: [other] }] } });
        expect(live.result?.players[1]?.discard).toEqual([other]);
        expect(live.result?.players[1]?.lore).toBe(1);
    });

    it("an impossible group selection does not leave a resolution waiting for an impossible answer", () => {
        const { state, p1, options, source } = setup();
        p1.play = [{ card: hero }, { card: other }];
        const live = startEffect(
            state,
            {
                type: "Sequence",
                effects: [
                    {
                        type: "Choose Cards",
                        from: { zone: "Play", player: "You" },
                        count: 2,
                        where: { differentNames: "Selected Cards" },
                        effect: { type: "Banish", cards: "Selected Cards" },
                    },
                    { type: "Gain Lore", player: "You", amount: 1 },
                ],
            },
            source,
            options,
        );
        expect(live.request).toBeUndefined();
        expect(live.result?.players[1]?.play).toHaveLength(2);
        expect(live.result?.players[1]?.lore).toBe(1);
    });
    it("play discounts apply to alternate ink prices without removing the other costs", () => {
        const alternative: CharacterCard = {
            ...basic,
            cost: 10,
            playRules: [
                {
                    type: "Alternate Cost",
                    cost: [
                        { type: "Ink", amount: 3 },
                        { type: "Lose Lore", amount: 1 },
                    ],
                },
            ],
        };
        const discount: ItemCard = {
            ...basic,
            type: "Item",
            fullName: "Play Discount",
            abilities: [
                {
                    type: "Static",
                    rule: {
                        type: "Modify Cost",
                        for: "Play",
                        cards: { zone: "Hand", player: "You" },
                        amount: -1,
                    },
                },
            ],
        };
        const { state, p1, options } = setup(alternative, discount);
        p1.lore = 2;
        p1.hand = [hero];
        p1.play = [{ card: { fullName: discount.fullName, i: 5 } }];
        const ink = [3, 4].map((i) => ({ ...hero, i }));
        p1.inkwell = ink.map((card) => ({ card, exerted: false }));
        const action = { type: "Play" as const, player: 1 as const, card: hero, alternateCost: { playRule: 0 } };
        expect(getLegalActions(state, options)).toContainEqual(action);
        const live = startAction(state, action, options);
        expect(live.request).toMatchObject({
            type: "Pay Cost",
            cost: [
                { type: "Lose Lore", amount: 1 },
                { type: "Ink", amount: 2 },
            ],
        });
        live.submit({
            type: "Decision",
            answer: {
                type: "Pay Cost",
                pay: true,
                payment: [
                    { type: "Lose Lore", player: 1, amount: 1 },
                    { type: "Ink", player: 1, cards: ink },
                ],
            },
        });
        expect(live.result?.players[1]?.lore).toBe(1);
        expect(live.result?.players[1]?.play.some((card) => card.card.i === hero.i)).toBe(true);
    });
    it("delays general instructions while retaining only explicitly captured amounts", () => {
        const { state, p1, options, source } = setup();
        p1.hand = [hero];
        p1.deck = [other, { ...hero, i: 3 }, { ...hero, i: 4 }];
        const installed = startEffect(
            state,
            {
                type: "Delay",
                until: { turnEnd: "You" },
                effect: { type: "Draw", player: "You", amount: { capture: { count: { zone: "Hand", player: "You" } } } },
            },
            source,
            options,
        ).result;
        if (!installed) throw new Error("Missing delayed draw");
        const next: GameState = { ...installed, players: { ...installed.players, 1: { ...p1, ...installed.players[1], hand: [] } } };
        const live = startTurn(next, options);
        live.submit({ type: "Action", action: { type: "End Turn", player: 1 } });
        expect(live.result?.players[1]?.hand).toEqual([other]);
        expect(live.result?.players[1]?.deck).toHaveLength(2);
        expect(live.result?.players[1]?.modifiers).toEqual([]);
    });
    it("a departed source keeps its last effective strength for its leave-play trigger", () => {
        const leaving: CharacterCard = {
            ...basic,
            abilities: [
                {
                    type: "Triggered",
                    trigger: { event: "Leave Play", card: "Self" },
                    effect: { type: "Gain Lore", player: "You", amount: { stat: "Strength", card: "Self" } },
                },
            ],
        };
        const { state, p1, options, source } = setup(leaving);
        p1.play = [{ card: hero, modifiers: [{ stat: "Strength", amount: 3 }] }];
        const live = startEffect(state, { type: "Banish", cards: "Self" }, source, options);
        expect(live.result?.players[1]?.lore).toBe(5);
        expect(live.result?.players[1]?.discard).toEqual([hero]);
    });

    it("forces an eligible opposing protector, but not a protector that cannot be chosen", () => {
        const protector: CharacterCard = {
            ...basic,
            fullName: "Protector",
            abilities: [
                {
                    type: "Static",
                    rule: {
                        type: "Modify Cards",
                        cards: "Self",
                        modifier: { restriction: "Must Be Chosen", byPlayer: "Opponents" },
                    },
                },
            ],
        };
        for (const ward of [false, true]) {
            const { state, p2, options, source } = setup(protector);
            const protectedCard = { fullName: protector.fullName, i: 3 };
            p2.play = [{ card: other }, { card: protectedCard, modifiers: ward ? [{ gainKeyword: "Ward" }] : [] }];
            const live = startEffect(
                state,
                {
                    type: "Choose Cards",
                    from: { zone: "Play", player: "Opponents" },
                    count: 1,
                    effect: { type: "Put Damage", cards: "Selected Cards", amount: 1 },
                },
                source,
                options,
            );
            expect(live.request).toMatchObject({ type: "Choose Cards", cards: ward ? [other] : [protectedCard] });
            live.submit({ type: "Decision", answer: { type: "Choose Cards", cards: ward ? [other] : [protectedCard] } });
            expect(live.result?.players[2]?.play.find((card) => card.card.i === (ward ? other.i : protectedCard.i))?.damage).toBe(1);
        }
    });
    it("damage banishment keeps the activated character as its source", () => {
        const killer: CharacterCard = {
            ...basic,
            abilities: [
                { type: "Activated", cost: [], effect: { type: "Deal Damage", cards: { zone: "Play", player: "Opponents" }, amount: 10 } },
                { type: "Triggered", trigger: { event: "Banish", source: "Self", kind: "Ability" }, effect: { type: "Gain Lore", player: "You", amount: 2 } },
            ],
        };
        const { state, p1, p2, options } = setup(killer);
        p1.play = [{ card: hero }];
        p2.play = [{ card: other }];
        const live = startAction(state, { type: "Activate", player: 1, ability: { card: hero, i: 0 } }, options);
        expect(live.result?.players[2]?.discard).toEqual([other]);
        expect(live.result?.players[1]?.lore).toBe(2);
    });
    it("Support enters the trigger bag and emits the chosen-for-support event", () => {
        const supporter: CharacterCard = {
            ...basic,
            abilities: [
                { type: "Keyword", keyword: { name: "Support" } },
                { type: "Triggered", trigger: { event: "Quest", card: "Self" }, effect: { type: "Gain Lore", player: "You", amount: 1 } },
            ],
        };
        const observer: ItemCard = {
            ...basic,
            type: "Item",
            fullName: "Support Observer",
            abilities: [
                { type: "Triggered", trigger: { event: "Chosen For Support", player: "You" }, effect: { type: "Gain Lore", player: "You", amount: 1 } },
            ],
        };
        const { state, p1, options } = setup(supporter, observer);
        p1.play = [{ card: hero }, { card: other }, { card: { fullName: observer.fullName, i: 3 } }];
        const live = startAction(state, { type: "Quest", player: 1, card: hero }, options);
        const request = live.request;
        if (request?.type !== "Choose Trigger") throw new Error("Support must be ordered with other quest triggers");
        const support = request.options.find((option) => option.effect.type === "Optional");
        if (!support) throw new Error("Missing Support trigger");
        live.submit({ type: "Decision", answer: { type: "Choose Trigger", trigger: support.reference } });
        live.submit({ type: "Decision", answer: { type: "Optional", accept: true } });
        live.submit({ type: "Decision", answer: { type: "Choose Cards", cards: [other] } });
        if (live.request?.type === "Choose Trigger")
            live.submit({ type: "Decision", answer: { type: "Choose Trigger", trigger: live.request.options[0].reference } });
        expect(live.result?.players[1]?.lore).toBe(3);
        if (!live.result) throw new Error("Missing resolution");
        expect(new Rules(live.result, options.card).characteristic(other, "Strength")).toBe(4);
    });

    it("questing does not bypass a player prohibition on gaining lore", () => {
        const { state, p1, options } = setup();
        p1.play = [{ card: hero }];
        p1.modifiers = [{ restriction: "Can't Gain Lore" }];
        const live = startAction(state, { type: "Quest", player: 1, card: hero }, options);
        expect(live.result?.players[1]?.lore).toBe(0);
        expect(live.result?.players[1]?.play[0].exerted).toBe(true);
    });

    it("draw-trigger conditions see each individual draw, not the final hand size", () => {
        const observer: ItemCard = {
            ...basic,
            type: "Item",
            fullName: "Draw Observer",
            abilities: [
                {
                    type: "Triggered",
                    trigger: { event: "Draw", player: "You", when: { value: { count: { zone: "Hand", player: "You" } }, is: { equal: 1 } } },
                    effect: { type: "Gain Lore", player: "You", amount: 1 },
                },
            ],
        };
        const { state, p1, options, source } = setup(observer);
        p1.play = [{ card: { fullName: observer.fullName, i: 3 } }];
        p1.deck = [hero, other];
        const live = startEffect(state, { type: "Draw", player: "You", amount: 2 }, source, options);
        expect(live.result?.players[1]?.hand).toEqual([hero, other]);
        expect(live.result?.players[1]?.lore).toBe(1);
    });
    it("emits a discard-zone movement for every physical card in a banished Shift stack", () => {
        const watcher: ItemCard = {
            ...basic,
            fullName: "Discard Observer",
            type: "Item",
            abilities: [
                {
                    type: "Triggered",
                    trigger: {
                        event: "Move Card",
                        to: "Discard",
                        player: "You",
                    },
                    effect: { type: "Gain Lore", player: "You", amount: 1 },
                },
            ],
        };
        const { state, p1, options, source } = setup(watcher);
        p1.play = [{ card: hero, under: [{ card: other, faceDown: false }] }, { card: { fullName: watcher.fullName, i: 3 } }];
        p1.modifiers = [{ additionalInk: 1, expires: { leavesPlay: other } }];
        const live = startEffect(state, { type: "Banish", cards: "Self" }, source, options);
        const request = live.request;
        if (request?.type !== "Choose Trigger") throw new Error("Both movements must trigger");
        live.submit({ type: "Decision", answer: { type: "Choose Trigger", trigger: request.options[0].reference } });
        expect(live.result?.players[1]?.lore).toBe(2);
        expect(live.result?.players[1]?.discard).toEqual([hero, other]);
        expect(live.result?.players[1]?.modifiers).toEqual([]);
    });
    it("retains damage-dealt events reduced to zero without treating them as damage taken", () => {
        const attacker: CharacterCard = {
            ...basic,
            fullName: "Damage Source",
            abilities: [
                {
                    type: "Triggered",
                    trigger: {
                        event: "Deal Damage",
                        source: "Self",
                        kind: "Challenge",
                    },
                    effect: { type: "Gain Lore", player: "You", amount: 1 },
                },
            ],
        };
        const victim: CharacterCard = {
            ...basic,
            fullName: "Resistant Victim",
            strength: 0,
            abilities: [
                { type: "Keyword", keyword: { name: "Resist", amount: 2 } },
                {
                    type: "Triggered",
                    trigger: { event: "Deal Damage", card: "Self", when: { value: { event: "Amount" }, is: { greaterThan: 0 } } },
                    effect: { type: "Gain Lore", player: "You", amount: 1 },
                },
            ],
        };
        const { state, p1, p2, options } = setup(attacker, victim);
        const source = { fullName: attacker.fullName, i: 3 },
            target = { fullName: victim.fullName, i: 4 };
        p1.play = [{ card: source }];
        p2.play = [{ card: target, exerted: true }];
        const live = startAction(state, { type: "Challenge", player: 1, attacker: source, defender: target }, options);
        expect(live.result?.players[1]?.lore).toBe(1);
        expect(live.result?.players[2]?.lore).toBe(0);
        expect(live.result?.players[2]?.play[0].damage ?? 0).toBe(0);
    });
    it("applies both play and Shift discounts to the Shift ink price", () => {
        const shifted: CharacterCard = {
            ...basic,
            fullName: "Discounted Shift",
            abilities: [{ type: "Keyword", keyword: { name: "Shift", cost: [{ type: "Ink", amount: 4 }] } }],
        };
        const { state, p1, options, source } = setup(shifted);
        const top = { fullName: shifted.fullName, i: 3 },
            ink = { ...hero, i: 4 };
        p1.hand = [top];
        p1.play = [{ card: hero }];
        p1.inkwell = [{ card: ink, exerted: false }];
        p1.modifiers = [
            { source, rule: { type: "Modify Cost", cards: { zone: "Hand", player: "You" }, for: "Play", amount: -1 } },
            { source, rule: { type: "Modify Cost", cards: { zone: "Hand", player: "You" }, for: "Shift", onto: "Self", amount: -2 } },
        ];
        const action = getLegalActions(state, options).find((action) => action.type === "Shift");
        if (!action) throw new Error("Discounted Shift must be legal");
        const live = startAction(state, action, options);
        live.submit({ type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [ink] }] } });
        expect(live.result?.players[1]?.play[0].card).toEqual(top);
        expect(live.result?.players[1]?.inkwell[0].exerted).toBe(true);
    });

    it("plays from under a card using a lasting permission without losing or duplicating cards", () => {
        const { state, p1, options, source } = setup();
        p1.play = [{ card: hero, under: [{ card: other, faceDown: true }] }];
        p1.inkDrops = 1;
        const permission = startEffect(
            state,
            {
                type: "Modify Players",
                players: "You",
                modifier: {
                    permission: "Can Play From Under",
                    cards: { cards: [other] },
                    exerted: true,
                },
                duration: { until: "End Of Turn" },
            },
            source,
            options,
        ).result;
        if (!permission) throw new Error("Missing permission position");
        const action = getLegalActions(permission, options).find((action) => action.type === "Play");
        if (!action) throw new Error("Missing permitted play");
        const live = startAction(permission, action, options);
        live.submit({ type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [], inkDrops: 1 }] } });
        expect(live.result?.players[1]?.play.map((state) => state.card)).toEqual([hero, other]);
        expect(live.result?.players[1]?.play[0].under).toEqual([]);
        expect(live.result?.players[1]?.play[1]).toMatchObject({ card: other, exerted: true, drying: true });
    });

    it("inks a permitted discard card exerted and still enforces the turn ink limit", () => {
        const { state, p1, options } = setup();
        p1.discard = [hero, other];
        p1.deck = [{ ...hero, i: 3 }];
        p1.modifiers = [{ permission: "Can Ink From Discard", cards: { cards: [hero] }, exerted: true }];
        const live = startTurn(state, options);
        live.submit({ type: "Action", action: { type: "Ink", player: 1, card: hero } });
        expect(live.position?.players[1]?.inkwell).toEqual([{ card: hero, exerted: true }]);
        expect(live.position?.players[1]?.discard).toEqual([other]);
        expect(live.request?.type === "Action" && live.request.actions.some((action) => action.type === "Ink")).toBe(false);
    });
    it("calculates every target's damage before committing any counters", () => {
        const { state, p1, options, source } = setup();
        p1.play = [{ card: hero, damage: 1 }, { card: other }];
        const result = startEffect(
            state,
            {
                type: "Deal Damage",
                cards: { zone: "Play", player: "You", cardType: "Character" },
                amount: { count: { zone: "Play", player: "You", where: { damage: { atLeast: 1 } } } },
            },
            source,
            options,
        ).result;
        expect(result?.players[1]?.play.map((card) => card.damage)).toEqual([2, 1]);
    });

    it("Potato Shift inherits whether its item base was played this turn", () => {
        const potato: ItemCard = { ...basic, type: "Item", fullName: "Potato", names: ["Potato"], cost: 0 };
        const shifted: CharacterCard = {
            ...basic,
            fullName: "Shifted",
            cost: 0,
            abilities: [
                {
                    type: "Keyword",
                    keyword: {
                        name: "Shift",
                        cost: [],
                        onto: { zone: "Play", player: "You", cardType: "Item", where: { name: "Potato" } },
                    },
                },
            ],
        };
        const { state, p1, options } = setup(potato, shifted);
        const base = { fullName: potato.fullName, i: 3 },
            top = { fullName: shifted.fullName, i: 4 };
        p1.hand = [base, top];
        const fresh = startTurn(state, options);
        fresh.submit({ type: "Action", action: { type: "Play", player: 1, card: base } });
        fresh.submit({ type: "Action", action: { type: "Shift", player: 1, card: top, onto: [base], ability: 0 } });
        expect(fresh.position?.players[1]?.play[0].drying).toBe(true);
        p1.hand = [top];
        p1.play = [{ card: base, drying: true }];
        const established = startTurn(state, options);
        established.submit({ type: "Action", action: { type: "Shift", player: 1, card: top, onto: [base], ability: 0 } });
        expect(established.position?.players[1]?.play[0].drying).toBe(false);
    });

    it("finishes the resolving player's bag before returning to newly queued active-player triggers", () => {
        const active: ItemCard = {
            ...basic,
            fullName: "Active Triggers",
            type: "Item",
            abilities: [
                {
                    type: "Triggered",
                    trigger: { event: "Turn End", player: "You" },
                    effect: { type: "Optional", effect: { type: "Gain Lore", player: "You", amount: 1 } },
                },
                {
                    type: "Triggered",
                    trigger: { event: "Gain Lore", player: "You" },
                    effect: { type: "Optional", effect: { type: "Gain Lore", player: "You", amount: 1 } },
                },
            ],
        };
        const opposing: ItemCard = {
            ...basic,
            fullName: "Opposing Triggers",
            type: "Item",
            abilities: [
                {
                    type: "Triggered",
                    trigger: { event: "Turn End", player: "Opponents" },
                    effect: { type: "Optional", effect: { type: "Gain Lore", player: "Opponents", amount: 1 } },
                },
                {
                    type: "Triggered",
                    trigger: { event: "Turn End", player: "Opponents" },
                    effect: { type: "Optional", effect: { type: "Gain Lore", player: "You", amount: 1 } },
                },
            ],
        };
        const { state, p1, p2, options } = setup(active, opposing);
        p1.play = [{ card: { fullName: active.fullName, i: 3 } }];
        p2.play = [{ card: { fullName: opposing.fullName, i: 4 } }];
        const live = startTurn(state, options);
        live.submit({ type: "Action", action: { type: "End Turn", player: 1 } });
        live.submit({ type: "Decision", answer: { type: "Optional", accept: false } });
        const choice = live.request;
        if (choice?.type !== "Choose Trigger") throw new Error("Missing opposing trigger order");
        live.submit({ type: "Decision", answer: { type: "Choose Trigger", trigger: choice.options[0].reference } });
        live.submit({ type: "Decision", answer: { type: "Optional", accept: true } });
        expect(live.request).toMatchObject({ type: "Optional", player: 2 });
        live.submit({ type: "Decision", answer: { type: "Optional", accept: false } });
        expect(live.request).toMatchObject({ type: "Optional", player: 1 });
        live.submit({ type: "Decision", answer: { type: "Optional", accept: false } });
        expect(live.result?.players[1]?.lore).toBe(1);
    });

    it("a free activation waives ink but still requires exerting its source", () => {
        const actor: CharacterCard = {
            ...basic,
            abilities: [
                {
                    type: "Activated",
                    cost: [
                        { type: "Exert", cards: "Self" },
                        { type: "Ink", amount: 3 },
                    ],
                    effect: { type: "Gain Lore", player: "You", amount: 1 },
                },
                { type: "Static", rule: { type: "Free Ability", cards: "Self" } },
            ],
        };
        const { state, p1, options } = setup(actor);
        p1.play = [{ card: hero }];
        const action = { type: "Activate" as const, player: 1 as const, ability: { card: hero, i: 0 }, free: true };
        expect(getLegalActions(state, options)).toContainEqual(action);
        const live = startAction(state, action, options);
        expect(live.request).toMatchObject({ type: "Pay Cost", cost: [{ type: "Exert", cards: { cards: [hero] } }] });
        live.submit({ type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Exert", player: 1, cards: [hero] }] } });
        expect(live.result?.players[1]?.play[0].exerted).toBe(true);
        expect(live.result?.players[1]?.lore).toBe(1);
    });

    it("limits a printed discount on committed plays, never on repeated price queries", () => {
        const character: CharacterCard = { ...basic, cost: 2 };
        const provider: ItemCard = {
            ...basic,
            fullName: "Limited Discount",
            type: "Item",
            abilities: [
                {
                    type: "Static",
                    limit: { perTurn: 1, count: "Uses" },
                    rule: { type: "Modify Cost", cards: { zone: "Hand", player: "You" }, for: "Play", amount: -1 },
                },
            ],
        };
        const { state, p1, options } = setup(character, provider);
        const ink = [3, 4, 5].map((i) => ({ ...hero, i }));
        p1.inkwell = ink.map((card) => ({ card, exerted: false }));
        p1.hand = [hero, other];
        p1.play = [{ card: { fullName: provider.fullName, i: 6 } }];
        expect(getLegalActions(state, options)).toEqual(getLegalActions(state, options));
        const live = startTurn(state, options);
        live.submit({ type: "Action", action: { type: "Play", player: 1, card: hero } });
        expect(live.request).toMatchObject({ type: "Pay Cost", cost: [{ type: "Ink", amount: 1 }] });
        live.submit({ type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [ink[0]] }] } });
        live.submit({ type: "Action", action: { type: "Play", player: 1, card: other } });
        expect(live.request).toMatchObject({ type: "Pay Cost", cost: [{ type: "Ink", amount: 2 }] });
    });

    it("applies an optional discount without asking when the play is unaffordable without it", () => {
        const character: CharacterCard = { ...basic, cost: 2 };
        const provider: ItemCard = {
            ...basic,
            fullName: "Optional Discount",
            type: "Item",
            abilities: [
                {
                    type: "Static",
                    rule: {
                        type: "Modify Cost",
                        cards: { zone: "Hand", player: "You" },
                        for: "Play",
                        amount: -1,
                        optional: true,
                    },
                },
            ],
        };
        const { state, p1, options } = setup(character, provider);
        const ink = { ...hero, i: 3 };
        p1.hand = [hero];
        p1.inkwell = [{ card: ink, exerted: false }];
        p1.play = [{ card: { fullName: provider.fullName, i: 4 } }];
        const live = startAction(state, { type: "Play", player: 1, card: hero }, options);
        expect(live.request).toMatchObject({ type: "Pay Cost", cost: [{ type: "Ink", amount: 1 }] });
        live.submit({ type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [ink] }] } });
        expect(live.result?.players[1]?.play).toHaveLength(2);
    });

    it("Duo Shift needs both names and combines damage, drying, exertion and modifiers", () => {
        const left: CharacterCard = { ...basic, fullName: "Left", names: ["Left"] };
        const right: CharacterCard = { ...basic, fullName: "Right", names: ["Right"] };
        const duo: CharacterCard = {
            ...basic,
            fullName: "Duo",
            names: ["Left", "Right"],
            abilities: [{ type: "Keyword", keyword: { name: "Shift", count: 2, names: ["Left", "Right"], cost: [] } }],
        };
        const { state, p1, options } = setup(left, right, duo);
        const first = { fullName: left.fullName, i: 1 },
            second = { fullName: right.fullName, i: 2 },
            top = { fullName: duo.fullName, i: 3 };
        p1.hand = [top];
        p1.play = [
            { card: first, damage: 1, drying: true, modifiers: [{ stat: "Strength", amount: 1 }] },
            { card: second, damage: 2, exerted: true, modifiers: [{ stat: "Strength", amount: 2 }] },
        ];
        expect(getLegalActions(state, options)).toContainEqual({ type: "Shift", player: 1, card: top, onto: [first, second], ability: 0 });
        const result = startAction(state, { type: "Shift", player: 1, card: top, onto: [first, second], ability: 0 }, options).result;
        expect(result?.players[1]?.play).toHaveLength(1);
        expect(result?.players[1]?.play[0]).toMatchObject({
            card: top,
            damage: 3,
            drying: true,
            exerted: true,
            under: [
                { card: first, faceDown: false },
                { card: second, faceDown: false },
            ],
        });
        if (!result) throw new Error("Shift did not resolve");
        expect(new Rules(result, options.card).characteristic(top, "Strength")).toBe(5);
        p1.play[1].card = { fullName: left.fullName, i: 4 };
        expect(getLegalActions(state, options).some((action) => action.type === "Shift")).toBe(false);
    });

    it("validates nested chosen costs atomically and publishes the paid cards", () => {
        const item: ItemCard = {
            ...basic,
            fullName: "Sacrifice",
            type: "Item",
            abilities: [
                {
                    type: "Activated",
                    cost: [
                        { type: "Exert", cards: "Self" },
                        {
                            type: "Choose Cards",
                            from: { zone: "Play", player: "You", cardType: "Character" },
                            count: 1,
                            cost: [{ type: "Banish", cards: "Selected Cards" }],
                        },
                    ],
                    effect: { type: "Gain Lore", player: "You", amount: { count: { result: "Paid Cards" } } },
                },
            ],
        };
        const { state, p1, options } = setup(item);
        const source = { fullName: item.fullName, i: 3 };
        p1.play = [{ card: source }, { card: hero }, { card: other }];
        const live = startAction(state, { type: "Activate", player: 1, ability: { card: source, i: 0 } }, options);
        expect(() =>
            live.submit({
                type: "Decision",
                answer: {
                    type: "Pay Cost",
                    pay: true,
                    payment: [
                        { type: "Exert", player: 1, cards: [source] },
                        { type: "Banish", player: 1, cards: [source] },
                    ],
                },
            }),
        ).toThrow();
        expect(live.position?.players[1]?.play[0].exerted).toBeUndefined();
        live.submit({
            type: "Decision",
            answer: {
                type: "Pay Cost",
                pay: true,
                payment: [
                    { type: "Exert", player: 1, cards: [source] },
                    { type: "Banish", player: 1, cards: [other] },
                ],
            },
        });
        expect(live.result?.players[1]?.discard).toEqual([other]);
        expect(live.result?.players[1]?.lore).toBe(1);
    });

    it("offers and pays a printed alternate play cost", () => {
        const alternative: CharacterCard = { ...basic, cost: 10, playRules: [{ type: "Alternate Cost", cost: [{ type: "Lose Lore", amount: 2 }] }] };
        const { state, p1, options } = setup(alternative);
        p1.lore = 3;
        p1.hand = [hero];
        const action = { type: "Play" as const, player: 1 as const, card: hero, alternateCost: { playRule: 0 } };
        expect(getLegalActions(state, options)).toContainEqual(action);
        const live = startAction(state, action, options);
        live.submit({ type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Lose Lore", player: 1, amount: 2 }] } });
        expect(live.result?.players[1]?.lore).toBe(1);
        expect(live.result?.players[1]?.play[0].card).toEqual(hero);
    });

    it("activates an ability in discard only when that zone is declared", () => {
        const returning: CharacterCard = {
            ...basic,
            abilities: [{ type: "Activated", from: ["Discard"], cost: [], effect: { type: "Move Card", cards: "Self", to: "Hand" } }],
        };
        const { state, p1, options } = setup(returning);
        p1.discard = [hero];
        const action = { type: "Activate" as const, player: 1 as const, ability: { card: hero, i: 0 } };
        expect(getLegalActions(state, options)).toContainEqual(action);
        const result = startAction(state, action, options).result;
        expect(result?.players[1]?.hand).toEqual([hero]);
        expect(result?.players[1]?.discard).toEqual([]);
        if (!result) throw new Error("Activation did not resolve");
        expect(getLegalActions(result, options)).not.toContainEqual(action);
    });

    it("asks which eligible cards to ready when the ready step is capped", () => {
        const { state, p1, options } = setup();
        p1.play = [
            { card: hero, exerted: true, drying: true },
            { card: other, exerted: true, drying: true },
        ];
        p1.modifiers = [{ readyLimit: 1 }];
        const live = startTurn(state, options);
        expect(live.request).toMatchObject({ type: "Choose Cards", cards: [hero, other], min: 1, max: 1 });
        expect(() => live.submit({ type: "Decision", answer: { type: "Choose Cards", cards: [hero, other] } })).toThrow();
        live.submit({ type: "Decision", answer: { type: "Choose Cards", cards: [other] } });
        expect(live.position?.players[1]?.play).toMatchObject([
            { card: hero, exerted: true, drying: false },
            { card: other, exerted: false, drying: false },
        ]);
    });

    it("applies exerted inkwell entry to ink actions and effect movements", () => {
        const { state, p1, options, source } = setup();
        p1.hand = [hero, other];
        const changed = startEffect(state, { type: "Modify Players", players: "You", modifier: { inkEntersExerted: true } }, source, options).result;
        if (!changed) throw new Error("Modifier did not resolve");
        const inked = startAction(changed, { type: "Ink", player: 1, card: hero }, options).result;
        if (!inked) throw new Error("Ink did not resolve");
        expect(inked.players[1]?.inkwell).toEqual([{ card: hero, exerted: true }]);
        const moved = startEffect(inked, { type: "Move Card", cards: { cards: [other] }, to: "Inkwell", exerted: false }, source, options).result;
        expect(moved?.players[1]?.inkwell).toEqual([
            { card: hero, exerted: true },
            { card: other, exerted: true },
        ]);
    });

    it("counts distinct challengers across the selected group, not repeated challenges", () => {
        const { state, p1, p2, options } = setup();
        const enemy = { ...hero, i: 3 };
        p1.play = [{ card: hero }, { card: other }];
        p2.play = [{ card: enemy, exerted: true }];
        p1.modifiers = [{ challengeLimit: 1, count: "Characters", players: { players: [1, 2] } }];
        const history = [{ event: { event: "Challenge" as const, player: 2 as const, attacker: hero, defender: enemy }, before: state, after: state }];
        const actions = getLegalActions(state, options, { history });
        expect(actions).toContainEqual({ type: "Challenge", player: 1, attacker: hero, defender: enemy });
        expect(actions.some((action) => action.type === "Challenge" && action.attacker.i === other.i)).toBe(false);
    });

    it("preserves state and the physical base when shifting", () => {
        const shifted: CharacterCard = {
            ...basic,
            fullName: "Basic Shifted",
            strength: 4,
            cost: 5,
            abilities: [{ type: "Keyword", keyword: { name: "Shift", cost: [{ type: "Ink", amount: 1 }] } }],
        };
        const { state, p1, options } = setup(shifted);
        const top = { fullName: shifted.fullName, i: 3 },
            ink = { ...hero, i: 4 };
        p1.hand = [top];
        p1.inkwell = [{ card: ink, exerted: false }];
        p1.play = [{ card: hero, damage: 2, exerted: true, drying: true, modifiers: [{ stat: "Strength", amount: 1 }] }];
        const live = startAction(state, { type: "Shift", player: 1, card: top, onto: [hero], ability: 0 }, options);
        live.submit({ type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [ink] }] } });
        expect(live.result?.players[1]?.play[0]).toMatchObject({ card: top, damage: 2, exerted: true, drying: true, under: [{ card: hero, faceDown: false }] });
        const result = live.result;
        if (!result) throw new Error("Shift did not complete");
        expect(new Rules(result, options.card).characteristic(top, "Strength")).toBe(5);
        expect(result.players[1]?.discard).toHaveLength(0);
    });

    it("allows Boost once per turn and puts the exact top card face down under its source", () => {
        const boosted: CharacterCard = { ...basic, abilities: [{ type: "Keyword", keyword: { name: "Boost", cost: [{ type: "Ink", amount: 1 }] } }] };
        const { state, p1, options } = setup(boosted);
        const ink = { ...hero, i: 3 };
        p1.play = [{ card: hero }];
        p1.deck = [other];
        p1.inkwell = [{ card: ink, exerted: false }];
        const live = startTurn(state, options);
        live.submit({ type: "Action", action: { type: "Boost", player: 1, card: hero, ability: 0 } });
        live.submit({ type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [ink] }] } });
        expect(live.position?.players[1]?.play[0].under).toEqual([{ card: other, faceDown: true }]);
        expect(live.request?.type).toBe("Action");
        if (live.request?.type !== "Action") throw new Error("Missing action request");
        expect(live.request.actions.some((action) => action.type === "Boost")).toBe(false);
    });

    it("uses the same discounted price for legal intentions and payment", () => {
        const expensive: CharacterCard = { ...basic, cost: 2 };
        const provider: ItemCard = {
            ...basic,
            type: "Item",
            fullName: "Discount",
            abilities: [
                {
                    type: "Static",
                    rule: {
                        type: "Modify Cost",
                        for: "Play",
                        cards: { zone: "Hand", player: "You", cardType: "Character" },
                        amount: -1,
                    },
                },
            ],
        };
        const { state, p1, options } = setup(expensive, provider);
        const ink = { ...hero, i: 3 };
        p1.hand = [hero];
        p1.inkwell = [{ card: ink, exerted: false }];
        p1.play = [{ card: { fullName: provider.fullName, i: 4 } }];
        expect(getLegalActions(state, options)).toContainEqual({ type: "Play", player: 1, card: hero });
        const live = startAction(state, { type: "Play", player: 1, card: hero }, options);
        expect(live.request).toMatchObject({ type: "Pay Cost", cost: [{ type: "Ink", amount: 1 }] });
        live.submit({ type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [ink] }] } });
        expect(live.result?.players[1]?.play).toHaveLength(2);
    });

    it("Put Damage bypasses a one-shot shield, while dealt damage consumes it exactly once", () => {
        const { state, p2, options, source } = setup();
        p2.play = [{ card: other, modifiers: [{ preventDamage: "Next" }] }];
        const live = startEffect(
            state,
            {
                type: "Sequence",
                effects: [
                    { type: "Put Damage", cards: { cards: [other] }, amount: 1 },
                    { type: "Deal Damage", cards: { cards: [other] }, amount: 3 },
                    { type: "Deal Damage", cards: { cards: [other] }, amount: 2 },
                ],
            },
            source,
            options,
        );
        expect(live.result?.players[2]?.play[0].damage).toBe(3);
        expect(live.result?.players[2]?.play[0].modifiers).toEqual([]);
    });

    it("shares a removal budget and rejects incomplete mandatory distributions", () => {
        const { state, p1, options, source } = setup();
        p1.play = [
            { card: hero, damage: 3 },
            { card: other, damage: 2 },
        ];
        const live = startEffect(state, { type: "Remove Damage", cards: { zone: "Play", player: "You" }, amount: 3, distribution: "Total" }, source, options);
        expect(() => live.submit({ type: "Decision", answer: { type: "Distribute Damage Removal", amounts: [{ card: hero, amount: 1 }] } })).toThrow(
            "full available",
        );
        live.submit({
            type: "Decision",
            answer: {
                type: "Distribute Damage Removal",
                amounts: [
                    { card: hero, amount: 2 },
                    { card: other, amount: 1 },
                ],
            },
        });
        expect(live.result?.players[1]?.play.map((card) => card.damage)).toEqual([1, 1]);
    });

    it("binds selected cards into a created listener and consumes its lifetime use", () => {
        const { state, p1, options, source } = setup();
        p1.play = [{ card: hero }, { card: other }];
        const installed = startEffect(
            state,
            {
                type: "Choose Cards",
                from: { zone: "Play", player: "You" },
                count: 1,
                effect: {
                    type: "Create Trigger",
                    trigger: { event: "Quest", card: { capture: "Selected Cards" } },
                    effect: { type: "Gain Lore", player: "You", amount: 2 },
                    uses: 1,
                },
            },
            source,
            options,
        );
        installed.submit({ type: "Decision", answer: { type: "Choose Cards", cards: [hero] } });
        const initial = installed.result;
        if (!initial) throw new Error("Listener was not installed");
        const unrelated = startAction(initial, { type: "Quest", player: 1, card: other }, options).result;
        if (!unrelated) throw new Error("Quest did not resolve");
        expect(unrelated.players[1]?.lore).toBe(1);
        const triggered = startAction(unrelated, { type: "Quest", player: 1, card: hero }, options).result;
        expect(triggered?.players[1]?.lore).toBe(4);
        expect(triggered?.players[1]?.modifiers).toEqual([]);
    });

    it("keeps ownership distinct from control when a stolen card is banished", () => {
        const { state, p1, p2, options, source } = setup();
        p1.play = [{ card: hero }];
        p2.play = [{ card: other }];
        const stolen = startEffect(state, { type: "Gain Control", cards: { cards: [other] } }, source, options).result;
        if (!stolen) throw new Error("Control did not change");
        expect(stolen.players[1]?.play[1]).toMatchObject({ card: other, owner: 2 });
        const banished = startEffect(stolen, { type: "Banish", cards: { cards: [other] } }, source, options).result;
        expect(banished?.players[2]?.discard).toEqual([other]);
        expect(banished?.players[1]?.discard).toEqual([]);
    });
});

describe("gained static abilities", () => {
    it("are suppressed by continuous ability loss for characteristics as well as modifiers", () => {
        const silencer: ItemCard = {
            fullName: "Silencer",
            names: ["Silencer"],
            type: "Item",
            cost: 1,
            inkwell: true,
            colors: ["Amber"],
            subtypes: [],
            abilities: [{ type: "Static", rule: { type: "Modify Cards", cards: { zone: "Play", player: "Opponents" }, modifier: { loseAbility: "All" } } }],
        };
        const { state, p1, p2, options } = setup(silencer);
        p1.play = [
            {
                card: hero,
                modifiers: [{ gainAbility: { type: "Static", rule: { type: "Modify Cards", cards: "Self", modifier: { stat: "Strength", amount: 3 } } } }],
            },
        ];
        expect(new Rules(state, options.card).characteristic(hero, "Strength")).toBe(5);
        p2.play = [{ card: { fullName: silencer.fullName, i: 50 } }];
        const rules = new Rules(state, options.card);
        expect(rules.characteristic(hero, "Strength")).toBe(2);
        expect(rules.modifiers(hero).some((modifier) => "stat" in modifier)).toBe(false);
    });
});
