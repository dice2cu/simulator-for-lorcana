import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: b5e3a1a8ec16
const abilityText = "Whenever you play a character, if you used Shift to play them, they get +4 ¤ this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Chem Purse",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("grants strength only to a character actually played using Shift (%s)", async (shifted) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                fullName: "Base",
                names: ["Shifter"],
                type: "Character",
                colors: [],
                subtypes: [],
                cost: 0,
                inkwell: false,
                strength: 1,
                willpower: 5,
                lore: 0,
            },
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            {
                fullName: "Shifter",
                names: ["Shifter"],
                type: "Character",
                colors: [],
                subtypes: [],
                cost: 2,
                inkwell: false,
                strength: 2,
                willpower: 5,
                lore: 0,
                abilities: [{ type: "Keyword", keyword: { name: "Shift", cost: [{ type: "Ink", amount: 1 }] } }],
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 2 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const base = playerAt(scenarioGame, 1).play[1].card,
            target = playerAt(scenarioGame, 1).hand[0];
        if (shifted)
            expect(
                await (async () => {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) =>
                            action.type === "Shift" &&
                            action.player === 1 &&
                            sameCard(action.card, target) &&
                            action.onto.length === 1 &&
                            sameCard(action.onto[0], base),
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer().on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Ink", amount: 1 }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(2);
                            return {
                                type: "Decision",
                                answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0]] }] },
                            };
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
                        (action) => action.type === "Play" && action.player === 1 && action.card.fullName === target.fullName,
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer().on("Pay Cost", (request) => {
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
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                })(),
            ).toBe(true);
        expect(scenarioRules().characteristic(target, "Strength")).toBe(shifted ? 6 : 2);
    });
});
