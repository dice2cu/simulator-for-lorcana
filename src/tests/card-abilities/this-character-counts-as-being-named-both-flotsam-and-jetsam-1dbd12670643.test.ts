import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-counts-as-being-named-both-flotsam-and-jetsam-1dbd12670643.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 1dbd12670643
const abilityText = "This character counts as being named both Flotsam and Jetsam.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Flotsam & Jetsam - Entangling Eels",
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
        expect(["Flotsam", "Jetsam"].every((name) => scenarioRules().names(source.card).includes(name))).toBe(true);
    });
});
