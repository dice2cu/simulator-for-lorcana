import { describe, expect, it } from "vitest";
import { RandomBot } from "../../bot/random-bot";
import { startEffect, startTurn } from "../../engine/engine";
import type { Condition, Effect } from "../../model/ability";
import type { CardIdentifier } from "../../model/identity";
import type { GameState, PlayerPosition } from "../../model/game-state";
import { projectState, sight } from "../../player/projection";
import { projectRequest } from "../../player/requests";

const order = (count: number) => Array.from({ length: count }, (_, i) => i);

const player = (offset: number): PlayerPosition => ({
    lore: 0,
    turnsTaken: 1,
    hand: [],
    deck: [{ fullName: "Mickey Mouse - True Friend", i: offset }],
    discard: [],
    play: [],
    inkwell: [],
});

describe("card choice constraints", () => {
    it("states a must-be-chosen character and a capped total, and the bots honour both", () => {
        const john = { fullName: "John Smith - Undaunted Protector", i: 31 },
            big = { fullName: "Hercules - Divine Hero", i: 32 },
            small = { fullName: "Mickey Mouse - True Friend", i: 33 };
        const state: GameState = { turn: { number: 3, player: 1 }, players: { 1: player(10), 2: player(20) } };
        state.players[2]!.play = [{ card: big }, { card: small }, { card: john }];
        const banish = (where?: Condition): Effect => ({
            type: "Choose Cards",
            from: { zone: "Play", player: "Opponents", cardType: "Character" },
            count: "Any",
            ...(where ? { where } : {}),
            effect: { type: "Banish", cards: "Selected Cards" },
        });
        const source = { card: { fullName: "Mickey Mouse - True Friend", i: 1 }, player: 1 as const, kind: "Ability" as const };
        const forced = startEffect(state, banish(), source);
        if (forced.request?.type !== "Choose Cards") throw new Error("Expected a card choice");
        expect(forced.request.required).toEqual([john]);
        const capped = startEffect(state, banish({ value: { sum: { stat: "Strength", cards: "Selected Cards" } }, is: { atMost: 4 } }), source);
        if (capped.request?.type !== "Choose Cards") throw new Error("Expected a card choice");
        const rules = capped.rules!;
        expect(capped.request.total?.max).toBe(4);
        for (const live of [forced, capped]) {
            const request = live.request!;
            if (request.type !== "Choose Cards") throw new Error("Expected a card choice");
            const projected = projectRequest(request, live.rules!, sight(live.position!, 1), order);
            if (projected.request.type !== "Choose Cards") throw new Error("Expected a projected card choice");
            for (let seed = 0; seed < 20; seed++) {
                const answer = new RandomBot({ deck: [], seed }).decide(projectState(live.position!, sight(live.position!, 1)), projected.request);
                if (answer.type !== "Decision" || answer.answer.type !== "Choose Cards") throw new Error("Expected a card answer");
                const cards = answer.answer.cards as CardIdentifier[];
                if (live === forced && cards.length) expect(cards.some((card) => card.i === john.i)).toBe(true);
                if (live === capped) expect(cards.reduce((sum, card) => sum + rules.characteristic(card, "Strength"), 0)).toBeLessThanOrEqual(4);
            }
        }
    });
});

describe("projected requests", () => {
    it("describes a granted activation, not another ability of the same card", () => {
        const forest = { fullName: "Sherwood Forest - Outlaw Hideaway", i: 1 },
            ursula = { fullName: "Ursula - Eric's Bride", i: 2 };
        const player = (offset: number): PlayerPosition => ({
            lore: 0,
            turnsTaken: 1,
            hand: [],
            deck: [{ fullName: "Mickey Mouse - True Friend", i: offset }],
            discard: [],
            play: [],
            inkwell: [{ card: { fullName: "Mickey Mouse - True Friend", i: offset + 1 }, exerted: false }],
        });
        const state: GameState = { turn: { number: 3, player: 1 }, players: { 1: player(10), 2: player(20) } };
        state.players[1]!.play = [{ card: forest }, { card: ursula, location: forest }];
        state.players[2]!.play = [{ card: { fullName: "Mickey Mouse - True Friend", i: 30 }, damage: 1 }];
        const live = startTurn(state);
        if (live.request?.type !== "Action") throw new Error("Expected an action request");
        const projected = projectRequest(live.request, live.rules!, sight(live.position!, 1), order).request;
        if (projected.type !== "Action") throw new Error("Expected a projected action request");
        const activation = projected.actions.find((entry) => entry.action.type === "Activate" && entry.action.card.fullName === ursula.fullName);
        expect(activation?.action).toMatchObject({
            type: "Activate",
            definition: { type: "Activated", cost: [{ type: "Exert" }, { type: "Ink", amount: 1 }] },
        });
    });
});
