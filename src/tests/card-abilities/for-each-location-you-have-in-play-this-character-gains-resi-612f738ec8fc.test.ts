import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/for-each-location-you-have-in-play-this-character-gains-resi-612f738ec8fc.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 612f738ec8fc
const abilityText = "For each location you have in play, this character gains Resist +1 and gets +1 ◊. (Damage dealt to them is reduced by 1.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "John Silver - Greedy Treasure Seeker",
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
            const card = scenarioCards.create(scenarioCards.definition("Motunui - Island Paradise"));
            playerAt(scenarioGame, 1).play.push({ card, damage: 0, exerted: false, drying: false });
            return card;
        })();
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            ability: Ability = {
                type: "Static",
                rule: {
                    type: "Together",
                    rules: [
                        {
                            type: "Modify Cards",
                            cards: "Self",
                            modifier: { gainKeyword: "Resist", amount: { multiply: [1, { count: { zone: "Play", player: "You", cardType: "Location" } }] } },
                        },
                        {
                            type: "Modify Cards",
                            cards: "Self",
                            modifier: { stat: "Lore", amount: { multiply: [1, { count: { zone: "Play", player: "You", cardType: "Location" } }] } },
                        },
                    ],
                },
                name: "CHART YOUR OWN COURSE",
            };
        const keywords = cardKeywords(scenarioRules(), source.card).map((keyword) => keyword.toLowerCase());
        expect(keywords).toContainEqual("resist");
    });
});
