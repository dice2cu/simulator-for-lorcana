import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/draw-a-card-and-gain-1-lore-3b23f5cabba9.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 3b23f5cabba9
const abilityText = "Draw a card and gain 1 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Dumbo - Ninth Wonder of the Universe",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper"].reverse());
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 1 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) =>
                    action.player === 1 &&
                    ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source.card) && action.ability.i === 1) ||
                        (action.type === "Boost" && action.ability === 1 && sameCard(action.card, source.card))),
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Pay Cost", (request) => {
                    expect(request.optional).toBe(false);
                    expect(request.cost).toEqual([
                        { type: "Exert", cards: { cards: [scenarioCards.instance(1)] } },
                        { type: "Ink", amount: 1 },
                    ]);
                    expect(request.ink[0].player).toBe(1);
                    expect(request.ink[0].cards).toHaveLength(1);
                    return {
                        type: "Decision",
                        answer: {
                            type: "Pay Cost",
                            pay: true,
                            payment: [
                                { type: "Exert", player: 1, cards: [scenarioCards.instance(1)] },
                                { type: "Ink", player: 1, cards: [request.ink[0].cards[0]] },
                            ],
                        },
                    };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(1);
        expect(playerAt(scenarioGame, 1).lore).toBe(1);
    });
});
