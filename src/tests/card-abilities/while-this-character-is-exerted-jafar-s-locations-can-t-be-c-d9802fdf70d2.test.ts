import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-is-exerted-jafar-s-locations-can-t-be-c-d9802fdf70d2.test.ts
import { describe, expect, it } from "vitest";
import type { Ability } from "../../model/ability";
// Generated ability ID: d9802fdf70d2
const abilityText = "While this character is exerted, Jafar's locations can't be challenged.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Iago - Raucous Lookout",
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
                    fullName: "Jafar Location",
                    names: ["Jafar Location"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 8,
                    lore: 0,
                    moveCost: 0,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            location = playerAt(scenarioGame, 1).play[1];
        const ability: Ability = {
            type: "Static",
            rule: {
                type: "Conditional",
                if: { every: "Self", where: { exerted: true } },
                then: { type: "Modify Cards", cards: { zone: "Play", player: "You", cardType: "Location" }, modifier: { restriction: "Can't Be Challenged" } },
            },
            name: "SOUND THE ALARM",
        };
        expect(ability.type).toBe("Static");
        source.exerted = !false;
        expect(scenarioRules().restricted(location.card, "Can't Be Challenged")).toBe(true);
        source.exerted = !true;
        expect(scenarioRules().restricted(location.card, "Can't Be Challenged")).toBe(false);
    });
});
