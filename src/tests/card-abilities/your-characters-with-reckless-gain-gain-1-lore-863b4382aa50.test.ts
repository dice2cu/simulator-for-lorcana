import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/your-characters-with-reckless-gain-gain-1-lore-863b4382aa50.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 863b4382aa50
const abilityText = "Your characters with Reckless gain “⟳ — Gain 1 lore.”";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Cogsworth - Talking Clock",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "Gaston - Arrogant Hunter"]);
        const recipient = playerAt(scenarioGame, 1).play[1];
        const before = playerAt(scenarioGame, 1).lore;
        const ability = (scenarioGame.turn.player !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).find(
            (action) => action.type === "Activate" && "card" in action && action.card.i === recipient.card.i,
        );
        if (!ability) throw new Error("Missing Reckless granted ability");
        {
            const action0: PlayerAction | undefined = ability;
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Pay Cost", (request) => {
                    expect(request.optional).toBe(false);
                    expect(request.cost).toEqual([{ type: "Exert", cards: { cards: [scenarioCards.instance(2)] } }]);
                    expect(request.ink[0].player).toBe(1);
                    expect(request.ink[0].cards).toHaveLength(0);
                    return {
                        type: "Decision",
                        answer: { type: "Pay Cost", pay: true, payment: [{ type: "Exert", player: 1, cards: [scenarioCards.instance(2)] }] },
                    };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).lore).toBe(before + 1);
    });
});
