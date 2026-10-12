import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-has-10-or-more-she-gets-4-28dea6f57617.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 28dea6f57617
const abilityText = "While this character has 10 ¤ or more, she gets +4 ◊.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Alice - Growing Girl",
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
                    fullName: "Alice - Growing Girl",
                    names: ["Alice"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Dreamborn", "Hero"],
                    cost: 3,
                    inkwell: true,
                    strength: 10,
                    willpower: 4,
                    lore: 1,
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
        expect(scenarioRules().characteristic(source.card, "Lore")).toBe((scenarioRules().characteristic(source.card, "Lore", true) ?? 0) + 4);
    });
});
