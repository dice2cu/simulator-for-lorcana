import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/during-opponents-turns-you-can-t-lose-lore-75e6f345d26d.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 75e6f345d26d
const abilityText = "During opponents' turns, you can't lose lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Koda - Talkative Cub",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const p = playerAt(scenarioGame, 1),
            s = playerAt(scenarioGame, 1).play[0],
            a: Ability = {
                type: "Static",
                rule: {
                    type: "Conditional",
                    if: { duringTurnOf: "Opponents" },
                    then: { type: "Modify Players", players: "You", modifier: { restriction: "Can't Lose Lore" } },
                },
                name: "TELL EVERYBODY",
            };
        playerAt(scenarioGame, 1).lore = 5;
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        expect(playerAt(scenarioGame, 1).lore).toBe(5);
    });
});
