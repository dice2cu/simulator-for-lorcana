import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-is-at-a-location-all-characters-at-that-cb8d7546be5b.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: cb8d7546be5b
const abilityText = "While this character is at a location, all characters at that location get +1 ◊ and gain Evasive.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Carl Fredricksen & Russell - Intrepid Explorers",
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
                    fullName: "Other",
                    names: ["Other"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 1,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Location",
                    names: ["Location"],
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
            location = playerAt(scenarioGame, 1).play[2];
        source.location = location.card;
        target.location = location.card;
        expect(scenarioRules().characteristic(target.card, "Lore")).toBe(2);
        expect(cardKeywords(scenarioRules(), target.card).map((x) => x.toLowerCase())).toContainEqual("evasive");
    });
});
