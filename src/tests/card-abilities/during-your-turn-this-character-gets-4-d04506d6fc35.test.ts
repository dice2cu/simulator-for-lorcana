import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/during-your-turn-this-character-gets-4-d04506d6fc35.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: d04506d6fc35
const abilityText = "During your turn, this character gets +4 ¤.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Pacha - Panicked Customer",
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
        const printedStrength =
            (() => {
                const definition = scenarioCards.definition(character.card.fullName);
                if (definition.type !== "Character") throw new Error("Expected a character");
                return definition.strength;
            })() ?? 0;
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 1 };
        expect(scenarioRules().characteristic(character.card, "Strength")).toBe(printedStrength + 4);
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        expect(scenarioRules().characteristic(character.card, "Strength")).toEqual(printedStrength);
    });
});
