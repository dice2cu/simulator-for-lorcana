import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-can-t-ready-at-the-start-of-your-turn-0f850fe12b75.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 0f850fe12b75
const abilityText = "This character can't ready at the start of your turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Maui - Whale",
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
        expect(scenarioRules().restricted(source.card, "Can't Ready At Start Of Turn")).toBe(true);
    });
});
