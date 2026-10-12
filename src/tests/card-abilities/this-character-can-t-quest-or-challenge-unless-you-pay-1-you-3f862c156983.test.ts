import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/this-character-can-t-quest-or-challenge-unless-you-pay-1-you-3f862c156983.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 3f862c156983
const abilityText = "This character can't quest or challenge unless you pay 1 ⬡. (You pay this cost each time.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "RC - Remote-Controlled Car",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const source = playerAt(scenarioGame, 1).play[0];
        expect(
            (scenarioGame.turn.player !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).some(
                (action) => action.type === "Challenge",
            ),
        ).toBe(false);
        expect(
            (scenarioGame.turn.player !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).some(
                (action) => action.type === "Quest",
            ),
        ).toBe(false);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 1 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        expect(
            (scenarioGame.turn.player !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).some(
                (action) => action.type === "Quest",
            ),
        ).toBe(true);
    });
});
