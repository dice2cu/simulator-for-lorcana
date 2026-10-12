import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { canChallenge } from "../../engine/actions";
// Converted from reference/card-abilities/characters-with-cost-2-or-less-can-t-challenge-your-characte-59d2a5ff6920.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 59d2a5ff6920
const abilityText = "Characters with cost 2 or less can't challenge your characters.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Gantu - Galactic Federation Captain",
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
                    fullName: "Defender",
                    names: ["Defender"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !false,
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Attacker",
                    names: ["Attacker"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 2,
                    inkwell: false,
                    strength: 3,
                    willpower: 8,
                    lore: 0,
                }),
                damage: 1,
                exerted: !true,
            },
        ]);
        const defender = playerAt(scenarioGame, 1).play[1],
            attacker = playerAt(scenarioGame, 2).play[0];
        expect(canChallenge(scenarioRules(), attacker.card, defender.card)).toBe(false);
    });
});
