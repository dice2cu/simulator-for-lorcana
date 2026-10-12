import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-also-counts-as-being-named-king-candy-for-shi-d6614f0ff788.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: d6614f0ff788
const abilityText = "This character also counts as being named King Candy for Shift.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Turbo - Royal Hack",
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
        expect(["King Candy"].every((name) => scenarioRules().names(source.card, true).includes(name))).toBe(true);
    });
});
