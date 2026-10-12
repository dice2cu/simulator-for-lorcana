import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-has-no-damage-he-gets-3-34a4a71adbdc.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 34a4a71adbdc
const abilityText = "While this character has no damage, he gets +3 ¤.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Rat Capone - Rodent Gangster",
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
                    fullName: "Rat Capone - Rodent Gangster",
                    names: ["Rat Capone"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Villain"],
                    cost: 4,
                    inkwell: true,
                    strength: 2,
                    willpower: 5,
                    lore: 2,
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
        expect(scenarioRules().characteristic(character.card, "Strength")).toBe(printedValue + 3);
        inPlay(scenarioRules(), character.card).damage = 1;
        expect(scenarioRules().characteristic(character.card, "Strength")).toEqual(printedValue);
    });
});
