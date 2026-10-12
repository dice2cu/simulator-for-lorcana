import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/while-there-s-a-card-under-this-character-it-gains-resist-2-a9eaa5d7cbb9.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: a9eaa5d7cbb9
const abilityText = "While there's a card under this character, it gains Resist +2. (Damage dealt to them is reduced by 2.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Omnidroid - V.10",
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
        const keywords = cardKeywords(scenarioRules(), source.card).map((keyword) => keyword.toLowerCase());
        expect(keywords).toContainEqual("resist");
    });
});
