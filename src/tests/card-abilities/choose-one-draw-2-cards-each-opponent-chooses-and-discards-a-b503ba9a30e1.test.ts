import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/choose-one-draw-2-cards-each-opponent-chooses-and-discards-a-b503ba9a30e1.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: b503ba9a30e1
const abilityText = "Choose one: • Draw 2 cards. • Each opponent chooses and discards a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Pull the Lever!",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Mickey Mouse - True Friend", "Donald Duck - Boisterous Fowl"].reverse());
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, ["Dinglehopper"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const action = playerAt(scenarioGame, 1).hand.find((card) => card.fullName === prototypeCardName);
        if (!action) throw new Error(`Card not found in hand: ${prototypeCardName}`);
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (candidate) => candidate.type === "Play" && candidate.player === 1 && candidate.card.fullName === action.fullName,
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 3 }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(3);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] }],
                            },
                        };
                    })
                    .on("Choose Mode", (request) => {
                        expect(request.options).toHaveLength(2);
                        return { type: "Decision", answer: { type: "Choose Mode", mode: 0 } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(2);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toHaveLength(0);
        expect(playerAt(scenarioGame, 2).hand).toHaveLength(1);
    });
});
