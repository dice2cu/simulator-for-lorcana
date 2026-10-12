import * as engine from "../../engine/engine";
import { InvalidInput } from "../../engine/invalid-input";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: 4ae47e8761e8
const abilityText = "You can't play this action unless 2 or more cards were put into your discard this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Escape Plan",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 1, 2])("requires two actual friendly discard entries before playing (%s)", async (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            prototypeCardName,
            ...Array.from({ length: count }, () => ({
                fullName: "Preparation",
                names: ["Preparation"] as const,
                type: "Action" as const,
                colors: [],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: { type: "Gain Lore" as const, player: "You" as const, amount: 0 },
            })),
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 10 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = playerAt(scenarioGame, 1).hand[0];
        {
            scenarioLive = engine.startTurn(scenarioGame, { card: scenarioCards.lookup });
            scenarioResolution = scenarioLive;
            resolvePlayers(
                scenarioResolution,
                {},
                {
                    untilAction: true,
                },
            );
            scenarioGame = finished(scenarioResolution, true);
            if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
        }
        for (let i = 0; i < count; i++)
            expect(
                await (async () => {
                    if (!scenarioLive) throw new Error("No live turn");
                    scenarioResolution = scenarioLive;
                    const action: PlayerAction | undefined = (
                        scenarioLive?.request?.type === "Action" ? scenarioLive.request.actions : getLegalActions(scenarioGame, { card: scenarioCards.lookup })
                    ).find((action) => action.type === "Play" && action.player === 1 && action.card.fullName === "Preparation");
                    if (!action) throw new Error("Expected a legal action");
                    scenarioResolution.submit({ type: "Action", action });
                    resolvePlayers(
                        scenarioResolution,
                        {},
                        {
                            untilAction: true,
                        },
                    );
                    scenarioGame = finished(scenarioResolution, true);
                    if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                    return true;
                })(),
            ).toBe(true);
        expect(
            await (async () => {
                if (count === 2) {
                    if (!scenarioLive) throw new Error("No live turn");
                    scenarioResolution = scenarioLive;
                    const action: PlayerAction | undefined = { type: "Play", player: 1, card: source };
                    if (!action) throw new Error("Expected a legal action");
                    scenarioResolution.submit({ type: "Action", action });
                    resolvePlayers(
                        scenarioResolution,
                        {
                            1: new ScriptedPlayer().on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Ink", amount: 5 }]);
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
                                                ],
                                            },
                                        ],
                                    },
                                };
                            }),
                        },
                        {
                            untilAction: true,
                        },
                    );
                    scenarioGame = finished(scenarioResolution, true);
                    if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                    return true;
                }
                if (count === 1) {
                    const action: PlayerAction | undefined = { type: "Play", player: 1, card: source };
                    if (!action) return false;
                    try {
                        if (scenarioLive) {
                            scenarioResolution = scenarioLive;
                            scenarioResolution.submit({ type: "Action", action });
                        } else scenarioResolution = engine.startAction(scenarioGame, action, { card: scenarioCards.lookup });
                    } catch (error) {
                        if (error instanceof InvalidInput) return false;
                        throw error;
                    }
                    resolvePlayers(scenarioResolution, {}, { untilAction: Boolean(scenarioLive) });
                    scenarioGame = finished(scenarioResolution, Boolean(scenarioLive));
                    return true;
                    return true;
                }
                if (count === 0) {
                    const action: PlayerAction | undefined = { type: "Play", player: 1, card: source };
                    if (!action) return false;
                    try {
                        if (scenarioLive) {
                            scenarioResolution = scenarioLive;
                            scenarioResolution.submit({ type: "Action", action });
                        } else scenarioResolution = engine.startAction(scenarioGame, action, { card: scenarioCards.lookup });
                    } catch (error) {
                        if (error instanceof InvalidInput) return false;
                        throw error;
                    }
                    resolvePlayers(scenarioResolution, {}, { untilAction: Boolean(scenarioLive) });
                    scenarioGame = finished(scenarioResolution, Boolean(scenarioLive));
                    return true;
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(count >= 2);
        expect(playerAt(scenarioGame, 1).hand.some((card) => card.i === source.i)).toBe(count < 2);
        expect(playerAt(scenarioGame, 1).discard.some((card) => card.i === source.i)).toBe(count >= 2);
        expect(playerAt(scenarioGame, 1).inkwell.filter((ink) => ink.exerted)).toHaveLength(count >= 2 ? scenarioCards.definition(prototypeCardName).cost : 0);
    });
});
