import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: c4502c6986c1
const abilityText = "When you move a character here from a location, you may banish this location to gain 3 lore and draw 3 cards.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Sugar Rush Speedway - Finish Line",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("requires moving from another location before the sacrifice (%s)", async (fromLocation) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                fullName: "Destination",
                names: ["Destination"],
                type: "Location" as const,
                colors: [],
                subtypes: [],
                cost: 0,
                inkwell: false,
                moveCost: 5,
                willpower: 10,
                lore: 0,
            },
            {
                fullName: "Target",
                names: ["Target"],
                type: "Character" as const,
                colors: [],
                subtypes: [],
                cost: 0,
                inkwell: false,
                strength: 2,
                willpower: 10,
                lore: 0,
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, Array(5).fill("Dinglehopper"));
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 10 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const [source, start, mover] = playerAt(scenarioGame, 1).play.map((state) => state.card),
            deck = [...playerAt(scenarioGame, 1).deck];
        if (fromLocation) inPlay(scenarioRules(), mover).location = start;
        expect(
            await (async () => {
                if (fromLocation === false) {
                    const action0: PlayerAction | undefined = { type: "Move", player: 1, card: mover, location: source };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer().on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Ink", amount: 6 }]);
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
                                            ],
                                        },
                                    ],
                                },
                            };
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (fromLocation === true) {
                    const action0: PlayerAction | undefined = { type: "Move", player: 1, card: mover, location: source };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer()
                            .on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Ink", amount: 6 }]);
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
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).play.map((state) => state.card)).toEqual(fromLocation ? [start, mover] : [source, start, mover]);
        expect(playerAt(scenarioGame, 1).discard).toEqual(fromLocation ? [source] : []);
        expect(playerAt(scenarioGame, 1).lore).toBe(fromLocation ? 3 : 0);
        expect(playerAt(scenarioGame, 1).hand).toEqual(fromLocation ? deck.slice(0, 3) : []);
        expect(playerAt(scenarioGame, 1).deck).toEqual(fromLocation ? deck.slice(3) : deck);
    });
});
