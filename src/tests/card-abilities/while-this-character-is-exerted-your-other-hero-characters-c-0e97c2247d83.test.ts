import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-is-exerted-your-other-hero-characters-c-0e97c2247d83.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 0e97c2247d83
const abilityText = "While this character is exerted, your other Hero characters can't be dealt damage unless they're being challenged.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Hercules - Mighty Leader",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(
            scenarioCards,
            [
                prototypeCardName,
                {
                    definition: scenarioCards.fixture({
                        fullName: "Hero",
                        names: ["Hero"],
                        type: "Character",
                        colors: ["Amber"],
                        subtypes: ["Hero"],
                        cost: 0,
                        inkwell: false,
                        strength: 0,
                        willpower: 1,
                        lore: 0,
                    }),
                },
                {
                    definition: scenarioCards.fixture({
                        fullName: "Villain",
                        names: ["Villain"],
                        type: "Character",
                        colors: ["Amber"],
                        subtypes: ["Villain"],
                        cost: 0,
                        inkwell: false,
                        strength: 0,
                        willpower: 1,
                        lore: 0,
                    }),
                },
            ],
            !false,
        );
        const p = playerAt(scenarioGame, 1),
            hero = playerAt(scenarioGame, 1).play[1],
            villain = playerAt(scenarioGame, 1).play[2];
        expect(scenarioRules().restricted(hero.card, "Can't Be Dealt Damage")).toBe(true);
        expect(scenarioRules().restricted(villain.card, "Can't Be Dealt Damage")).toBe(false);
    });
});
