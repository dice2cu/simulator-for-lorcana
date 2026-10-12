import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { canChallenge } from "../../engine/actions";
// Converted from reference/card-abilities/opposing-characters-with-cost-4-or-less-can-t-challenge-59f675f62192.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 59f675f62192
const abilityText = "Opposing characters with cost 4 or less can't challenge.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Jafar - Tyrannical Hypnotist",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
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
        const defender = playerAt(scenarioGame, 1).play[0],
            attacker = playerAt(scenarioGame, 2).play[0];
        expect(canChallenge(scenarioRules(), attacker.card, defender.card)).toBe(false);
    });
});
