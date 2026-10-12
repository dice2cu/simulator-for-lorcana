import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-gets-1-for-each-card-under-him-7f19788d942f.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 7f19788d942f
const abilityText = "This character gets +1 ◊ for each card under him.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Genie - Magical Researcher",
    "Morty Fieldmouse - Tiny Tim",
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
        inPlay(scenarioRules(), source.card).under = player.hand.splice(0, 2).map((card) => ({ card, faceDown: true }));
        const printed = scenarioRules().characteristic(source.card, "Lore", true) ?? 0;
        expect(scenarioRules().characteristic(source.card, "Lore")).toBe(printed + 2);
    });
});
