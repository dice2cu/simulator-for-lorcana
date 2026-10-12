import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: 40d36d6fe3e1
const abilityText = "Each player discards their hand and draws 7 cards.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "A Whole New World",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("discards both original hands and replaces each with exactly seven cards", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName, "Dinglehopper"]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, ["Dinglehopper"]);
        for (const id of [1, 2] as const)
            playerAt(scenarioGame, id).deck = cardIds(
                scenarioCards,
                Array.from({ length: 9 }, () => "Dinglehopper"),
            );
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: scenarioCards.definition(prototypeCardName).cost }, () => ({
            card: scenarioCards.create("Dinglehopper"),
            exerted: false,
        }));
        const source = playerAt(scenarioGame, 1).hand[0];
        const originals = ([1, 2] as const).map((id) => ({
            id,
            hand: playerAt(scenarioGame, id).hand.slice(id === 1 ? 1 : 0),
            deck: [...playerAt(scenarioGame, id).deck],
        }));
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 5 }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(5);
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
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        for (const { id, hand, deck } of originals) {
            expect(playerAt(scenarioGame, id).discard).toEqual(id === 1 ? [...hand, source] : hand);
            expect(playerAt(scenarioGame, id).hand).toEqual(deck.slice(0, 7));
            expect(playerAt(scenarioGame, id).deck).toEqual(deck.slice(7));
        }
    });
});
