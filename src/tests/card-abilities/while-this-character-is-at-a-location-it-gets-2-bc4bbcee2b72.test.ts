import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-is-at-a-location-it-gets-2-bc4bbcee2b72.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: bc4bbcee2b72
const abilityText = "While this character is at a location, it gets +2 ¤.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Magic Broom - The Big Sweeper",
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
                    fullName: "Location",
                    names: ["Location"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 8,
                    lore: 1,
                    moveCost: 0,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [source, location] = playerAt(scenarioGame, 1).play;
        source.location = location.card;
        expect(scenarioRules().characteristic(source.card, "Strength")).toBe(
            ((() => {
                const definition = scenarioCards.definition(source.card.fullName);
                if (definition.type !== "Character") throw new Error("Expected a character");
                return definition.strength;
            })() ?? 0) + 2,
        );
    });
});
