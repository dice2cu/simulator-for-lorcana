import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/at-the-start-of-your-turn-each-player-may-draw-a-card-3c0fd3ab20f6.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 3c0fd3ab20f6
const abilityText = "At the start of your turn, each player may draw a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Donald Duck - Perfect Gentleman",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, [prototypeCardName, prototypeCardName].reverse());
        playerAt(scenarioGame, 2).deck = cardIds(scenarioCards, [prototypeCardName].reverse());
        const player = playerAt(scenarioGame, 1);
        // Not the first turn, so player 1 also draws for the turn
        scenarioGame.turn = { number: 2, player: 1 };
        {
            scenarioLive = engine.startTurn(scenarioGame, { card: scenarioCards.lookup });
            scenarioResolution = scenarioLive;
            resolvePlayers(
                scenarioResolution,
                {
                    1: new ScriptedPlayer().on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    }),
                    2: new ScriptedPlayer().on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    }),
                },
                {
                    untilAction: true,
                },
            );
            scenarioGame = finished(scenarioResolution, true);
            if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
        }
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(2);
        expect(playerAt(scenarioGame, 2).hand).toHaveLength(1);
    });
});
