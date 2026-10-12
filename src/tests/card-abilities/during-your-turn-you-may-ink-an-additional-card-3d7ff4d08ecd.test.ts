import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/during-your-turn-you-may-ink-an-additional-card-3d7ff4d08ecd.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 3d7ff4d08ecd
const abilityText = "During your turn, you may ink an additional card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Belle - Strange but Special",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "First",
                names: ["First"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: true,
                effect: { type: "Sequence", effects: [] },
            }),
            scenarioCards.fixture({
                fullName: "Second",
                names: ["Second"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: true,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        // Choosing the second Ink action opts into the static permission.
        expect(
            await (async () => {
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
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = { type: "Ink" as const, player: 1, card: playerAt(scenarioGame, 1).hand[0] };
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {},
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                return true;
            })(),
        ).toBe(true);
        expect(
            await (async () => {
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = { type: "Ink" as const, player: 1, card: playerAt(scenarioGame, 1).hand[0] };
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {},
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                return true;
            })(),
        ).toBe(true); /* the second is the additional card */
        expect(playerAt(scenarioGame, 1).inkwell.map((ink) => ink.card)).toHaveLength(2);
    });
});
