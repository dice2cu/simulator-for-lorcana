import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { describe, expect, it } from "vitest";
// Generated ability ID: 5d1dfaeb8b65
const abilityText = "Whenever you remove damage from one of your characters, gain 1 lore for each 1 damage removed.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Isabela Madrigal - Caring Cultivator",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 1, 3])("gains lore for actual damage removed, not the requested amount (%s)", async (damage) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: prototypeCardName, damage }]);
        const source = playerAt(scenarioGame, 1).play[0].card;
        {
            const sourceDefinition = scenarioCards.definition(source.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                { type: "Remove Damage", cards: { cards: [source] }, amount: 3 },
                { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).play[0].damage ?? 0).toBe(0);
        expect(playerAt(scenarioGame, 1).lore).toBe(damage);
    });
});
