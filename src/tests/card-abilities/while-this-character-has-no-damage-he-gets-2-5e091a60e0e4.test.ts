import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-has-no-damage-he-gets-2-5e091a60e0e4.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 5e091a60e0e4
const abilityText = "While this character has no damage, he gets +2 ¤.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Razoul - Palace Guard",
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
                    fullName: "Razoul - Palace Guard",
                    names: ["Razoul"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Ally", "Captain"],
                    cost: 2,
                    inkwell: true,
                    strength: 1,
                    willpower: 3,
                    lore: 1,
                }),
                damage: 0,
            },
        ]);
        const character = playerAt(scenarioGame, 1).play[0];
        const printedValue =
            (() => {
                const definition = scenarioCards.definition(character.card.fullName);
                if (definition.type !== "Character") throw new Error("Expected a character");
                return definition.strength;
            })() ?? 0;
        expect(scenarioRules().characteristic(character.card, "Strength")).toBe(printedValue + 2);
        inPlay(scenarioRules(), character.card).damage = 1;
        expect(scenarioRules().characteristic(character.card, "Strength")).toEqual(printedValue);
    });
});
