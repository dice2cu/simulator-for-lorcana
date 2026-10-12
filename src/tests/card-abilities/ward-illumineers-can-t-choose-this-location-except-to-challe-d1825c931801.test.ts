import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/ward-illumineers-can-t-choose-this-location-except-to-challe-d1825c931801.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: d1825c931801
const abilityText = "Ward (Illumineers can't choose this location except to challenge.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Crystal Gate - Unbreakable Boundary",
    "Clockwork Sawblades - Treacherous Trap",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "Dinglehopper"]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, ["Rise of the Titans"]);
        playerAt(scenarioGame, 2).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        const player = playerAt(scenarioGame, 1);
        const wardLocation = playerAt(scenarioGame, 1).play[0];
        const ordinaryItem = playerAt(scenarioGame, 1).play[1];
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) => action.type === "Play" && action.player === 2 && action.card.fullName === "Rise of the Titans",
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                2: new ScriptedPlayer()
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
                                payment: [{ type: "Ink", player: 2, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] }],
                            },
                        };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(wardLocation.card);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).not.toContainEqual(ordinaryItem.card);
    });
});
