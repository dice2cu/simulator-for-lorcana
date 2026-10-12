import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/your-other-characters-get-1-9515449674a6.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 9515449674a6
const abilityText = "Your other characters get +1 ¤.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Lumiere - Fiery Friend",
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
                    fullName: "Target",
                    names: ["Target"],
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
        const [source, target] = playerAt(scenarioGame, 1).play;
        const sourceStrength = (() => {
            const definition = scenarioCards.definition(source.card.fullName);
            if (definition.type !== "Character") throw new Error("Expected a character");
            return definition.strength;
        })();
        expect(scenarioRules().characteristic(target.card, "Strength")).toBe(4);
        expect(scenarioRules().characteristic(source.card, "Strength")).toEqual(sourceStrength);
    });
});
