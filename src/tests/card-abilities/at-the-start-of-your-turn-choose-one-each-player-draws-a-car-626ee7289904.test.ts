import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: 626ee7289904
const abilityText = "At the start of your turn, choose one: • Each player draws a card. • Each player chooses and discards a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Kuzco - Panicked Llama",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 1])("applies the selected mode during the real turn-start step (%s)", async (mode) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        for (const player of [1, 2] as const) {
            playerAt(scenarioGame, player).hand = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper"]);
            playerAt(scenarioGame, player).deck = cardIds(scenarioCards, ["Dinglehopper"]);
        }
        const snapshots = ([1, 2] as const).map((player) => ({
            player,
            hand: [...playerAt(scenarioGame, player).hand],
            drawn: playerAt(scenarioGame, player).deck[0],
        }));
        if (mode === 1) {
        }
        await (async () => {
            if (mode === 1) {
                scenarioLive = engine.startTurn(scenarioGame, { card: scenarioCards.lookup });
                scenarioResolution = scenarioLive;
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer()
                            .on("Choose Mode", (request) => {
                                expect(request.options).toHaveLength(2);
                                return { type: "Decision", answer: { type: "Choose Mode", mode: 1 } };
                            })
                            .on("Choose Cards", (request) => {
                                expect(request.min).toBe(1);
                                expect(request.max).toBe(1);
                                return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                            }),
                        2: new ScriptedPlayer().on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(6)] } };
                        }),
                    },
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                return true;
            }
            if (mode === 0) {
                scenarioLive = engine.startTurn(scenarioGame, { card: scenarioCards.lookup });
                scenarioResolution = scenarioLive;
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer().on("Choose Mode", (request) => {
                            expect(request.options).toHaveLength(2);
                            return { type: "Decision", answer: { type: "Choose Mode", mode: 0 } };
                        }),
                    },
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                return true;
            }
            throw new Error("Unspecified script case");
        })();
        for (const { player, hand, drawn } of snapshots) {
            expect(playerAt(scenarioGame, player).hand).toEqual(mode === 0 ? [...hand, drawn] : [hand[0]]);
            expect(playerAt(scenarioGame, player).discard).toEqual(mode === 0 ? [] : [hand[1]]);
            expect(playerAt(scenarioGame, player).deck).toEqual(mode === 0 ? [] : [drawn]);
        }
    });
});
