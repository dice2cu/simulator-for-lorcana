import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: bf6994879d96
const abilityText = "Each opponent may choose and discard a card. For each opponent who doesn't, you draw a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Ursula's Trickery",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("draws once per opponent who does not discard, including empty hands (%s)", async (discard) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        scenarioGame.players[3] = emptyPlayer();
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper"]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            Array.from({ length: 4 }, () => "Dinglehopper"),
        );
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: scenarioCards.definition(prototypeCardName).cost }, () => ({
            card: scenarioCards.create("Dinglehopper"),
            exerted: false,
        }));
        const [chosen, kept] = playerAt(scenarioGame, 2).hand;
        const deck = [...playerAt(scenarioGame, 1).deck];
        expect(
            await (async () => {
                if (discard === true) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                    );
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
                        2: new ScriptedPlayer()
                            .on("Optional", (request) => {
                                return { type: "Decision", answer: { type: "Optional", accept: true } };
                            })
                            .on("Choose Cards", (request) => {
                                expect(request.min).toBe(1);
                                expect(request.max).toBe(1);
                                return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                            }),
                        3: new ScriptedPlayer().on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: false } };
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (discard === false) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                    );
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
                        2: new ScriptedPlayer().on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: false } };
                        }),
                        3: new ScriptedPlayer().on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: false } };
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(true);
        const amount = discard ? 1 : 2;
        expect(playerAt(scenarioGame, 1).hand).toEqual(deck.slice(0, amount));
        expect(playerAt(scenarioGame, 1).deck).toEqual(deck.slice(amount));
        expect(playerAt(scenarioGame, 2).hand).toEqual(discard ? [kept] : [chosen, kept]);
        expect(playerAt(scenarioGame, 2).discard).toEqual(discard ? [chosen] : []);
        expect(playerAt(scenarioGame, 3).hand).toEqual([]);
    });
});
