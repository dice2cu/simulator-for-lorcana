import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/at-the-end-of-your-turn-if-this-character-is-exerted-and-you-1107c95b71c2.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 1107c95b71c2
const abilityText = "At the end of your turn, if this character is exerted and you don't have a Captain character in play, deal 1 damage to this character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mr. Smee - Bumbling Mate",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper"]);
        playerAt(scenarioGame, 2).deck = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper"]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: "Mr. Smee - Bumbling Mate", exerted: !false }]);
        const source = playerAt(scenarioGame, 1).play[0];
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
            const action: PlayerAction | undefined = { type: "Play", player: 1, card: scenarioCards.instance(6) };
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
        expect(inPlay(scenarioRules(), source.card).damage ?? 0).toBe(1);
    });
});
