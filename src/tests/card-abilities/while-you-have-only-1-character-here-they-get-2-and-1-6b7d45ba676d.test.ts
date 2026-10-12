import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
// Converted from reference/card-abilities/while-you-have-only-1-character-here-they-get-2-and-1-6b7d45ba676d.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 6b7d45ba676d
const abilityText = "While you have only 1 character here, they get +2 ⛉ and +1 ◊.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Andy's Room - Home Base",
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
                    fullName: "Here",
                    names: ["Here"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 3,
                    lore: 1,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            target = playerAt(scenarioGame, 1).play[1];
        target.location = source.card;
        expect(scenarioRules().characteristic(target.card, "Willpower")).toBe(5);
        expect(scenarioRules().characteristic(target.card, "Lore")).toBe(2);
    });
});
