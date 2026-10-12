import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { canChallenge } from "../../engine/actions";
// Converted from reference/card-abilities/while-you-have-no-cards-in-your-hand-characters-with-cost-4-fcadabb785c1.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: fcadabb785c1
const abilityText = "While you have no cards in your hand, characters with cost 4 or less can't challenge this character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Rajah - Royal Protector",
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
                    cost: 4,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !true,
            },
        ]);
        const source = playerAt(scenarioGame, 1).play[0],
            attacker = playerAt(scenarioGame, 2).play[0];
        expect(canChallenge(scenarioRules(), attacker.card, source.card)).toBe(false);
    });
});
