import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/while-an-opponent-has-10-or-more-lore-this-character-gets-6-42ceb93c6081.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 42ceb93c6081
const abilityText = "While an opponent has 10 or more lore, this character gets +6 ¤.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Donald Duck - Pie Slinger",
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
                    fullName: "Exerted Ally One",
                    names: ["Exerted Ally One"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 8,
                    lore: 0,
                }),
                exerted: !false,
                damage: 1,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Exerted Ally Two",
                    names: ["Exerted Ally Two"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 8,
                    lore: 0,
                }),
                exerted: !false,
                damage: 1,
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Damaged Opponent One",
                    names: ["Damaged Opponent One"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 8,
                    lore: 0,
                }),
                damage: 1,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Damaged Opponent Two",
                    names: ["Damaged Opponent Two"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 8,
                    lore: 0,
                }),
                damage: 1,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Damaged Opponent Three",
                    names: ["Damaged Opponent Three"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 8,
                    lore: 0,
                }),
                damage: 1,
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 2 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        playerAt(scenarioGame, 1).inkwell.forEach((card) => {
            card.exerted = !false;
        });
        playerAt(scenarioGame, 2).lore = 12;
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, []);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        expect(scenarioRules().characteristic(source.card, "Strength")).toBe(
            ((() => {
                const definition = scenarioCards.definition(source.card.fullName);
                if (definition.type !== "Character") throw new Error("Expected a character");
                return definition.strength;
            })() ?? 0) + 6,
        );
    });
});
