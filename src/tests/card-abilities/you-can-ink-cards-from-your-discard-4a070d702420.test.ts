import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/you-can-ink-cards-from-your-discard-4a070d702420.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 4a070d702420
const abilityText = "You can ink cards from your discard.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Moana - Curious Explorer",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Ink Candidate",
                names: ["Ink Candidate"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: true,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
        ]);
        const player = playerAt(scenarioGame, 1);
        const candidate = playerAt(scenarioGame, 1).discard[0];
        expect(
            1 !== scenarioGame.turn.player
                ? []
                : scenarioLive?.request?.type === "Action"
                  ? scenarioLive.request.actions
                  : getLegalActions(scenarioGame, { card: scenarioCards.lookup }),
        ).toContainEqual(expect.objectContaining({ type: "Ink", card: candidate }));
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
                const action: PlayerAction | undefined = { type: "Ink" as const, player: 1, card: candidate };
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
        expect(playerAt(scenarioGame, 1).inkwell.map((entry) => entry.card)).toContainEqual(candidate);
        expect(playerAt(scenarioGame, 1).discard).not.toContainEqual(candidate);
    });
});
