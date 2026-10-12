import * as engine from "../../engine/engine";
import { InvalidInput } from "../../engine/invalid-input";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/during-the-opposing-players-turn-they-may-together-pay-3-lor-7fd15a8ba44b.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 7fd15a8ba44b
const abilityText = "During the opposing players' turn, they may together pay 3 lore to banish this character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Hercules - Manipulated Hero",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("requires the opponents to pay three lore together (%s)", async (payable) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        scenarioGame.players[3] = emptyPlayer();
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).lore = 1;
        playerAt(scenarioGame, 3).lore = payable ? 2 : 1;
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        const source = playerAt(scenarioGame, 1).play[0].card;
        expect(
            await (async () => {
                if (payable === false) {
                    const action: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) =>
                            action.player === 2 &&
                            ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source) && action.ability.i === 2) ||
                                (action.type === "Boost" && action.ability === 2 && sameCard(action.card, source))),
                    );
                    if (!action) return false;
                    try {
                        scenarioResolution = engine.startAction(scenarioGame, action, { card: scenarioCards.lookup });
                    } catch (error) {
                        if (error instanceof InvalidInput) return false;
                        throw error;
                    }
                    resolvePlayers(scenarioResolution, {});
                    scenarioGame = finished(scenarioResolution);
                    return true;
                    return true;
                }
                if (payable === true) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) =>
                            action.player === 2 &&
                            ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source) && action.ability.i === 2) ||
                                (action.type === "Boost" && action.ability === 2 && sameCard(action.card, source))),
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(
                        scenarioResolution,
                        {},
                        {
                            joint: new ScriptedPlayer().on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Lose Lore", amount: 3 }]);
                                expect(request.ink[0].player).toBe(2);
                                expect(request.ink[0].cards).toHaveLength(0);
                                expect(request.ink[1].player).toBe(3);
                                expect(request.ink[1].cards).toHaveLength(0);
                                return {
                                    type: "Decision",
                                    answer: {
                                        type: "Pay Cost",
                                        pay: true,
                                        payment: [
                                            { type: "Lose Lore", player: 2, amount: 1 },
                                            { type: "Lose Lore", player: 3, amount: 2 },
                                        ],
                                    },
                                };
                            }),
                        },
                    );
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(payable);
        if (payable) {
            expect(playerAt(scenarioGame, 1).discard).toContainEqual(source);
            expect(playerAt(scenarioGame, 2).lore).toBe(0);
            expect(playerAt(scenarioGame, 3).lore).toBe(0);
        } else {
            expect(playerAt(scenarioGame, 1).play.map((card) => card.card)).toContainEqual(source);
            expect(playerAt(scenarioGame, 2).lore + playerAt(scenarioGame, 3).lore).toBe(2);
        }
    });
});
