import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-can-t-quest-unless-you-have-another-seven-dwa-8cb18f02ecbf.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 8cb18f02ecbf
const abilityText = "This character can't quest unless you have another Seven Dwarfs character in play.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Bashful - Hopeless Romantic",
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
        expect(scenarioRules().restricted(source.card, "Can't Quest")).toBe(true);
    });
});
