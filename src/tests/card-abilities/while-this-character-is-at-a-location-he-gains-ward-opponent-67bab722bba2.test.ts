import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/while-this-character-is-at-a-location-he-gains-ward-opponent-67bab722bba2.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 67bab722bba2
const abilityText = "While this character is at a location, he gains Ward. (Opponents can't choose them except to challenge.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Stitch - Covert Agent",
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
        expect(cardKeywords(scenarioRules(), source.card).map((keyword) => keyword.toLowerCase())).toContainEqual("ward");
    });
});
