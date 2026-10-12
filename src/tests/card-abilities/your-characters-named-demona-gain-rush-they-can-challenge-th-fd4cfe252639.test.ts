import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/your-characters-named-demona-gain-rush-they-can-challenge-th-fd4cfe252639.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: fd4cfe252639
const abilityText = "Your characters named Demona gain Rush. (They can challenge the turn they're played.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Grimorum Arcanorum",
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
                    fullName: "Demona",
                    names: ["Demona"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 3,
                    willpower: 4,
                    lore: 1,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Nonmatching",
                    names: ["Nonmatching"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 3,
                    willpower: 4,
                    lore: 1,
                }),
            },
        ]);
        const [, matching, nonmatching] = playerAt(scenarioGame, 1).play;
        expect(cardKeywords(scenarioRules(), matching.card).map((keyword) => keyword.toLowerCase())).toContainEqual("rush");
        expect(cardKeywords(scenarioRules(), nonmatching.card).map((keyword) => keyword.toLowerCase())).not.toContainEqual("rush");
    });
});
