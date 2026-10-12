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
// Generated ability ID: eb66a2908f0c
const abilityText =
    "When you play this character, you may ready chosen character with Boost. If you do, they can't quest or challenge for the rest of this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Della Duck - Returning Mother",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("readies the chosen Boost character but prevents questing and challenging", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: {
                    fullName: "Boost Target",
                    names: ["Boost Target"],
                    type: "Character" as const,
                    colors: ["Amber" as const],
                    subtypes: [],
                    cost: 2,
                    inkwell: false,
                    strength: 1,
                    willpower: 8,
                    lore: 1,
                    abilities: [{ type: "Keyword" as const, keyword: { name: "Boost" as const, cost: [{ type: "Ink" as const, amount: 1 }] } }],
                },
                exerted: true,
                damage: 1,
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: scenarioCards.definition(prototypeCardName).cost }, () => ({
            card: scenarioCards.create("Dinglehopper"),
            exerted: false,
        }));
        const target = playerAt(scenarioGame, 1).play[0].card;
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
                            expect(request.cost).toEqual([{ type: "Ink", amount: 4 }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(4);
                            return {
                                type: "Decision",
                                answer: {
                                    type: "Pay Cost",
                                    pay: true,
                                    payment: [
                                        {
                                            type: "Ink",
                                            player: 1,
                                            cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2], request.ink[0].cards[3]],
                                        },
                                    ],
                                },
                            };
                        })
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        })
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(inPlay(scenarioRules(), target).exerted).toBe(false);
        expect(scenarioRules().restricted(target, "Can't Quest")).toBe(true);
        expect(scenarioRules().restricted(target, "Can't Challenge")).toBe(true);
    });
});
