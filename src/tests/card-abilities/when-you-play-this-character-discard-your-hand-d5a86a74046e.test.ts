import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/when-you-play-this-character-discard-your-hand-d5a86a74046e.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: d5a86a74046e
const abilityText = "When you play this character, discard your hand.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Shere Khan - Infamous Tiger",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Hand One",
                names: ["Hand One"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
            scenarioCards.fixture({
                fullName: "Hand Two",
                names: ["Hand Two"],
                type: "Item",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
            }),
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const cards = [...playerAt(scenarioGame, 1).hand];
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
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(0);
        expect(playerAt(scenarioGame, 1).discard).toEqual(expect.arrayContaining(cards));
    });
});
