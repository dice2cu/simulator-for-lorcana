import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/opposing-damaged-characters-gain-reckless-they-can-t-quest-a-60ac97e2b400.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 60ac97e2b400
const abilityText = "Opposing damaged characters gain Reckless. (They can't quest and must challenge if able.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Tropical Rainforest - Jaguar Lair",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 8,
                    lore: 0,
                }),
                damage: 1,
            },
        ]);
        const target = playerAt(scenarioGame, 2).play[0];
        expect(cardKeywords(scenarioRules(), target.card).map((x) => x.toLowerCase())).toContainEqual("reckless");
    });
});
