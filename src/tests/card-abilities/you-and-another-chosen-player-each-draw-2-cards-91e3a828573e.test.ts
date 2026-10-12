import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: 91e3a828573e
const abilityText = "You and another chosen player each draw 2 cards.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "If I Didn't Have You",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("draws exactly two for you and the chosen other player, not an unchosen opponent", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        scenarioGame.players[3] = emptyPlayer();
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        for (const id of [1, 2, 3] as const)
            playerAt(scenarioGame, id).deck = cardIds(
                scenarioCards,
                Array.from({ length: 4 }, () => "Dinglehopper"),
            );
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: scenarioCards.definition(prototypeCardName).cost }, () => ({
            card: scenarioCards.create("Dinglehopper"),
            exerted: false,
        }));
        const originals = ([1, 2, 3] as const).map((id) => ({ id, deck: [...playerAt(scenarioGame, id).deck] }));
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
                            expect(request.cost).toEqual([{ type: "Ink", amount: 3 }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(3);
                            return {
                                type: "Decision",
                                answer: {
                                    type: "Pay Cost",
                                    pay: true,
                                    payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] }],
                                },
                            };
                        })
                        .on("Choose Player", (request) => {
                            expect(request.players).toEqual([2, 3]);
                            return { type: "Decision", answer: { type: "Choose Player", player: 3 } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        for (const { id, deck } of originals) {
            const chosen = id !== 2;
            expect(playerAt(scenarioGame, id).hand).toEqual(chosen ? deck.slice(0, 2) : []);
            expect(playerAt(scenarioGame, id).deck).toEqual(chosen ? deck.slice(2) : deck);
        }
    });
});
