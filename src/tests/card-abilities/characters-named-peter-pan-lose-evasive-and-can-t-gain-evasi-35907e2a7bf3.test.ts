import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/characters-named-peter-pan-lose-evasive-and-can-t-gain-evasi-35907e2a7bf3.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 35907e2a7bf3
const abilityText = "Characters named Peter Pan lose Evasive and can't gain Evasive.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Captain Hook - Master Swordsman",
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
                    fullName: "Peter Pan",
                    abilities: [{ type: "Keyword", keyword: { name: "Evasive" } }],
                    names: ["Peter Pan"],
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
            target = playerAt(scenarioGame, 1).play[1];
        expect(cardKeywords(scenarioRules(), target.card).map((x) => x.toLowerCase())).not.toContainEqual("evasive");
    });
});
