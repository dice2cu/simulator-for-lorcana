import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: ab9a20f18f4f
const abilityText =
    "When you play this character, you may pay 2 ⬡ to choose one: • Each opponent chooses and discards a card. • Chosen character gets +2 ¤ this turn. • Banish chosen damaged character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Anna - Diplomatic Queen",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 1, 2])("pays two ink and resolves the chosen mode (%s)", async (mode) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: {
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 4,
                    willpower: 10,
                    lore: 0,
                },
                damage: 1,
            },
        ]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, ["Dinglehopper"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 5 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const target = playerAt(scenarioGame, 2).play[0].card,
            discarded = playerAt(scenarioGame, 2).hand[0];
        expect(
            await (async () => {
                if (mode === 2) {
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
                                expect(request.ink[0].cards).toHaveLength(5);
                                return {
                                    type: "Decision",
                                    answer: {
                                        type: "Pay Cost",
                                        pay: true,
                                        payment: [
                                            { type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] },
                                        ],
                                    },
                                };
                            })
                            .on("Optional", (request) => {
                                return { type: "Decision", answer: { type: "Optional", accept: true } };
                            })
                            .on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Ink", amount: 2 }]);
                                expect(request.ink[0].player).toBe(1);
                                expect(request.ink[0].cards).toHaveLength(2);
                                return {
                                    type: "Decision",
                                    answer: {
                                        type: "Pay Cost",
                                        pay: true,
                                        payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1]] }],
                                    },
                                };
                            })
                            .on("Choose Mode", (request) => {
                                expect(request.options).toHaveLength(3);
                                return { type: "Decision", answer: { type: "Choose Mode", mode: 2 } };
                            })
                            .on("Choose Cards", (request) => {
                                expect(request.min).toBe(1);
                                expect(request.max).toBe(1);
                                return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                            }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (mode === 0) {
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
                                expect(request.ink[0].cards).toHaveLength(5);
                                return {
                                    type: "Decision",
                                    answer: {
                                        type: "Pay Cost",
                                        pay: true,
                                        payment: [
                                            { type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] },
                                        ],
                                    },
                                };
                            })
                            .on("Optional", (request) => {
                                return { type: "Decision", answer: { type: "Optional", accept: true } };
                            })
                            .on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Ink", amount: 2 }]);
                                expect(request.ink[0].player).toBe(1);
                                expect(request.ink[0].cards).toHaveLength(2);
                                return {
                                    type: "Decision",
                                    answer: {
                                        type: "Pay Cost",
                                        pay: true,
                                        payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1]] }],
                                    },
                                };
                            })
                            .on("Choose Mode", (request) => {
                                expect(request.options).toHaveLength(3);
                                return { type: "Decision", answer: { type: "Choose Mode", mode: 0 } };
                            }),
                        2: new ScriptedPlayer().on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (mode === 1) {
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
                                expect(request.ink[0].cards).toHaveLength(5);
                                return {
                                    type: "Decision",
                                    answer: {
                                        type: "Pay Cost",
                                        pay: true,
                                        payment: [
                                            { type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] },
                                        ],
                                    },
                                };
                            })
                            .on("Optional", (request) => {
                                return { type: "Decision", answer: { type: "Optional", accept: true } };
                            })
                            .on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Ink", amount: 2 }]);
                                expect(request.ink[0].player).toBe(1);
                                expect(request.ink[0].cards).toHaveLength(2);
                                return {
                                    type: "Decision",
                                    answer: {
                                        type: "Pay Cost",
                                        pay: true,
                                        payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1]] }],
                                    },
                                };
                            })
                            .on("Choose Mode", (request) => {
                                expect(request.options).toHaveLength(3);
                                return { type: "Decision", answer: { type: "Choose Mode", mode: 1 } };
                            })
                            .on("Choose Cards", (request) => {
                                expect(request.min).toBe(1);
                                expect(request.max).toBe(1);
                                return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                            }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).inkwell.filter((ink) => !ink.exerted)).toHaveLength(0);
        if (mode === 0) {
            expect(playerAt(scenarioGame, 2).discard).toContainEqual(discarded);
            expect(inPlay(scenarioRules(), target).card).toEqual(target);
        } else if (mode === 1) {
            expect(scenarioRules().characteristic(target, "Strength")).toBe(6);
            expect(inPlay(scenarioRules(), target).card).toEqual(target);
        } else expect(playerAt(scenarioGame, 2).discard).toContainEqual(target);
    });
    it("declines without paying the additional cost or choosing a mode", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 5 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
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
                            expect(request.ink[0].cards).toHaveLength(5);
                            return {
                                type: "Decision",
                                answer: {
                                    type: "Pay Cost",
                                    pay: true,
                                    payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] }],
                                },
                            };
                        })
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: false } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).inkwell.filter((ink) => !ink.exerted)).toHaveLength(2);
    });
});
