import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-counts-as-being-named-both-chip-and-dale-5a6942d98a2e.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 5a6942d98a2e
const abilityText = "This character counts as being named both Chip and Dale.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Chip 'n' Dale - Recovery Rangers",
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
        expect(["Chip", "Dale"].every((name) => scenarioRules().names(source.card).includes(name))).toBe(true);
    });
});
