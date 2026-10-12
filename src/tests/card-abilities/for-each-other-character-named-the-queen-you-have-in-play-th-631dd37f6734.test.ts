import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/for-each-other-character-named-the-queen-you-have-in-play-th-631dd37f6734.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 631dd37f6734
const abilityText = "For each other character named The Queen you have in play, this character gets +1 ◊.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Queen - Fairest of All",
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
                    fullName: "The Queen",
                    names: ["The Queen"],
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
                    fullName: "The Queen",
                    names: ["The Queen"],
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
            s = playerAt(scenarioGame, 1).play[0];
        expect(scenarioRules().characteristic(s.card, "Lore")).toBe(
            (scenarioRules().characteristic(s.card, "Lore", true) ?? scenarioRules().characteristic(s.card, "Lore") ?? 0) + 2,
        );
    });
});
