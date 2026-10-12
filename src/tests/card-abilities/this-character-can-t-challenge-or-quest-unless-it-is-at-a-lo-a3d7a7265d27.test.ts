import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-can-t-challenge-or-quest-unless-it-is-at-a-lo-a3d7a7265d27.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: a3d7a7265d27
const abilityText = "This character can't challenge or quest unless it is at a location.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Treasure Guardian - Protector of the Cave",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const source = playerAt(scenarioGame, 1).play[0];
        expect(scenarioRules().restricted(source.card, "Can't Challenge")).toBe(true);
        expect(scenarioRules().restricted(source.card, "Can't Quest")).toBe(true);
    });
});
