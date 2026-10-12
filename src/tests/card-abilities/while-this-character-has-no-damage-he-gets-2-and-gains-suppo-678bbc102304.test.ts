import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-has-no-damage-he-gets-2-and-gains-suppo-678bbc102304.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 678bbc102304
const abilityText =
    "While this character has no damage, he gets +2 ¤ and gains Support. (Whenever they quest, you may add their ¤ to another chosen character's ¤ this turn.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Pluto - Tried and True",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Pluto - Tried and True",
                    names: ["Pluto"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Ally"],
                    cost: 6,
                    inkwell: true,
                    strength: 10,
                    willpower: 7,
                    lore: 2,
                }),
                damage: 0,
            },
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const underneath = playerAt(scenarioGame, 1).hand.pop();
        if (!underneath) throw new Error("Card to put under source was not created.");
        inPlay(scenarioRules(), source.card).under = [underneath].map((card) => ({ card, faceDown: true }));
        expect(scenarioRules().characteristic(source.card, "Strength")).toBe(
            ((() => {
                const definition = scenarioCards.definition(source.card.fullName);
                if (definition.type !== "Character") throw new Error("Expected a character");
                return definition.strength;
            })() ?? 0) + 2,
        );
        const keywords = cardKeywords(scenarioRules(), source.card).map((keyword) => keyword.toLowerCase());
        expect(keywords).toContainEqual("support");
    });
});
