import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-has-no-damage-she-gets-1-14f5d35a220a.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 14f5d35a220a
const abilityText = "While this character has no damage, she gets +1 ◊.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Nani - No Worries",
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
                    fullName: "Nani - No Worries",
                    names: ["Nani"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Hero"],
                    cost: 2,
                    inkwell: true,
                    strength: 1,
                    willpower: 4,
                    lore: 1,
                }),
                damage: 0,
            },
        ]);
        const character = playerAt(scenarioGame, 1).play[0];
        const printedValue = scenarioRules().characteristic(character.card, "Lore", true) ?? 0;
        expect(scenarioRules().characteristic(character.card, "Lore")).toBe(printedValue + 1);
        inPlay(scenarioRules(), character.card).damage = 1;
        expect(scenarioRules().characteristic(character.card, "Lore")).toEqual(printedValue);
    });
});
