import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import { InvalidInput } from "../../engine/invalid-input";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: 92974557b6b7
const abilityText = "While this character is exerted, you may play characters from your discard. If you do, they enter play exerted. (You pay all costs.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Horned King - Merciless Master",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("allows paid discard play only while exerted (%s)", async (exerted) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: prototypeCardName, exerted }]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, ["HeiHei - Boat Snack"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 1 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const card = playerAt(scenarioGame, 1).discard[0];
        expect(
            await (async () => {
                if (exerted === true) {
                    const action0: PlayerAction | undefined = { type: "Play", player: 1, card };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer().on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Ink", amount: 1 }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(1);
                            return {
                                type: "Decision",
                                answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0]] }] },
                            };
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (exerted === false) {
                    const action: PlayerAction | undefined = { type: "Play", player: 1, card };
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
                throw new Error("Unspecified script case");
            })(),
        ).toBe(exerted);
        if (exerted) {
            expect(playerAt(scenarioGame, 1).discard).not.toContainEqual(card);
            expect(playerAt(scenarioGame, 1).play.map((state) => state.card)).toContainEqual(card);
            expect(scenarioRules().locate(card)?.zone).toBe("Play");
            expect(inPlay(scenarioRules(), card).exerted).toBe(true);
            expect(playerAt(scenarioGame, 1).inkwell.filter((ink) => !ink.exerted)).toHaveLength(0);
        }
    });
});
