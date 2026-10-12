import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/at-the-start-of-your-turn-if-an-opposing-character-has-damag-e48c6c80defc.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: e48c6c80defc
const abilityText = "At the start of your turn, if an opposing character has damage, gain 1 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Vision Slab",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Mama Odie",
                    names: ["Mama Odie"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Madrigal", "Pirate", "Princess", "Queen"],
                    cost: 0,
                    inkwell: false,
                    strength: 10,
                    willpower: 8,
                    lore: 1,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Condition Location",
                    names: ["Condition Location"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 8,
                    lore: 0,
                    moveCost: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Condition Item",
                    names: ["Condition Item"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Opponent One",
                    names: ["Opponent One"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 2,
                    willpower: 6,
                    lore: 1,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Opponent Two",
                    names: ["Opponent Two"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 3,
                    willpower: 6,
                    lore: 1,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        playerAt(scenarioGame, 1).play[1].location = playerAt(scenarioGame, 1).play[0].card;
        playerAt(scenarioGame, 2).lore = 10;
        // "if an opposing character has damage"
        playerAt(scenarioGame, 2).play[0].damage = 1;
        {
            scenarioLive = engine.startTurn(scenarioGame, { card: scenarioCards.lookup });
            scenarioResolution = scenarioLive;
            resolvePlayers(
                scenarioResolution,
                {},
                {
                    untilAction: true,
                },
            );
            scenarioGame = finished(scenarioResolution, true);
            if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
        }
        expect(playerAt(scenarioGame, 1).lore).toBe(1);
    });
});
