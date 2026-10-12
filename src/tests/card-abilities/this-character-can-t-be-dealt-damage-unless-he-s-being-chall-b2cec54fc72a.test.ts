import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-can-t-be-dealt-damage-unless-he-s-being-chall-b2cec54fc72a.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: b2cec54fc72a
const abilityText = "This character can't be dealt damage unless he's being challenged.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Hercules - Mighty Leader",
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
        expect(scenarioRules().restricted(source.card, "Can't Be Dealt Damage")).toBe(true);
    });
});
