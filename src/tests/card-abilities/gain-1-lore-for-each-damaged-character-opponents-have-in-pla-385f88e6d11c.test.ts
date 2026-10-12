import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/gain-1-lore-for-each-damaged-character-opponents-have-in-pla-385f88e6d11c.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 385f88e6d11c
const abilityText = "Gain 1 lore for each damaged character opponents have in play.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Pack Tactics",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Titan One",
                    names: ["Titan One"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Titan"],
                    cost: 0,
                    inkwell: false,
                    strength: 2,
                    willpower: 6,
                    lore: 1,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Titan Two",
                    names: ["Titan Two"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Titan"],
                    cost: 0,
                    inkwell: false,
                    strength: 2,
                    willpower: 6,
                    lore: 1,
                }),
            },
        ]);
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
                    strength: 2,
                    willpower: 8,
                    lore: 2,
                }),
                damage: 3,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Damaged",
                    names: ["Damaged"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 2,
                    willpower: 8,
                    lore: 1,
                }),
                damage: 1,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const target = playerAt(scenarioGame, 2).play[0];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName));
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).lore).toBe(2);
    });
});
