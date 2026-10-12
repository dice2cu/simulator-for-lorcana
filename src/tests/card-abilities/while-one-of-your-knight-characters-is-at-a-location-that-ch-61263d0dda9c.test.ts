import { Rules as RuleQueries } from "../../engine/rules";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
// Converted from reference/card-abilities/while-one-of-your-knight-characters-is-at-a-location-that-ch-61263d0dda9c.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 61263d0dda9c
const abilityText = "While one of your Knight characters is at a location, that character gains Resist +2. (Damage dealt to them is reduced by 2.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Grumpy - Skeptical Knight",
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
                    fullName: "Knight",
                    names: ["Knight"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Knight"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
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
            target = playerAt(scenarioGame, 1).play[1],
            location = playerAt(scenarioGame, 1).play[2];
        target.location = location.card;
        expect(cardKeywords(scenarioRules(), target.card).map((x) => x.toLowerCase())).toContainEqual("resist");
    });
});
