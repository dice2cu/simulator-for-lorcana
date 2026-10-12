import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/if-you-have-a-character-here-you-pay-2-less-to-move-a-charac-547c7bc3eaee.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 547c7bc3eaee
const abilityText = "If you have a character here, you pay 2 ⬡ less to move a character of yours here.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "RLS Legacy - Solar Galleon",
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
                    fullName: "Already Here",
                    names: ["Already Here"],
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
            },
        ]);
        const p = playerAt(scenarioGame, 1),
            location = playerAt(scenarioGame, 1).play[0],
            here = playerAt(scenarioGame, 1).play[1],
            mover = playerAt(scenarioGame, 1).play[2];
        here.location = location.card;
        const definition = scenarioCards.definition(location.card.fullName);
        if (definition.type !== "Location") throw new Error("Expected a location");
        expect(scenarioRules().moveCost(mover.card, location.card, true)).toBe(Math.max(0, definition.moveCost - 2));
    });
});
