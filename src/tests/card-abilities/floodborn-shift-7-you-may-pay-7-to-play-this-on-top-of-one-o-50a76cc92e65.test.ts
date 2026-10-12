import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/floodborn-shift-7-you-may-pay-7-to-play-this-on-top-of-one-o-50a76cc92e65.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 50a76cc92e65
const abilityText = "Floodborn Shift 7 ⬡ (You may pay 7 ⬡ to play this on top of one of your Floodborn characters.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Vine - Towering Stalk",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Floodborn Base",
                    names: ["Floodborn Base"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Floodborn"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 7 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const p = playerAt(scenarioGame, 1),
            shifter = playerAt(scenarioGame, 1).hand[0],
            base = playerAt(scenarioGame, 1).play[0];
        const result = await (async () => {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) =>
                    action.type === "Shift" &&
                    action.player === 1 &&
                    sameCard(action.card, shifter) &&
                    action.onto.length === 1 &&
                    sameCard(action.onto[0], base.card),
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Pay Cost", (request) => {
                    expect(request.optional).toBe(false);
                    expect(request.cost).toEqual([{ type: "Ink", amount: 7 }]);
                    expect(request.ink[0].player).toBe(1);
                    expect(request.ink[0].cards).toHaveLength(7);
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
                                        request.ink[0].cards[6],
                                    ],
                                },
                            ],
                        },
                    };
                }),
            });
            scenarioGame = finished(scenarioResolution);
            return true;
        })();
        expect(result).toBe(true);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(shifter);
        expect((inPlay(scenarioRules(), shifter).under ?? []).map((state) => state.card)).toContainEqual(base.card);
    });
});
