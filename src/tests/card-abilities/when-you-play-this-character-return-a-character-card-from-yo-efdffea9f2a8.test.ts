import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: efdffea9f2a8
const abilityText =
    "When you play this character, return a character card from your discard to your hand. If that card is a Princess character card, gain 2 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Wreck-It Ralph - Admiral Underpants",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("returns a character and rewards only a Princess (%s)", async (princess) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [princess ? "Cinderella - Ballroom Sensation" : "HeiHei - Boat Snack"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 7 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const returned = playerAt(scenarioGame, 1).discard[0];
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Ink", amount: 7 }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(7);
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
                                            ],
                                        },
                                    ],
                                },
                            };
                        })
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toContainEqual(returned);
        expect(playerAt(scenarioGame, 1).lore).toBe(princess ? 2 : 0);
    });
});
