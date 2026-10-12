import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/while-you-have-an-exerted-character-here-your-other-location-3d6deb2bdfc6.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 3d6deb2bdfc6
const abilityText = "While you have an exerted character here, your other locations can't be challenged.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Wall - Border Fortress",
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
                    fullName: "Exerted Visitor",
                    names: ["Exerted Visitor"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !false,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Other Location",
                    names: ["Other Location"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 8,
                    lore: 0,
                    moveCost: 0,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            visitor = playerAt(scenarioGame, 1).play[1],
            otherLocation = playerAt(scenarioGame, 1).play[2];
        visitor.location = source.card;
        expect(scenarioRules().restricted(otherLocation.card, "Can't Be Challenged")).toBe(true);
        expect(scenarioRules().restricted(source.card, "Can't Be Challenged")).toBe(false);
        visitor.exerted = !true;
        expect(scenarioRules().restricted(otherLocation.card, "Can't Be Challenged")).toBe(false);
    });
});
