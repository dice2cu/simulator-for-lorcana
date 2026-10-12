import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/you-pay-1-less-to-move-your-characters-to-a-location-7a1b24b4781b.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 7a1b24b4781b
const abilityText = "You pay 1 ⬡ less to move your characters to a location.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Map of Treasure Planet",
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
                    fullName: "Mover",
                    names: ["Mover"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Location",
                    names: ["Location"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 1,
                    lore: 0,
                    moveCost: 3,
                }),
            },
        ]);
        const p = playerAt(scenarioGame, 1),
            character = playerAt(scenarioGame, 1).play[1],
            location = playerAt(scenarioGame, 1).play[2];
        expect(scenarioRules().moveCost(character.card, location.card, true)).toBe(2);
    });
});
