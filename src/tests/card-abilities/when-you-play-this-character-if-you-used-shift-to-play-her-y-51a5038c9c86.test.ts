import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: 51a5038c9c86
const abilityText = "When you play this character, if you used Shift to play her, you may draw 4 cards.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Magica De Spell - Conniving Sorceress",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("draws only when the actual play uses Shift (%s)", async (shifted) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const printed = scenarioCards.definition(prototypeCardName);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                fullName: "Shift base",
                names: printed.names,
                type: "Character" as const,
                colors: printed.colors,
                subtypes: [],
                cost: 0,
                inkwell: false,
                strength: 1,
                willpower: 5,
                lore: 0,
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            Array.from({ length: 6 }, () => "Dinglehopper"),
        );
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 7 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = playerAt(scenarioGame, 1).hand[0];
        const onto = playerAt(scenarioGame, 1).play[0].card;
        const deck = [...playerAt(scenarioGame, 1).deck];
        if (shifted)
            expect(
                await (async () => {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) =>
                            action.type === "Shift" &&
                            action.player === 1 &&
                            sameCard(action.card, source) &&
                            action.onto.length === 1 &&
                            sameCard(action.onto[0], onto),
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
                            .on("Optional", (request) => {
                                return { type: "Decision", answer: { type: "Optional", accept: true } };
                            }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                })(),
            ).toBe(true);
        else
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
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                })(),
            ).toBe(true);
        const amount = shifted ? 4 : 0;
        expect(playerAt(scenarioGame, 1).hand).toEqual(deck.slice(0, amount));
        expect(playerAt(scenarioGame, 1).deck).toEqual(deck.slice(amount));
        expect(playerAt(scenarioGame, 1).play.some((state) => state.card.i === source.i)).toBe(true);
    });
});
