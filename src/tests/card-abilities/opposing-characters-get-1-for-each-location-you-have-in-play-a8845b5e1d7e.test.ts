import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/opposing-characters-get-1-for-each-location-you-have-in-play-a8845b5e1d7e.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: a8845b5e1d7e
const abilityText = "Opposing characters get -1 ¤ for each location you have in play.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Triton - Champion of Atlantica",
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
                    fullName: "Location One",
                    names: ["Location One"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 1,
                    lore: 0,
                    moveCost: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Location Two",
                    names: ["Location Two"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 1,
                    lore: 0,
                    moveCost: 0,
                }),
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 5,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        const target = playerAt(scenarioGame, 2).play[0];
        expect(scenarioRules().characteristic(target.card, "Strength")).toBe(3);
    });
});
