import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/potato-shift-5-you-may-pay-5-to-play-this-on-top-of-one-of-y-5674c2c7b660.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 5674c2c7b660
const abilityText = "Potato Shift 5 ⬡ (You may pay 5 ⬡ to play this on top of one of your items named Potato.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Posey - Vampire Potato",
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
                    fullName: "Potato",
                    names: ["Potato"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 5 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
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
                    expect(request.cost).toEqual([{ type: "Ink", amount: 5 }]);
                    expect(request.ink[0].player).toBe(1);
                    expect(request.ink[0].cards).toHaveLength(5);
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
