import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/each-opponent-chooses-and-discards-2-cards-74287a1373e0.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 74287a1373e0
const abilityText = "Each opponent chooses and discards 2 cards.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "You Have Forgotten Me",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, ["Dinglehopper", "Magic Mirror", "Dragon Fire"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 4 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const discarded = playerAt(scenarioGame, 2).hand.slice(0, 2);
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Pay Cost", (request) => {
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
                }),
                2: new ScriptedPlayer().on("Choose Cards", (request) => {
                    expect(request.min).toBe(2);
                    expect(request.max).toBe(2);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2), scenarioCards.instance(3)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 2).hand).toHaveLength(1);
        expect(playerAt(scenarioGame, 2).discard).toEqual(expect.arrayContaining(discarded));
    });
});
