import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-has-damage-he-gets-3-3073f898fc02.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 3073f898fc02
const abilityText = "While this character has damage, he gets +3 ¤.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Scroop - Backstabber",
    "The Bear - Territorial Animal",
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
                    fullName: "Scroop - Backstabber",
                    names: ["Scroop"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Villain", "Alien", "Pirate"],
                    cost: 5,
                    inkwell: true,
                    strength: 2,
                    willpower: 5,
                    lore: 2,
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
