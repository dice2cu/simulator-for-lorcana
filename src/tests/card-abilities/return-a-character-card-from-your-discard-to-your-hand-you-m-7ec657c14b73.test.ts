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
// Generated ability ID: 7ec657c14b73
const abilityText = "Return a character card from your discard to your hand. You may remove up to 2 damage from chosen character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Bruno's Return",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("returns the exact discarded character and removes two damage from the chosen character", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: {
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
                damage: 3,
            },
        ]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, ["HeiHei - Boat Snack"]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 2 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const returned = playerAt(scenarioGame, 1).discard[0],
            target = playerAt(scenarioGame, 1).play[0].card;
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
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                        })
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(1)] } };
                        })
                        .on("Choose Amount", (request) => {
                            expect(request.min).toBe(0);
                            expect(request.max).toBe(2);
                            return { type: "Decision", answer: { type: "Choose Amount", amount: 2 } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toEqual([returned]);
        expect(inPlay(scenarioRules(), target).damage).toBe(1);
    });
});
