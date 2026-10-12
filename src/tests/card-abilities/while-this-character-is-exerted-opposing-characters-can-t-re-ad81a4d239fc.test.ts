import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-is-exerted-opposing-characters-can-t-re-ad81a4d239fc.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: ad81a4d239fc
const abilityText = "While this character is exerted, opposing characters can't ready at the start of their turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Genie - Main Attraction",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Opposing",
                    names: ["Opposing"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            target = playerAt(scenarioGame, 2).play[0],
            ability: Ability = {
                type: "Static",
                rule: {
                    type: "Conditional",
                    if: { every: "Self", where: { exerted: true } },
                    then: {
                        type: "Modify Cards",
                        cards: { zone: "Play", player: "Opponents", cardType: "Character" },
                        modifier: { restriction: "Can't Ready At Start Of Turn" },
                    },
                },
                name: "PHENOMENAL SHOWMAN",
            };
        source.exerted = true;
        expect(scenarioRules().restricted(target.card, "Can't Ready At Start Of Turn")).toBe(true);
    });
});
