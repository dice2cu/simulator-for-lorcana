import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/your-other-characters-get-2-41875eed862e.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 41875eed862e
const abilityText = "Your other characters get +2 ⛉.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Rhino - Motivational Speaker",
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
        const sourceWillpower = scenarioRules().characteristic(source.card, "Willpower", true);
        expect(scenarioRules().characteristic(target.card, "Willpower")).toBe(6);
        expect(scenarioRules().characteristic(source.card, "Willpower")).toEqual(sourceWillpower);
    });
});
