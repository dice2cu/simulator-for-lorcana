import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
// Converted from reference/card-abilities/while-there-s-a-card-under-this-character-he-gets-2-and-1-9d00518eb4e6.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 9d00518eb4e6
const abilityText = "While there's a card under this character, he gets +2 ¤ and +1 ◊.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Flynn Rider - Spectral Scoundrel",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const underneath = playerAt(scenarioGame, 1).hand.pop();
        if (!underneath) throw new Error("Card to put under the source was not created.");
        inPlay(scenarioRules(), source.card).under = [underneath].map((card) => ({ card, faceDown: true }));
        expect(scenarioRules().characteristic(source.card, "Strength")).toBe(
            ((() => {
                const definition = scenarioCards.definition(source.card.fullName);
                if (definition.type !== "Character") throw new Error("Expected a character");
                return definition.strength;
            })() ?? 0) + 2,
        );
        expect(scenarioRules().characteristic(source.card, "Lore")).toBe((scenarioRules().characteristic(source.card, "Lore", true) ?? 0) + 1);
    });
});
