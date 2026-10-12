import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: b8ac3c185d9f
const abilityText = "When you shift this character, you may return all cards under it to your hand.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Omnidroid - Ultimate Iteration",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("returns the complete Shift stack only when accepted (%s)", async (accept) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                fullName: "Shift base",
                names: ["Omnidroid"],
                type: "Character",
                colors: ["Steel"],
                subtypes: ["Robot"],
                cost: 1,
                inkwell: true,
                strength: 1,
                willpower: 5,
                lore: 0,
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 6 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = playerAt(scenarioGame, 1).hand[0];
        const base = playerAt(scenarioGame, 1).play[0].card;
        inPlay(scenarioRules(), base).under = ["Dinglehopper"].map((card) => ({ card: scenarioCards.create(card), faceDown: true }));
        const tucked = playerAt(scenarioGame, 1).play[0].under?.[0];
        if (!tucked) throw new Error("Missing tucked fixture");
        expect(
            await (async () => {
                if (accept === true) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) =>
                            action.type === "Shift" &&
                            action.player === 1 &&
                            sameCard(action.card, source) &&
                            action.onto.length === 1 &&
                            sameCard(action.onto[0], base),
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer()
                            .on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Ink", amount: 6 }]);
                                expect(request.ink[0].player).toBe(1);
                                expect(request.ink[0].cards).toHaveLength(6);
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
                if (accept === false) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) =>
                            action.type === "Shift" &&
                            action.player === 1 &&
                            sameCard(action.card, source) &&
                            action.onto.length === 1 &&
                            sameCard(action.onto[0], base),
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer()
                            .on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Ink", amount: 6 }]);
                                expect(request.ink[0].player).toBe(1);
                                expect(request.ink[0].cards).toHaveLength(6);
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
                                return { type: "Decision", answer: { type: "Optional", accept: false } };
                            }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toEqual(accept ? [base, tucked.card] : []);
        expect(playerAt(scenarioGame, 1).play[0].under ?? []).toEqual(accept ? [] : [{ card: base, faceDown: false }, tucked]);
    });
});
