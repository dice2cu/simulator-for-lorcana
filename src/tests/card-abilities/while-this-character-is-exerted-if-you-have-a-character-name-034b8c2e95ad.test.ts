import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-is-exerted-if-you-have-a-character-name-034b8c2e95ad.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 034b8c2e95ad
const abilityText = "While this character is exerted, if you have a character named Pain in play, your Villain characters can't be challenged.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Panic - Immortal Sidekick",
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
                    fullName: "Protected",
                    names: ["Protected"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Hero", "Villain"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 2,
                    lore: 0,
                }),
                damage: 1,
                exerted: !false,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Pain",
                    names: ["Pain"],
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
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            target = playerAt(scenarioGame, 1).play[1],
            ability: Ability = {
                type: "Static",
                rule: {
                    type: "Conditional",
                    if: {
                        and: [
                            { every: "Self", where: { exerted: true } },
                            { value: { count: { zone: "Play", player: "You", cardType: "Character", where: { name: "Pain" } } }, is: { atLeast: 1 } },
                        ],
                    },
                    then: {
                        type: "Modify Cards",
                        cards: { zone: "Play", player: "You", cardType: "Character", where: { classification: "Villain" } },
                        modifier: { restriction: "Can't Be Challenged" },
                    },
                },
                name: "REPORTING FOR DUTY",
            };
        source.exerted = true;
        expect(scenarioRules().restricted(target.card, "Can't Be Challenged")).toBe(true);
    });
});
