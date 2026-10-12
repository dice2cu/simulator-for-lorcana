import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-has-no-damage-he-gets-2-1267848101ba.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 1267848101ba
const abilityText = "While this character has no damage, he gets +2 ◊.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Chi-Fu - Imperial Advisor",
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
                    fullName: "Chi-Fu - Imperial Advisor",
                    names: ["Chi-Fu"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Ally"],
                    cost: 3,
                    inkwell: true,
                    strength: 0,
                    willpower: 5,
                    lore: 1,
                }),
                damage: 0,
            },
        ]);
        const character = playerAt(scenarioGame, 1).play[0];
        const printedValue = scenarioRules().characteristic(character.card, "Lore", true) ?? 0;
        expect(scenarioRules().characteristic(character.card, "Lore")).toBe(printedValue + 2);
        inPlay(scenarioRules(), character.card).damage = 1;
        expect(scenarioRules().characteristic(character.card, "Lore")).toEqual(printedValue);
    });
});
