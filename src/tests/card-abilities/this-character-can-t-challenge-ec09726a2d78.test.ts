import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { canChallenge } from "../../engine/actions";
// Converted from reference/card-abilities/this-character-can-t-challenge-ec09726a2d78.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: ec09726a2d78
const abilityText = "This character can't challenge.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Percy - Pupsicle",
    "Chief Powhatan - Protective Leader",
    "Fa Zhou - Mulan's Father",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: prototypeCardName, exerted: !true }]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [{ definition: "HeiHei - Boat Snack", exerted: !false }]);
        const attacker = playerAt(scenarioGame, 1).play[0];
        const defender = playerAt(scenarioGame, 2).play[0];
        expect(canChallenge(scenarioRules(), attacker.card, defender.card)).toBe(false);
    });
});
