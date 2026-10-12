import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/during-opponents-turns-this-character-gains-resist-2-damage-5b530f35e879.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 5b530f35e879
const abilityText = "During opponents' turns, this character gains Resist +2. (Damage dealt to them is reduced by 2.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Yao - Snow Warrior",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            ability: Ability = {
                type: "Static",
                rule: {
                    type: "Conditional",
                    if: { duringTurnOf: "Opponents" },
                    then: { type: "Modify Cards", cards: "Self", modifier: { gainKeyword: "Resist", amount: 2 } },
                },
                name: "OOH, I'M SCARED",
            };
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        const keywords = cardKeywords(scenarioRules(), source.card).map((keyword) => keyword.toLowerCase());
        expect(keywords).toContainEqual("resist");
    });
});
