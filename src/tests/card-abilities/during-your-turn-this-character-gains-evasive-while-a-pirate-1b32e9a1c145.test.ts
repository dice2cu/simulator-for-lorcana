import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/during-your-turn-this-character-gains-evasive-while-a-pirate-1b32e9a1c145.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 1b32e9a1c145
const abilityText = "During your turn, this character gains Evasive while a Pirate character is in play. (They can challenge characters with Evasive.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Tick-Tock - Relentless Crocodile",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        (() => {
            const card = scenarioCards.create(scenarioCards.definition("Captain Hook - Forceful Duelist"));
            playerAt(scenarioGame, 1).play.push({ card, damage: 0, exerted: false, drying: false });
            return card;
        })();
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            ability: Ability = {
                type: "Static",
                rule: {
                    type: "Conditional",
                    if: { and: [{ duringTurnOf: "You" }, { exists: { zone: "Play", cardType: "Character", where: { classification: "Pirate" } } }] },
                    then: { type: "Modify Cards", cards: "Self", modifier: { gainKeyword: "Evasive" } },
                },
                name: "LOOKING FOR LUNCH",
            };
        const keywords = cardKeywords(scenarioRules(), source.card).map((keyword) => keyword.toLowerCase());
        expect(keywords).toContainEqual("evasive");
    });
});
