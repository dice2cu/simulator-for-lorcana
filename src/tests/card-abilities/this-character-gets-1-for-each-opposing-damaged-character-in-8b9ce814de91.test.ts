import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/this-character-gets-1-for-each-opposing-damaged-character-in-8b9ce814de91.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 8b9ce814de91
const abilityText = "This character gets +1 ◊ for each opposing damaged character in play.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Robin Hood - Sneaky Sleuth",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        const scenarioRules = () => new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName, prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Damaged One",
                    names: ["Damaged One"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 5,
                    lore: 0,
                }),
                damage: 1,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Damaged Two",
                    names: ["Damaged Two"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 5,
                    lore: 0,
                }),
                damage: 2,
            },
        ]);
        const printed = scenarioRules().characteristic(source.card, "Lore", true) ?? 0;
        expect(scenarioRules().characteristic(source.card, "Lore")).toBe(printed + 2);
    });
});
