import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import { InvalidInput } from "../../engine/invalid-input";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/during-your-turn-you-may-banish-chosen-item-of-yours-to-play-cff37a985307.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: cff37a985307
const abilityText = "During your turn, you may banish chosen item of yours to play this character for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Belle - Apprentice Inventor",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("cannot be played without ink or an item to sacrifice", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        const belle = playerAt(scenarioGame, 1).hand[0];
        expect(scenarioRules().cost(belle)).toBe(3);
        expect(
            (scenarioGame.turn.player !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).some(
                (action) => action.type === "Play" && sameCard(action.card, belle),
            ),
        ).toBe(false);
        expect(
            await (async () => {
                const action: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && sameCard(action.card, belle),
                );
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
            })(),
        ).toBe(false);
        expect(playerAt(scenarioGame, 1).hand).toContainEqual(belle);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).not.toContainEqual(belle);
    });
    it("pays the sacrifice through normal play without discounting other cards", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName, "Hades - Infernal Schemer"]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            { fullName: "Payment Item", names: ["Payment Item"], type: "Item", colors: ["Amber"], subtypes: [], cost: 0, inkwell: false },
        ]);
        const [belle, hades] = playerAt(scenarioGame, 1).hand;
        const item = playerAt(scenarioGame, 1).play[0].card;
        expect(
            (scenarioGame.turn.player !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).some(
                (action) => action.type === "Play" && sameCard(action.card, belle),
            ),
        ).toBe(true);
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && sameCard(action.card, belle),
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([
                            {
                                type: "Choose Cards",
                                from: { cards: [scenarioCards.instance(3)] },
                                count: 1,
                                cost: [{ type: "Banish", cards: "Selected Cards" }],
                            },
                        ]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(0);
                        return {
                            type: "Decision",
                            answer: { type: "Pay Cost", pay: true, payment: [{ type: "Banish", player: 1, cards: [scenarioCards.instance(3)] }] },
                        };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).discard).toContainEqual(item);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(belle);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).not.toContainEqual(item);
        expect(scenarioRules().cost(hades)).toBe(7);
        expect(
            await (async () => {
                const action: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && sameCard(action.card, hades),
                );
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
            })(),
        ).toBe(false);
        expect(playerAt(scenarioGame, 1).hand).toContainEqual(hades);
    });
    it("can pay ink instead when the sacrifice is declined", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            { fullName: "Payment Item", names: ["Payment Item"], type: "Item", colors: ["Amber"], subtypes: [], cost: 0, inkwell: false },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const belle = playerAt(scenarioGame, 1).hand[0];
        const item = playerAt(scenarioGame, 1).play[0].card;
        // The normal Play intention deliberately does not select the alternate cost.
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Play", player: 1, card: belle };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
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
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(belle);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(item);
        expect(playerAt(scenarioGame, 1).inkwell.filter((card) => !card.exerted)).toHaveLength(0);
    });
    it("does not play for free when the sacrifice is declined without enough ink", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            { fullName: "Payment Item", names: ["Payment Item"], type: "Item", colors: ["Amber"], subtypes: [], cost: 0, inkwell: false },
        ]);
        const belle = playerAt(scenarioGame, 1).hand[0];
        const item = playerAt(scenarioGame, 1).play[0].card;
        expect(
            await (async () => {
                const action: PlayerAction | undefined = { type: "Play", player: 1, card: belle };
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
            })(),
        ).toBe(false);
        expect(playerAt(scenarioGame, 1).hand).toContainEqual(belle);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(item);
        expect(playerAt(scenarioGame, 1).discard).toHaveLength(0);
    });
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            { fullName: "Payment Item", names: ["Payment Item"], type: "Item", colors: ["Amber"], subtypes: [], cost: 0, inkwell: false },
        ]);
        const belle = playerAt(scenarioGame, 1).hand[0];
        const item = playerAt(scenarioGame, 1).play[0].card;
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && sameCard(action.card, belle),
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([
                            {
                                type: "Choose Cards",
                                from: { cards: [scenarioCards.instance(2)] },
                                count: 1,
                                cost: [{ type: "Banish", cards: "Selected Cards" }],
                            },
                        ]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(0);
                        return {
                            type: "Decision",
                            answer: { type: "Pay Cost", pay: true, payment: [{ type: "Banish", player: 1, cards: [scenarioCards.instance(2)] }] },
                        };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).discard).toContainEqual(item);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(belle);
    });
});
