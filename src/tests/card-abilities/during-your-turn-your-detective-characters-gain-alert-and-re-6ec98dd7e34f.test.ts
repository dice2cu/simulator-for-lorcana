import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/during-your-turn-your-detective-characters-gain-alert-and-re-6ec98dd7e34f.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 6ec98dd7e34f
const abilityText = "During your turn, your Detective characters gain Alert and Resist +2.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Judy Hopps - Lead Detective",
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
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Detective", "Musketeer", "Pirate", "Hero", "Villain", "Seven Dwarfs", "Hunny", "Racer", "Toy"],
                    cost: 0,
                    inkwell: false,
                    strength: 3,
                    willpower: 6,
                    lore: 1,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            target = playerAt(scenarioGame, 1).play[1],
            ability: Ability = {
                type: "Static",
                rule: {
                    type: "Conditional",
                    if: { duringTurnOf: "You" },
                    then: {
                        type: "Together",
                        rules: [
                            {
                                type: "Modify Cards",
                                cards: { zone: "Play", player: "You", cardType: "Character", where: { classification: "Detective" } },
                                modifier: { gainKeyword: "Alert" },
                            },
                            {
                                type: "Modify Cards",
                                cards: { zone: "Play", player: "You", cardType: "Character", where: { classification: "Detective" } },
                                modifier: { gainKeyword: "Resist", amount: 2 },
                            },
                        ],
                    },
                },
                name: "LATERAL THINKING",
            };
        const keywords = cardKeywords(scenarioRules(), target.card).map((keyword) => keyword.toLowerCase());
        expect(keywords).toContainEqual("resist");
        expect(keywords).toContainEqual("alert");
    });
});
