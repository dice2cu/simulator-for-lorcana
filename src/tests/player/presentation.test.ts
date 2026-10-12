import { expect, it } from "vitest";
import { getCard } from "../../cards";
import { Rules } from "../../engine/rules";
import type { Card } from "../../model/card";
import type { GameState } from "../../model/game-state";
import { projectCharacteristics } from "../../player/projection";
import { startEffect } from "../../engine/engine";
import { projectRequest } from "../../player/requests";
import { sight } from "../../player/projection";

it("projects effective public stats, including continuous effects, but never hidden cards", () => {
    const printed = getCard("Mickey Mouse - True Friend");
    if (!printed || printed.type !== "Character") throw new Error("Missing character fixture");
    const captain: Card = {
        ...printed,
        fullName: "Test Captain",
        abilities: [
            {
                type: "Static",
                rule: { type: "Modify Cards", cards: { zone: "Play", player: "You", cardType: "Character" }, modifier: { stat: "Strength", amount: 2 } },
            },
        ],
    };
    const card = { fullName: printed.fullName, i: 1 },
        source = { fullName: captain.fullName, i: 2 };
    const state: GameState = {
        turn: { number: 2, player: 1 },
        players: {
            1: {
                lore: 0,
                turnsTaken: 1,
                deck: [{ fullName: printed.fullName, i: 3 }],
                hand: [{ fullName: printed.fullName, i: 4 }],
                inkwell: [{ card: { fullName: printed.fullName, i: 5 }, exerted: false }],
                discard: [],
                play: [
                    {
                        card,
                        modifiers: [
                            { stat: "Willpower", amount: -1 },
                            { stat: "Lore", amount: 1 },
                        ],
                    },
                    { card: source },
                ],
            },
        },
    };
    const rules = new Rules(state, (name) => (name === captain.fullName ? captain : getCard(name)));
    const display = projectCharacteristics(rules);
    expect(display).toHaveLength(2);
    expect(display[0]).toEqual({ card, strength: printed.strength + 2, willpower: printed.willpower - 1, lore: printed.lore + 1 });
    expect(display.every((entry) => entry.card.i <= 2)).toBe(true);
});

it("accepts a legal custom payment beyond the first 32 suggestions", () => {
    const hand = Array.from({ length: 10 }, (_, i) => ({ fullName: "Mickey Mouse - True Friend", i }));
    const state: GameState = { turn: { number: 2, player: 1 }, players: { 1: { lore: 0, turnsTaken: 1, hand, deck: [], play: [], discard: [], inkwell: [] } } };
    const live = startEffect(
        state,
        {
            type: "Pay Cost",
            cost: [{ type: "Choose Cards", from: { zone: "Hand", player: "You" }, count: 2, cost: [{ type: "Discard", cards: "Selected Cards" }] }],
            then: { type: "Gain Lore", player: "You", amount: 1 },
        },
        { card: { fullName: "Mickey Mouse - True Friend", i: 100 }, player: 1, kind: "Ability" },
    );
    if (live.request?.type !== "Pay Cost" || !live.rules || !live.position) throw new Error("Missing payment request");
    const projected = projectRequest(live.request, live.rules, sight(live.position, 1));
    if (projected.request.type !== "Pay Cost") throw new Error("Missing projected payment");
    const cards = hand.slice(-2);
    expect(projected.request.payments).toHaveLength(32);
    expect(projected.request.cards).toHaveLength(10);
    expect(projected.request.payments.some((plan) => plan.some((part) => "cards" in part && JSON.stringify(part.cards) === JSON.stringify(cards)))).toBe(false);
    live.submit(projected.toStep({ type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Discard", player: 1, cards }] } }));
    expect(live.result?.players[1]?.discard).toEqual(cards);
    expect(live.result?.players[1]?.lore).toBe(1);
});

it("lets a player choose which hidden ready ink to exert", () => {
    const first = { fullName: "Mickey Mouse - True Friend", i: 10 },
        second = { fullName: "Hercules - Divine Hero", i: 20 };
    const state: GameState = {
        turn: { number: 2, player: 1 },
        players: {
            1: {
                lore: 0,
                turnsTaken: 1,
                hand: [],
                deck: [],
                play: [],
                discard: [],
                inkwell: [
                    { card: first, exerted: false },
                    { card: second, exerted: false },
                ],
            },
        },
    };
    const live = startEffect(
        state,
        { type: "Pay Cost", cost: [{ type: "Ink", amount: 1 }], then: { type: "Gain Lore", player: "You", amount: 1 } },
        { card: { fullName: "Mickey Mouse - True Friend", i: 100 }, player: 1, kind: "Ability" },
    );
    if (live.request?.type !== "Pay Cost" || !live.rules || !live.position) throw new Error("Missing payment request");
    const projected = projectRequest(live.request, live.rules, sight(live.position, 1));
    if (projected.request.type !== "Pay Cost") throw new Error("Missing projected payment");
    const chosen = projected.request.ink[0]?.cards[1];
    if (!chosen) throw new Error("Missing second ink choice");
    expect(chosen).toEqual({ hidden: 1 });
    expect(projected.request.ink[0]?.cards.every((card) => "hidden" in card)).toBe(true);
    live.submit(projected.toStep({ type: "Decision", answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [chosen] }] } }));
    expect(live.result?.players[1]?.inkwell).toEqual([
        { card: first, exerted: false },
        { card: second, exerted: true },
    ]);
});
