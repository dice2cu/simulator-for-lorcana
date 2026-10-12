import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: eda5a56c855e
const abilityText =
    "Whenever a character of yours is challenged while this character is exerted, the challenging character gets -3 ¤ this turn unless their player pays 3 ⬡.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Tiana - Restaurant Owner",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("reduces the attacker unless its player pays three ink (%s)", async (pay) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            { definition: prototypeCardName, exerted: true },
            {
                definition: {
                    fullName: "Victim",
                    names: ["Victim"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                },
                exerted: true,
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                ...{
                    fullName: "Victim",
                    names: ["Victim"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                },
                strength: 5,
            },
        ]);
        playerAt(scenarioGame, 2).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const defender = playerAt(scenarioGame, 1).play[1].card,
            attacker = playerAt(scenarioGame, 2).play[0].card;
        expect(
            await (async () => {
                if (pay === true) {
                    const action0: PlayerAction | undefined = { type: "Challenge", player: 2, attacker, defender };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        2: new ScriptedPlayer()
                            .on("Optional", (request) => {
                                return { type: "Decision", answer: { type: "Optional", accept: true } };
                            })
                            .on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Ink", amount: 3 }]);
                                expect(request.ink[0].player).toBe(2);
                                expect(request.ink[0].cards).toHaveLength(3);
                                return {
                                    type: "Decision",
                                    answer: {
                                        type: "Pay Cost",
                                        pay: true,
                                        payment: [
                                            { type: "Ink", player: 2, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] },
                                        ],
                                    },
                                };
                            }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (pay === false) {
                    const action0: PlayerAction | undefined = { type: "Challenge", player: 2, attacker, defender };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        2: new ScriptedPlayer().on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: false } };
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(true);
        expect(scenarioRules().characteristic(attacker, "Strength")).toBe(pay ? 5 : 2);
        expect(inPlay(scenarioRules(), defender).damage).toBe(pay ? 5 : 2);
        expect(playerAt(scenarioGame, 2).inkwell.filter((ink) => ink.exerted)).toHaveLength(pay ? 3 : 0);
    });
});
