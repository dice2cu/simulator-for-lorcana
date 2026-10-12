import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-is-exerted-your-characters-named-koda-c-974b948518ec.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: 974b948518ec
const abilityText = "While this character is exerted, your characters named Koda can't be challenged.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Kenai - Big Brother",
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
                    fullName: "Koda",
                    names: ["Koda"],
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
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            target = playerAt(scenarioGame, 1).play[1],
            ability: Ability = {
                type: "Static",
                rule: {
                    type: "Conditional",
                    if: { every: "Self", where: { exerted: true } },
                    then: {
                        type: "Modify Cards",
                        cards: { zone: "Play", player: "You", cardType: "Character", where: { name: "Koda" } },
                        modifier: { restriction: "Can't Be Challenged" },
                    },
                },
                name: "BROTHERS FOREVER",
            };
        source.exerted = true;
        expect(scenarioRules().restricted(target.card, "Can't Be Challenged")).toBe(true);
    });
});
