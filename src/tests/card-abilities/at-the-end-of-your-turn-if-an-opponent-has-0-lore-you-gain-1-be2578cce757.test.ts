import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/at-the-end-of-your-turn-if-an-opponent-has-0-lore-you-gain-1-be2578cce757.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: be2578cce757
const abilityText = "At the end of your turn, if an opponent has 0 lore, you gain 1 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Scrooge McDuck - Ebenezer Scrooge",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper"]);
        playerAt(scenarioGame, 2).deck = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper"]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: "Scrooge McDuck - Ebenezer Scrooge", exerted: !false }]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 2 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        playerAt(scenarioGame, 1).inkwell.forEach((card) => {
            card.exerted = !false;
        });
        playerAt(scenarioGame, 2).lore = 0;
        const player = playerAt(scenarioGame, 1);
        {
            const preparation = scenarioCards.create({
                type: "Action",
                fullName: "Test exertion action",
                names: ["Test exertion action"],
                colors: [],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: {
                    type: "Exert",
                    cards: {
                        cards: [
                            ...playerAt(scenarioGame, 1)
                                .play.filter((card) => card.exerted)
                                .map((card) => card.card),
                            ...playerAt(scenarioGame, 1)
                                .inkwell.filter((card) => card.exerted)
                                .map((card) => card.card),
                        ],
                    },
                },
            });
            playerAt(scenarioGame, 1).hand.push(preparation);
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
            const action: PlayerAction | undefined = { type: "Play", player: 1, card: scenarioCards.instance(8) };
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
        }
        {
            if (!scenarioLive) throw new Error("No live turn");
            scenarioResolution = scenarioLive;
            const action: PlayerAction | undefined = { type: "End Turn", player: 1 };
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
        }
        expect(playerAt(scenarioGame, 1).lore).toBe(1);
    });
});
