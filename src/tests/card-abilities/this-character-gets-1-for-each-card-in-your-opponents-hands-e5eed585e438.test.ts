import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-gets-1-for-each-card-in-your-opponents-hands-e5eed585e438.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: e5eed585e438
const abilityText = "This character gets -1 ◊ for each card in your opponents' hands.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Flynn Rider - His Own Biggest Fan",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName, prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, [prototypeCardName, prototypeCardName]);
        const printed = scenarioRules().characteristic(source.card, "Lore", true) ?? 0;
        expect(scenarioRules().characteristic(source.card, "Lore")).toBe(printed + -2);
    });
});
