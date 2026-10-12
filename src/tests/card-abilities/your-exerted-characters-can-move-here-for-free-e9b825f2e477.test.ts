import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/your-exerted-characters-can-move-here-for-free-e9b825f2e477.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: e9b825f2e477
const abilityText = "Your exerted characters can move here for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Ring of Stones - Place of Legends",
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
                    fullName: "Mover",
                    names: ["Mover"],
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
            {
                definition: scenarioCards.fixture({
                    fullName: "Ready Mover",
                    names: ["Ready Mover"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !true,
            },
        ]);
        const p = playerAt(scenarioGame, 1),
            location = playerAt(scenarioGame, 1).play[0],
            eligible = playerAt(scenarioGame, 1).play[1],
            ineligible = playerAt(scenarioGame, 1).play[2];
        (() => {
            const definition = scenarioCards.definition(location.card.fullName);
            if (definition.type !== "Location") throw new Error("Expected a location");
            scenarioCards.definitions.set(definition.fullName, { ...definition, moveCost: 3 });
        })();
        const freeMove = scenarioRules()
            .alternateCosts(eligible.card, "Move", location.card)
            .find((entry) => entry.rule.cost.length === 0);
        if (!freeMove) throw new Error("Missing free movement rule");
        expect(freeMove.rule.cost).toHaveLength(0);
        expect(scenarioRules().moveCost(ineligible.card, location.card, true)).toBe(3);
    });
});
