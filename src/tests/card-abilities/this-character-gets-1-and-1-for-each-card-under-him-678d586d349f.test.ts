import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-gets-1-and-1-for-each-card-under-him-678d586d349f.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 678d586d349f
const abilityText = "This character gets +1 ¤ and +1 ⛉ for each card under him.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Scrooge McDuck - Ghostly Ebenezer",
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
        const printed =
            (() => {
                const definition = scenarioCards.definition(source.card.fullName);
                if (definition.type !== "Character") throw new Error("Expected a character");
                return definition.strength;
            })() ?? 0;
        expect(scenarioRules().characteristic(source.card, "Strength")).toBe(printed + 2);
    });
});
