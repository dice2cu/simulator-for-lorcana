import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { Decision, PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: 6e650d25aee8
const abilityText =
    "Shuffle chosen card from your discard into your deck. Reveal the top card of your deck. If it has the same name as the chosen card, you may play the revealed card for free. Otherwise, put it into your hand.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "We Know the Way",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("plays a matching reveal only when accepted, otherwise leaves it on top (%s)", async (accept) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioDecisions: Decision[] = [];
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, ["Hercules - Divine Hero"]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Pawpsicle", "Pawpsicle"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = playerAt(scenarioGame, 1).hand[0],
            recycled = playerAt(scenarioGame, 1).discard[0],
            deck = [...playerAt(scenarioGame, 1).deck];
        expect(
            await (async () => {
                if (accept === true) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(
                        scenarioResolution,
                        {
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
                                            payment: [
                                                { type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] },
                                            ],
                                        },
                                    };
                                })
                                .on("Choose Cards", (request) => {
                                    expect(request.min).toBe(1);
                                    expect(request.max).toBe(1);
                                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                                })
                                .on("Optional", (request) => {
                                    return { type: "Decision", answer: { type: "Optional", accept: true } };
                                }),
                        },
                        {
                            random: [{ type: "Shuffle", cards: [scenarioCards.instance(2), scenarioCards.instance(3), scenarioCards.instance(4)] }],
                            decisions: scenarioDecisions,
                        },
                    );
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (accept === false) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(
                        scenarioResolution,
                        {
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
                                            payment: [
                                                { type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] },
                                            ],
                                        },
                                    };
                                })
                                .on("Choose Cards", (request) => {
                                    expect(request.min).toBe(1);
                                    expect(request.max).toBe(1);
                                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                                })
                                .on("Optional", (request) => {
                                    return { type: "Decision", answer: { type: "Optional", accept: false } };
                                }),
                        },
                        {
                            random: [{ type: "Shuffle", cards: [scenarioCards.instance(2), scenarioCards.instance(3), scenarioCards.instance(4)] }],
                            decisions: scenarioDecisions,
                        },
                    );
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(true);
        expect(scenarioRules().locate(recycled)?.zone).toBe(accept ? "Play" : "Deck");
        expect(playerAt(scenarioGame, 1).hand).toEqual([]);
        expect(playerAt(scenarioGame, 1).deck).toEqual(accept ? deck : [recycled, ...deck]);
        expect(playerAt(scenarioGame, 1).discard).toEqual([source]);
        expect(playerAt(scenarioGame, 1).inkwell.every((ink) => ink.exerted)).toBe(true);
        expect(scenarioResolution?.observations ?? []).toContainEqual({ type: "Reveal", cards: [recycled] });
    });
    it("shuffles before revealing and returns the nonmatching top card to hand", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioDecisions: Decision[] = [];
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, ["Hercules - Divine Hero"]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Pawpsicle", "Pawpsicle"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = playerAt(scenarioGame, 1).hand[0],
            recycled = playerAt(scenarioGame, 1).discard[0],
            [top, bottom] = playerAt(scenarioGame, 1).deck;
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(
                    scenarioResolution,
                    {
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
                                        payment: [
                                            { type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] },
                                        ],
                                    },
                                };
                            })
                            .on("Choose Cards", (request) => {
                                expect(request.min).toBe(1);
                                expect(request.max).toBe(1);
                                return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                            }),
                    },
                    {
                        random: [{ type: "Shuffle", cards: [scenarioCards.instance(3), scenarioCards.instance(4), scenarioCards.instance(2)] }],
                        decisions: scenarioDecisions,
                    },
                );
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toEqual([top]);
        expect(playerAt(scenarioGame, 1).deck).toEqual([bottom, recycled]);
        expect(playerAt(scenarioGame, 1).discard).toEqual([source]);
        expect(scenarioResolution?.observations ?? []).toContainEqual({ type: "Reveal", cards: [top] });
    });
    it("never offers the resolving action when the discard starts empty", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioDecisions: Decision[] = [];
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Pawpsicle", "Pawpsicle"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = playerAt(scenarioGame, 1).hand[0],
            deck = [...playerAt(scenarioGame, 1).deck];
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer().on("Pay Cost", (request) => {
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
                        }),
                    },
                    {
                        decisions: scenarioDecisions,
                    },
                );
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(scenarioDecisions.some((decision) => decision.type === "Choose Cards" || decision.type === "Optional")).toBe(false);
        // No eligible discard card does not cancel the later reveal. Do as much as possible.
        expect(playerAt(scenarioGame, 1).hand).toEqual([deck[0]]);
        expect(playerAt(scenarioGame, 1).deck).toEqual(deck.slice(1));
        expect(playerAt(scenarioGame, 1).discard).toEqual([source]);
    });
});
