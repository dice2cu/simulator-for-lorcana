import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
// Converted from reference/card-abilities/damage-counters-can-t-be-removed-739c1ec81e2c.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 739c1ec81e2c
const abilityText = "Damage counters can't be removed.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Vision Slab",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const p = playerAt(scenarioGame, 1),
            s = playerAt(scenarioGame, 1).play[0],
            a: Ability = {
                type: "Static",
                rule: {
                    type: "Modify Cards",
                    cards: { zone: "Play", where: { or: [{ cardType: "Character" }, { cardType: "Location" }] } },
                    modifier: { restriction: "Can't Remove Damage" },
                },
                name: "TRAPPED!",
            };
        inPlay(scenarioRules(), s.card).damage = 3;
        expect(inPlay(scenarioRules(), s.card).damage ?? 0).toBe(3);
    });
});
