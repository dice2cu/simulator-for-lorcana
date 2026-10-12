import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, classifications } from "../player/fixtures";
// Converted from reference/card-abilities/all-opposing-characters-gain-the-villain-classification-c04bf9257644.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: c04bf9257644
const abilityText = "All opposing characters gain the Villain classification.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Thunderquack",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Opponent",
                    names: ["Opponent"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Hero"],
                    cost: 2,
                    inkwell: false,
                    strength: 4,
                    willpower: 10,
                    lore: 1,
                }),
            },
        ]);
        const opposingCharacter = playerAt(scenarioGame, 2).play[0];
        expect(classifications(scenarioRules(), opposingCharacter.card)).toContainEqual("Villain");
    });
});
