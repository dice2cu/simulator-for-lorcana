import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/each-player-plays-with-the-top-card-of-their-deck-face-up-3a291c7d2f35.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 3a291c7d2f35
const abilityText = "Each player plays with the top card of their deck face up.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Merlin's Cottage - The Wizard's Home",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("reveals every player’s top card, including your own", () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        scenarioGame.players[3] = emptyPlayer();
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper", "Magic Mirror"]);
        playerAt(scenarioGame, 2).deck = cardIds(scenarioCards, ["Pawpsicle", "Dinglehopper"]);
        playerAt(scenarioGame, 3).deck = cardIds(scenarioCards, ["Magic Mirror", "Pawpsicle"]);
        expect(scenarioRules().revealedCards()).toEqual([
            playerAt(scenarioGame, 1).deck[0],
            playerAt(scenarioGame, 2).deck[0],
            playerAt(scenarioGame, 3).deck[0],
        ]);
    });
});
