import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/at-the-start-of-your-turn-put-the-top-card-of-your-deck-into-e87c8d137135.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: e87c8d137135
const abilityText = "At the start of your turn, put the top card of your deck into your discard.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Remote Inklands - Desert Ruins",
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
        const player = playerAt(scenarioGame, 1);
        const topCard = [...playerAt(scenarioGame, 1).deck].reverse()[[...playerAt(scenarioGame, 1).deck].reverse().length - 1];
        if (!topCard) throw new Error("Top card was not created.");
        {
            scenarioLive = engine.startTurn(scenarioGame, { card: scenarioCards.lookup });
            scenarioResolution = scenarioLive;
            resolvePlayers(
                scenarioResolution,
                {},
                {
                    untilAction: true,
                },
            );
            scenarioGame = finished(scenarioResolution, true);
            if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
        }
        expect(playerAt(scenarioGame, 1).discard).toContainEqual(topCard);
    });
});
