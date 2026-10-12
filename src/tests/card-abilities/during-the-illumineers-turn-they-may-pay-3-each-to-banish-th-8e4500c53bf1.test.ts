import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/during-the-illumineers-turn-they-may-pay-3-each-to-banish-th-8e4500c53bf1.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 8e4500c53bf1
const abilityText = "During the Illumineers' turn, they may pay 3 ⬡ each to banish this character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Monumental Scarab - Skittering Statue",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each(["insufficient", "declined", "paid"] as const)("requires every Illumineer to pay three ink (%s)", async (mode) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        scenarioGame.players[3] = emptyPlayer();
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        playerAt(scenarioGame, 3).inkwell = Array.from({ length: mode === "insufficient" ? 2 : 3 }, () => ({
            card: scenarioCards.create("Dinglehopper"),
            exerted: false,
        }));
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        const source = playerAt(scenarioGame, 1).play[0].card;
        const available = (2 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).some(
            (action) => action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source),
        );
        expect(available).toBe(mode !== "insufficient");
        if (mode === "paid") {
            expect(
                await (async () => {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) =>
                            action.player === 2 &&
                            ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source) && action.ability.i === 0) ||
                                (action.type === "Boost" && action.ability === 0 && sameCard(action.card, source))),
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(
                        scenarioResolution,
                        {},
                        {
                            joint: new ScriptedPlayer().on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Ink", amount: 3, each: true }]);
                                expect(request.ink[0].player).toBe(2);
                                expect(request.ink[0].cards).toHaveLength(3);
                                expect(request.ink[1].player).toBe(3);
                                expect(request.ink[1].cards).toHaveLength(3);
                                return {
                                    type: "Decision",
                                    answer: {
                                        type: "Pay Cost",
                                        pay: true,
                                        payment: [
                                            { type: "Ink", player: 2, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] },
                                            { type: "Ink", player: 3, cards: [request.ink[1].cards[0], request.ink[1].cards[1], request.ink[1].cards[2]] },
                                        ],
                                    },
                                };
                            }),
                        },
                    );
                    scenarioGame = finished(scenarioResolution);
                    return true;
                })(),
            ).toBe(true);
            expect(playerAt(scenarioGame, 1).discard).toContainEqual(source);
            expect(playerAt(scenarioGame, 2).inkwell.filter((ink) => !ink.exerted)).toHaveLength(0);
            expect(playerAt(scenarioGame, 3).inkwell.filter((ink) => !ink.exerted)).toHaveLength(0);
        } else {
            expect(playerAt(scenarioGame, 1).play.map((card) => card.card)).toContainEqual(source);
            expect(playerAt(scenarioGame, 2).inkwell.filter((ink) => !ink.exerted)).toHaveLength(3);
            expect(playerAt(scenarioGame, 3).inkwell.filter((ink) => !ink.exerted)).toHaveLength(mode === "insufficient" ? 2 : 3);
        }
    });
});
