import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-can-t-be-challenged-by-characters-with-2-or-g-d700c0ee80b7.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: d700c0ee80b7
const abilityText = "This character can't be challenged by characters with 2 ¤ or greater.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mr. Big - Shrewd Tycoon",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: {
                    fullName: "Attacker",
                    names: ["Attacker"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Pirate"],
                    cost: 1,
                    inkwell: true,
                    lore: 1,
                    strength: 2,
                    willpower: 3,
                },
                damage: 1,
            },
        ]);
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
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            target = source,
            ability: Ability = {
                type: "Static",
                rule: {
                    type: "Modify Cards",
                    cards: "Self",
                    modifier: { restriction: "Can't Be Challenged", by: { cardType: "Character", strength: { atLeast: 2 } } },
                },
                name: "REPUTATION",
            };
        expect(scenarioRules().restricted(target.card, "Can't Be Challenged", playerAt(scenarioGame, 2).play[0].card)).toBe(true);
    });
});
