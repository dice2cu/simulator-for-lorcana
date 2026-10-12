import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/robot-characters-get-1-and-1-while-here-8c10c38b9f92.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 8c10c38b9f92
const abilityText = "Robot characters get +1 ¤ and +1 ⛉ while here.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Island of Nomanisan - Syndrome's Headquarters",
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
                    subtypes: ["Robot"],
                    cost: 0,
                    inkwell: false,
                    strength: 2,
                    willpower: 4,
                    lore: 1,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            target = playerAt(scenarioGame, 1).play[1];
        target.location = source.card;
        const keywords = cardKeywords(scenarioRules(), target.card).map((keyword) => keyword.toLowerCase());
        expect(scenarioRules().characteristic(target.card, "Strength")).toBe(
            ((() => {
                const definition = scenarioCards.definition(target.card.fullName);
                if (definition.type !== "Character") throw new Error("Expected a character");
                return definition.strength;
            })() ?? 0) + 1,
        );
        expect(scenarioRules().characteristic(target.card, "Willpower")).toBe((scenarioRules().characteristic(target.card, "Willpower", true) ?? 0) + 1);
    });
});
