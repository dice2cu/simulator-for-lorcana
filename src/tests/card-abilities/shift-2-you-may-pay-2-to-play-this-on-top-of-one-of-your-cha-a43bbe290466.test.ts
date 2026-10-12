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
// Generated ability ID: a43bbe290466
const abilityText = "Shift 2 (You may pay 2 ⬡ to play this on top of one of your characters named Madam Mim.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Madam Mim - Rhino",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("pays Shift 2, preserves the exerted base and returns the chosen friend", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const printed = scenarioCards.definition(prototypeCardName);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: {
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
                exerted: true,
            },
            "HeiHei - Boat Snack",
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 2 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = playerAt(scenarioGame, 1).hand[0];
        const onto = playerAt(scenarioGame, 1).play[0].card;
        const friend = playerAt(scenarioGame, 1).play[1].card;
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
                            expect(request.options).toHaveLength(2);
                            return { type: "Decision", answer: { type: "Choose Mode", mode: 1 } };
                        })
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toEqual([friend]);
        const state = playerAt(scenarioGame, 1).play.find((state) => state.card.i === source.i);
        if (!state) throw new Error("Shifted character is missing");
        expect(state.exerted).toBe(true);
        expect(state.under).toContainEqual({ card: onto, faceDown: false });
        expect(playerAt(scenarioGame, 1).play).toHaveLength(1);
        expect(playerAt(scenarioGame, 1).inkwell.every((ink) => ink.exerted)).toBe(true);
    });
});
