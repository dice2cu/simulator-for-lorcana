import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/while-there-s-a-character-with-evasive-here-this-location-ga-18c75766376e.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 18c75766376e
const abilityText = "While there's a character with Evasive here, this location gains Evasive. (Only characters with Evasive can challenge it.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Game Preserve - Protected Land",
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
                    fullName: "Evasive",
                    abilities: [{ type: "Keyword", keyword: { name: "Evasive" } }],
                    names: ["Evasive"],
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
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            target = playerAt(scenarioGame, 1).play[1];
        target.location = source.card;
        expect(cardKeywords(scenarioRules(), source.card).map((x) => x.toLowerCase())).toContainEqual("evasive");
    });
});
