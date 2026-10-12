import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/characters-with-support-get-1-and-2-while-here-ab0142816ca5.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: ab0142816ca5
const abilityText = "Characters with Support get +1 ◊ and +2 ⛉ while here.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Great Illuminary - Radiant Ballroom",
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
                    abilities: [{ type: "Keyword", keyword: { name: "Support" } }],
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
        expect(scenarioRules().characteristic(target.card, "Lore")).toBe((scenarioRules().characteristic(target.card, "Lore", true) ?? 0) + 1);
        expect(scenarioRules().characteristic(target.card, "Willpower")).toBe((scenarioRules().characteristic(target.card, "Willpower", true) ?? 0) + 2);
    });
});
