import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-has-no-damage-he-gains-resist-2-damage-0267415d0e56.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 0267415d0e56
const abilityText = "While this character has no damage, he gains Resist +2. (Damage dealt to them is reduced by 2.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Dr. Calico - Green-Eyed Man",
    "Rhino - Power Hamster",
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
                    fullName: "Dr. Calico - Green-Eyed Man",
                    names: ["Dr. Calico"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Villain"],
                    cost: 4,
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
        const keywords = cardKeywords(scenarioRules(), source.card).map((keyword) => keyword.toLowerCase());
        expect(keywords).toContainEqual("resist");
    });
});
