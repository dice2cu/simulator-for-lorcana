import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/your-characters-with-7-or-more-can-t-be-dealt-damage-b9880ed7fee1.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: b9880ed7fee1
const abilityText = "Your characters with 7 ¤ or more can't be dealt damage.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Baloo - Ol' Iron Paws",
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
                    fullName: "Strong",
                    names: ["Strong"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 7,
                    willpower: 1,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Weak",
                    names: ["Weak"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 6,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        const p = playerAt(scenarioGame, 1),
            strong = playerAt(scenarioGame, 1).play[1],
            weak = playerAt(scenarioGame, 1).play[2];
        expect(scenarioRules().restricted(strong.card, "Can't Be Dealt Damage")).toBe(true);
        expect(scenarioRules().restricted(weak.card, "Can't Be Dealt Damage")).toBe(false);
    });
});
