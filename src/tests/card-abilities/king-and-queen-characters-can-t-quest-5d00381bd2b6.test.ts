import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/king-and-queen-characters-can-t-quest-5d00381bd2b6.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 5d00381bd2b6
const abilityText = "King and Queen characters can't quest.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Hans - Brazen Manipulator",
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
                    fullName: "Royal",
                    names: ["Royal"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["King", "Queen"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        const target = playerAt(scenarioGame, 1).play[1];
        expect(scenarioRules().restricted(target.card, "Can't Quest")).toBe(true);
    });
});
