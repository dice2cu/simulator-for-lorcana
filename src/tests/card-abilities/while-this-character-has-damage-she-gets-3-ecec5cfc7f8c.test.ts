import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-has-damage-she-gets-3-ecec5cfc7f8c.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: ecec5cfc7f8c
const abilityText = "While this character has damage, she gets +3 ¤.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Queen of Hearts - Losing Her Temper",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Queen of Hearts - Losing Her Temper",
                    names: ["Queen of Hearts"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Villain", "Queen"],
                    cost: 2,
                    inkwell: true,
                    strength: 1,
                    willpower: 4,
                    lore: 1,
                }),
                damage: 1,
            },
        ]);
        const character = playerAt(scenarioGame, 1).play[0];
        const printedValue =
            (() => {
                const definition = scenarioCards.definition(character.card.fullName);
                if (definition.type !== "Character") throw new Error("Expected a character");
                return definition.strength;
            })() ?? 0;
        expect(scenarioRules().characteristic(character.card, "Strength")).toBe(printedValue + 3);
        inPlay(scenarioRules(), character.card).damage = 0;
        expect(scenarioRules().characteristic(character.card, "Strength")).toEqual(printedValue);
    });
});
