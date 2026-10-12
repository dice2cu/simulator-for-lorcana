import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-also-counts-as-being-named-syndrome-for-shift-8a9ee9a4f946.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 8a9ee9a4f946
const abilityText = "This character also counts as being named Syndrome for Shift.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Incrediboy - Buddy Pine",
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
        expect(["Syndrome"].every((name) => scenarioRules().names(source.card, true).includes(name))).toBe(true);
    });
});
