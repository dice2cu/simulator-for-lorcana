import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-an-opposing-character-quests-you-gain-1-lore-unless-3f3873ac76e4.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 3f3873ac76e4
const abilityText = "Whenever an opposing character quests, you gain 1 lore unless their player pays 1 ⬡.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Source of the Vine",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["Mickey Mouse - True Friend"]);
        const target = playerAt(scenarioGame, 2).play[0];
        {
            const action0: PlayerAction | undefined = { type: "Quest", player: 2, card: target.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                2: new ScriptedPlayer().on("Optional", (request) => {
                    return { type: "Decision", answer: { type: "Optional", accept: false } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).lore).toBe(1);
    });
});
