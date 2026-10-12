import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/if-this-is-your-first-turn-and-you-re-not-the-first-player-y-554f19fcd1d0.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 554f19fcd1d0
const abilityText = "If this is your first turn and you're not the first player, you pay 1 ⬡ less to play this character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Christopher Robin - Joining the Fun",
    "Angel - Siren Singer",
    "Judy Hopps - Snowball Patrol",
    "Liquidator - Iced Over",
    "Splatter Phoenix - Rejected Artist",
    "White Rabbit - Late Again",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, [prototypeCardName]);
        const p = playerAt(scenarioGame, 2),
            s = p.hand[0];
        scenarioGame.turn = { number: 2, player: 2 };
        // Player 1 has completed the first turn, but this is player 2's first.
        playerAt(scenarioGame, 1).turnsTaken = 1;
        const printedCost = scenarioRules().characteristic(s, "Cost", true);
        playerAt(scenarioGame, 2).inkwell = Array.from({ length: printedCost - 1 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        expect(scenarioRules().cost(s)).toBe(printedCost - 1);
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Play", player: 2, card: s };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    2: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 1 }]);
                        expect(request.ink[0].player).toBe(2);
                        expect(request.ink[0].cards).toHaveLength(1);
                        return {
                            type: "Decision",
                            answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 2, cards: [request.ink[0].cards[0]] }] },
                        };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 2).inkwell.filter((ink) => !ink.exerted)).toHaveLength(0);
    });
});
