import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/your-ally-characters-get-1-0659a8148039.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 0659a8148039
const abilityText = "Your Ally characters get +1 ¤.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Scar - Finally King",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Matching",
                    names: ["Matching"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Ally"],
                    cost: 0,
                    inkwell: false,
                    strength: 3,
                    willpower: 4,
                    lore: 1,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Nonmatching",
                    names: ["Nonmatching"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 3,
                    willpower: 4,
                    lore: 1,
                }),
            },
        ]);
        const [, matching, nonmatching] = playerAt(scenarioGame, 1).play;
        expect(scenarioRules().characteristic(matching.card, "Strength")).toBe(4);
        expect(scenarioRules().characteristic(nonmatching.card, "Strength")).toBe(3);
    });
});
