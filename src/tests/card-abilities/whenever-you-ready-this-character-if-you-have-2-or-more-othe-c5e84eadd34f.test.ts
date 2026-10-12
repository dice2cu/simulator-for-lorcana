import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-you-ready-this-character-if-you-have-2-or-more-othe-c5e84eadd34f.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: c5e84eadd34f
const abilityText = "Whenever you ready this character, if you have 2 or more other characters in play, gain 2 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Christopher Robin - Adventurer",
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
                    fullName: "Other 1",
                    names: ["Other 1"],
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
                    fullName: "Other 2",
                    names: ["Other 2"],
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
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0);
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
