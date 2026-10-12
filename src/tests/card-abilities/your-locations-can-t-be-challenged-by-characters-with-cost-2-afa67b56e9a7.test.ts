import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/your-locations-can-t-be-challenged-by-characters-with-cost-2-afa67b56e9a7.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: afa67b56e9a7
const abilityText = "Your locations can't be challenged by characters with cost 2 or less.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Club Door",
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
                    strength: 0,
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
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 1,
                    lore: 0,
                    moveCost: 0,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            target = playerAt(scenarioGame, 1).play[1],
            ability: Ability = {
                type: "Static",
                rule: {
                    type: "Modify Cards",
                    cards: { zone: "Play", player: "You", cardType: "Location" },
                    modifier: { restriction: "Can't Be Challenged", by: { cardType: "Character", cost: { atMost: 2 } } },
                },
                name: "COOL CATS ONLY",
            };
        expect(scenarioRules().restricted(target.card, "Can't Be Challenged", playerAt(scenarioGame, 2).play[0].card)).toBe(true);
    });
});
