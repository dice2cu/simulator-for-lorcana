import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/shuffle-your-deck-then-reveal-the-top-card-if-it-s-an-action-7266d1e5e627.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 7266d1e5e627
const abilityText =
    "Shuffle your deck, then reveal the top card. If it's an action card, you may play it for free. Otherwise, put it on the bottom of your deck, then each opponent loses 1 lore and you gain 1 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Prophetic Vision",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            opponent = playerAt(scenarioGame, 2),
            ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName));
        playerAt(scenarioGame, 2).lore = 5;
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(
                scenarioResolution,
                {},
                {
                    random: [{ type: "Shuffle", cards: [] }],
                },
            );
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 2).lore).toBe(4);
        expect(playerAt(scenarioGame, 1).lore).toBe(1);
    });
});
