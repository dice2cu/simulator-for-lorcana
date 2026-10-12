import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/while-there-s-a-card-under-this-character-she-gets-1-and-gai-5eb125a6c0a2.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 5eb125a6c0a2
const abilityText = "While there's a card under this character, she gets +1 ◊ and gains Evasive. (Only characters with Evasive can challenge them.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Ursula - Whisper of Vanessa",
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
        expect(scenarioRules().characteristic(source.card, "Lore")).toBe((scenarioRules().characteristic(source.card, "Lore", true) ?? 0) + 1);
        const keywords = cardKeywords(scenarioRules(), source.card).map((keyword) => keyword.toLowerCase());
        expect(keywords).toContainEqual("evasive");
    });
});
