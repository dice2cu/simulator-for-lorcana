import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-gets-1-for-each-other-hyena-character-you-hav-f919dda34404.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: f919dda34404
const abilityText = "This character gets +1 ¤ for each other Hyena character you have in play.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Shenzi - Head Hyena",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName, prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Matching One",
                    names: ["Matching"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Hyena"],
                    cost: 0,
                    inkwell: false,
                    strength: 2,
                    willpower: 4,
                    lore: 1,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Matching Two",
                    names: ["Matching"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Hyena"],
                    cost: 0,
                    inkwell: false,
                    strength: 2,
                    willpower: 4,
                    lore: 1,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const printed =
            (() => {
                const definition = scenarioCards.definition(source.card.fullName);
                if (definition.type !== "Character") throw new Error("Expected a character");
                return definition.strength;
            })() ?? 0;
        expect(scenarioRules().characteristic(source.card, "Strength")).toBe(printed + 2);
    });
});
