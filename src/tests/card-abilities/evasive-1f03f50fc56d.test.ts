import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { canChallenge } from "../../engine/actions";
// Converted from reference/card-abilities/evasive-1f03f50fc56d.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 1f03f50fc56d
const abilityText = "Evasive";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Pocahontas & Meeko - Adventurous Friends",
    "Dash Parr & Violet Parr - Super Siblings",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: prototypeCardName, exerted: !false }]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            { definition: "Stitch - Rock Star", exerted: !true },
            { definition: "Tinker Bell - Peter Pan's Ally", exerted: !true },
        ]);
        const defender = playerAt(scenarioGame, 1).play[0];
        const [ordinaryAttacker, evasiveAttacker] = playerAt(scenarioGame, 2).play;
        expect(canChallenge(scenarioRules(), ordinaryAttacker.card, defender.card)).toBe(false);
        expect(canChallenge(scenarioRules(), evasiveAttacker.card, defender.card)).toBe(true);
    });
});
