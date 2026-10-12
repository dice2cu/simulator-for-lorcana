import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-is-exerted-your-ally-characters-get-1-6c34e8e4466f.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 6c34e8e4466f
const abilityText = "While this character is exerted, your Ally characters get +1 ¤.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Aladdin - Research Assistant",
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
                    fullName: "Aladdin - Research Assistant",
                    names: ["Aladdin"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Hero"],
                    cost: 4,
                    inkwell: false,
                    strength: 2,
                    willpower: 4,
                    lore: 2,
                }),
                exerted: !false,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Friendly",
                    names: ["Friendly"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Ally", "Hero", "Villain", "Pirate"],
                    abilities: [{ type: "Keyword", keyword: { name: "Bodyguard" } }],
                    cost: 0,
                    inkwell: false,
                    strength: 3,
                    willpower: 6,
                    lore: 1,
                }),
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Opposing",
                    names: ["Opposing"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Pirate"],
                    abilities: [{ type: "Keyword", keyword: { name: "Evasive" } }],
                    cost: 0,
                    inkwell: false,
                    strength: 3,
                    willpower: 6,
                    lore: 1,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [source, friendly] = playerAt(scenarioGame, 1).play;
        const opposing = playerAt(scenarioGame, 2).play[0];
        expect(scenarioRules().characteristic(friendly.card, "Strength")).toBe(3 + 1);
    });
});
