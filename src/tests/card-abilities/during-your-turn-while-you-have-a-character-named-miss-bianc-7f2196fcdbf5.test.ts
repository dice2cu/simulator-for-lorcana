import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/during-your-turn-while-you-have-a-character-named-miss-bianc-7f2196fcdbf5.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 7f2196fcdbf5
const abilityText =
    "During your turn, while you have a character named Miss Bianca or Bernard in play, this character gains Evasive. (They can challenge characters with Evasive.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Orville - Albatross Air",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Bernard - Test",
                    names: ["Bernard"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const ability: Ability = {
            type: "Static",
            rule: {
                type: "Conditional",
                if: {
                    and: [
                        { duringTurnOf: "You" },
                        {
                            value: {
                                count: { zone: "Play", player: "You", cardType: "Character", where: { or: [{ name: "Miss Bianca" }, { name: "Bernard" }] } },
                            },
                            is: { atLeast: 1 },
                        },
                    ],
                },
                then: { type: "Modify Cards", cards: "Self", modifier: { gainKeyword: "Evasive" } },
            },
            name: "WELCOME ABOARD, FOLKS",
        };
        expect(cardKeywords(scenarioRules(), source.card).map((keyword) => keyword.toLowerCase())).toContainEqual("evasive");
    });
});
