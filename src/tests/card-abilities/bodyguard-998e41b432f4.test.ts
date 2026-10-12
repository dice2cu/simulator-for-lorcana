import { describe, expect, it } from "vitest";
import { ScriptedPlayer } from "../player/scripted-player";
import { getCard } from "../../cards";
import { sameCard } from "../../engine/identity";
import { playGame } from "../../player/runner";
import type { GameState } from "../../model/game-state";

// Generated ability ID: 998e41b432f4
const abilityText = "Bodyguard";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mickey Mouse - Musketeer Captain",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];

describe(abilityText, () => {
    it("enters exerted and protects another exerted character from challenges", () => {
        const ordinaryTarget = { fullName: "Stitch - Rock Star", i: 1 };
        const attacker = { fullName: "HeiHei - Boat Snack", i: 2 };
        const bodyguard = { fullName: prototypeCardName, i: 3 };
        const definition = getCard(prototypeCardName);
        if (definition?.type !== "Character") throw new Error("Missing Bodyguard character");
        const state: GameState = {
            turn: { number: 1, player: 1 },
            players: {
                1: {
                    lore: 0,
                    turnsTaken: 0,
                    deck: [{ fullName: "Dinglehopper", i: 199 }],
                    hand: [bodyguard],
                    discard: [],
                    play: [{ card: ordinaryTarget }],
                    inkwell: Array.from({ length: 10 }, (_, i) => ({ card: { fullName: "Dinglehopper", i: 100 + i }, exerted: false })),
                },
                2: {
                    lore: 0,
                    turnsTaken: 0,
                    hand: [],
                    discard: [],
                    inkwell: [],
                    play: [{ card: attacker }],
                    deck: [200, 201].map((i) => ({ fullName: "Dinglehopper", i })),
                },
            },
        };
        const first = new ScriptedPlayer()
            // Exert the ordinary target by questing, rather than bypassing turn-start readying.
            .action((action) => action.type === "Quest" && sameCard(action.card, ordinaryTarget))
            .action((action) => action.type === "Play" && sameCard(action.card, bodyguard))
            .on("Pay Cost", (request) => {
                expect(request.cost).toEqual([{ type: "Ink", amount: definition.cost }]);
                expect(request.optional).toBe(false);
                return {
                    type: "Decision",
                    answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: request.ink[0].cards.slice(0, definition.cost) }] },
                };
            })
            .on("Optional", (request) => {
                expect(request.effect.type).toBe("Exert");
                return { type: "Decision", answer: { type: "Optional", accept: true } };
            })
            .action((action) => action.type === "End Turn");
        const second = new ScriptedPlayer().on("Action", (request, view) => {
            const board = view.players[1]?.play;
            expect(board?.find((entry) => sameCard(entry.card, bodyguard))?.exerted).toBe(true);
            expect(board?.find((entry) => sameCard(entry.card, ordinaryTarget))?.exerted).toBe(true);
            const challenges = request.actions
                .map((entry) => entry.action)
                .filter((action) => action.type === "Challenge")
                .filter((action) => sameCard(action.attacker, attacker));
            expect(challenges.some((action) => sameCard(action.defender, ordinaryTarget))).toBe(false);
            expect(challenges.some((action) => sameCard(action.defender, bodyguard))).toBe(true);
            const end = request.actions.find((entry) => entry.action.type === "End Turn");
            if (!end) throw new Error("Missing End Turn action");
            return { type: "Action", option: end.option };
        });
        playGame(
            [
                { player: 1, deck: [], controller: first },
                { player: 2, deck: [], controller: second },
            ],
            { seed: 1, from: state, turns: 2, audit: true },
        );
    });
});
