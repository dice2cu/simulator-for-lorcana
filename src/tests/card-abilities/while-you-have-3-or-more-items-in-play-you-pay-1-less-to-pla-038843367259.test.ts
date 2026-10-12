import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/while-you-have-3-or-more-items-in-play-you-pay-1-less-to-pla-038843367259.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 038843367259
const abilityText = "While you have 3 or more items in play, you pay 1 ⬡ less to play Inventor characters.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Gadget Hackwrench - Brilliant Bosun",
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
                    fullName: "Item One",
                    names: ["Item One"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Item Two",
                    names: ["Item Two"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Item Three",
                    names: ["Item Three"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
        ]);
        const p = playerAt(scenarioGame, 1),
            inventor = scenarioCards.create(
                scenarioCards.fixture({
                    fullName: "Inventor",
                    names: ["Inventor"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Inventor"],
                    cost: 4,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            ),
            other = scenarioCards.create(
                scenarioCards.fixture({
                    fullName: "Other",
                    names: ["Other"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 4,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            );
        playerAt(scenarioGame, 1).hand.push(inventor, other);
        expect(scenarioRules().cost(inventor)).toBe(3);
        expect(scenarioRules().cost(other)).toBe(4);
    });
});
