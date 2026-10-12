import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/when-you-play-this-character-you-may-return-an-action-card-f-7c8805cff6e6.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 7c8805cff6e6
const abilityText = "When you play this character, you may return an action card from your discard to your hand.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Lady Tremaine - Wicked Stepmother",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Discard Target 1",
                names: ["Discard Target"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 2,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 20 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const discardTargets = [...playerAt(scenarioGame, 1).discard];
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 6 }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(20);
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
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        for (const card of discardTargets) expect(playerAt(scenarioGame, 1).hand).toContainEqual(card);
    });
});
