import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/your-damaged-characters-get-1-47d67efb4066.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 47d67efb4066
const abilityText = "Your damaged characters get +1 ¤.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Card Soldier's Spear",
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
                    fullName: "Matching",
                    names: ["Matching"],
                    type: "Character",
                    colors: ["Ruby"],
                    subtypes: ["Hero", "Seven Dwarfs", "Princess", "Queen", "Prince", "King"],
                    abilities: [
                        { type: "Keyword", keyword: { name: "Evasive" } },
                        { type: "Keyword", keyword: { name: "Support" } },
                        { type: "Keyword", keyword: { name: "Reckless" } },
                    ],
                    cost: 0,
                    inkwell: false,
                    strength: 5,
                    willpower: 5,
                    lore: 2,
                }),
                damage: 1,
                exerted: !false,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Nonmatching",
                    names: ["Nonmatching"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 1,
                    willpower: 3,
                    lore: 1,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [source, matching, nonmatching] = playerAt(scenarioGame, 1).play;
        const ability: Ability = {
            type: "Static",
            rule: {
                type: "Modify Cards",
                cards: { zone: "Play", player: "You", cardType: "Character", where: { damage: { atLeast: 1 } } },
                modifier: { stat: "Strength", amount: 1 },
            },
            name: "A SUITABLE WEAPON",
        };
        expect(scenarioRules().characteristic(matching.card, "Strength")).toBe(6);
        expect(scenarioRules().characteristic(nonmatching.card, "Strength")).toBe(1);
    });
});
