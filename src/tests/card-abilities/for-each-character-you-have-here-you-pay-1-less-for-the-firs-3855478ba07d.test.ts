import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/for-each-character-you-have-here-you-pay-1-less-for-the-firs-3855478ba07d.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 3855478ba07d
const abilityText = "For each character you have here, you pay 1 ⬡ less for the first action you play each turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Owl Island - Secluded Entrance",
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
                    fullName: "First Visitor",
                    names: ["First Visitor"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Second Visitor",
                    names: ["Second Visitor"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [location, firstVisitor, secondVisitor] = playerAt(scenarioGame, 1).play;
        firstVisitor.location = location.card;
        secondVisitor.location = location.card;
        const action = scenarioCards.create(
            scenarioCards.fixture({
                fullName: "Action",
                names: ["Action"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 5,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        );
        const character = scenarioCards.create(
            scenarioCards.fixture({
                fullName: "Character",
                names: ["Character"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 5,
                inkwell: false,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
        );
        playerAt(scenarioGame, 1).hand.push(action, character);
        expect(scenarioRules().cost(action)).toBe(3);
        expect(scenarioRules().cost(character)).toBe(5);
    });
});
