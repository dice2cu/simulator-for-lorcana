import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/opponents-need-25-lore-to-win-the-game-929c4d0a8c91.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 929c4d0a8c91
const abilityText = "Opponents need 25 lore to win the game.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Donald Duck - Flustered Sorcerer",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const player = playerAt(scenarioGame, 1);
        expect(scenarioRules().victoryLore(1)).toBe(20);
        expect(scenarioRules().victoryLore(2)).toBe(25);
        playerAt(scenarioGame, 2).lore = 20;
        expect(playerAt(scenarioGame, 2).lore >= scenarioRules().victoryLore(2)).toBe(false);
        playerAt(scenarioGame, 2).lore = 25;
        expect(playerAt(scenarioGame, 2).lore >= scenarioRules().victoryLore(2)).toBe(true);
    });
});
