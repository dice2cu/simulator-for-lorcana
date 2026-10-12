import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/during-your-turn-this-character-gains-evasive-1dc3b61bdd50.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 1dc3b61bdd50
const abilityText = "During your turn, this character gains Evasive.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Jasmine - Fearless Princess",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const character = playerAt(scenarioGame, 1).play[0];
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 1 };
        expect(cardKeywords(scenarioRules(), character.card)).toContainEqual("Evasive");
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        expect(cardKeywords(scenarioRules(), character.card)).not.toContainEqual("Evasive");
    });
});
