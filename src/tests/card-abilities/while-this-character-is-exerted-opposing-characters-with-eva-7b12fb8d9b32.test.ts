import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-is-exerted-opposing-characters-with-eva-7b12fb8d9b32.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 7b12fb8d9b32
const abilityText = "While this character is exerted, opposing characters with Evasive gain Reckless. (They can't quest and must challenge if able.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Captain Hook - Ruthless Pirate",
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
                    fullName: "Captain Hook - Ruthless Pirate",
                    names: ["Captain Hook"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Villain", "Pirate", "Captain"],
                    cost: 7,
                    inkwell: false,
                    strength: 5,
                    willpower: 5,
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
        expect(cardKeywords(scenarioRules(), opposing.card).map((keyword) => keyword.toLowerCase())).toContainEqual("reckless");
    });
});
