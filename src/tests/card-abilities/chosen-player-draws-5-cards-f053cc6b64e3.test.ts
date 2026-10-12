import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: f053cc6b64e3
const abilityText = "Chosen player draws 5 cards.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Second Star to the Right",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([1, 2] as const)("draws exactly five cards for the chosen player only (%s)", async (chosen) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        for (const id of [1, 2] as const)
            playerAt(scenarioGame, id).deck = cardIds(
                scenarioCards,
                Array.from({ length: 7 }, () => "Dinglehopper"),
            );
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: scenarioCards.definition(prototypeCardName).cost }, () => ({
            card: scenarioCards.create("Dinglehopper"),
            exerted: false,
        }));
        const deck = [...playerAt(scenarioGame, chosen).deck];
        const other = chosen === 1 ? 2 : 1;
        expect(
            await (async () => {
                if (chosen === 2) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer()
                            .on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Ink", amount: 10 }]);
                                expect(request.ink[0].player).toBe(1);
                                expect(request.ink[0].cards).toHaveLength(10);
                                return {
                                    type: "Decision",
                                    answer: {
                                        type: "Pay Cost",
                                        pay: true,
                                        payment: [
                                            {
                                                type: "Ink",
                                                player: 1,
                                                cards: [
                                                    request.ink[0].cards[0],
                                                    request.ink[0].cards[1],
                                                    request.ink[0].cards[2],
                                                    request.ink[0].cards[3],
                                                    request.ink[0].cards[4],
                                                    request.ink[0].cards[5],
                                                    request.ink[0].cards[6],
                                                    request.ink[0].cards[7],
                                                    request.ink[0].cards[8],
                                                    request.ink[0].cards[9],
                                                ],
                                            },
                                        ],
                                    },
                                };
                            })
                            .on("Choose Player", (request) => {
                                expect(request.players).toEqual([1, 2]);
                                return { type: "Decision", answer: { type: "Choose Player", player: 2 } };
                            }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (chosen === 1) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer()
                            .on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Ink", amount: 10 }]);
                                expect(request.ink[0].player).toBe(1);
                                expect(request.ink[0].cards).toHaveLength(10);
                                return {
                                    type: "Decision",
                                    answer: {
                                        type: "Pay Cost",
                                        pay: true,
                                        payment: [
                                            {
                                                type: "Ink",
                                                player: 1,
                                                cards: [
                                                    request.ink[0].cards[0],
                                                    request.ink[0].cards[1],
                                                    request.ink[0].cards[2],
                                                    request.ink[0].cards[3],
                                                    request.ink[0].cards[4],
                                                    request.ink[0].cards[5],
                                                    request.ink[0].cards[6],
                                                    request.ink[0].cards[7],
                                                    request.ink[0].cards[8],
                                                    request.ink[0].cards[9],
                                                ],
                                            },
                                        ],
                                    },
                                };
                            })
                            .on("Choose Player", (request) => {
                                expect(request.players).toEqual([1, 2]);
                                return { type: "Decision", answer: { type: "Choose Player", player: 1 } };
                            }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, chosen).hand).toEqual(deck.slice(0, 5));
        expect(playerAt(scenarioGame, chosen).deck).toEqual(deck.slice(5));
        expect(playerAt(scenarioGame, other).hand).toEqual([]);
        expect(playerAt(scenarioGame, other).deck).toHaveLength(7);
    });
});
