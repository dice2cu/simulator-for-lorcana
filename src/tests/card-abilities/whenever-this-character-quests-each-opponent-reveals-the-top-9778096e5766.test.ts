import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: 9778096e5766
const abilityText =
    "Whenever this character quests, each opponent reveals the top card of their deck. If it's a character card, they may put it into their hand. Otherwise, they put it on the bottom of their deck.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Daisy Duck - Donald's Date",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([1, 2] as const)("offers the revealed character to the opposing player (seat %s)", async (player) => {
        const other = player === 1 ? 2 : 1;
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        scenarioGame.turn = { number: scenarioGame.turn.number, player: player };
        playerAt(scenarioGame, player).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, other).deck = cardIds(scenarioCards, ["Lilo - Making a Wish", "Pawpsicle"]);
        const source = playerAt(scenarioGame, player).play[0].card,
            [revealed, bottom] = playerAt(scenarioGame, other).deck;
        expect(
            await (async () => {
                if (player === 1) {
                    const action0: PlayerAction | undefined = { type: "Quest", player, card: source };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        2: new ScriptedPlayer().on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                    return true;
                }
                if (player === 2) {
                    const action0: PlayerAction | undefined = { type: "Quest", player, card: source };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer().on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, other).hand).toEqual([revealed]);
        expect(playerAt(scenarioGame, other).deck).toEqual([bottom]);
        expect(playerAt(scenarioGame, player).lore).toBe(2);
        expect(scenarioResolution?.observations ?? []).toContainEqual({ type: "Reveal", cards: [revealed] });
    });
    it.each([1, 2] as const)("bottoms the non-character and draws the next card on the actual next turn (seat %s)", async (player) => {
        const other = player === 1 ? 2 : 1;
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        scenarioGame.turn = { number: scenarioGame.turn.number, player: player };
        playerAt(scenarioGame, player).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, player).deck = cardIds(scenarioCards, ["Pawpsicle", "Pawpsicle"]);
        playerAt(scenarioGame, other).deck = cardIds(scenarioCards, ["Pawpsicle", "Cinderella - Ballroom Sensation", "Lilo - Making a Wish"]);
        const source = playerAt(scenarioGame, player).play[0].card,
            [top, next, bottom] = playerAt(scenarioGame, other).deck;
        {
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
        }
        expect(
            await (async () => {
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = { type: "Quest", player, card: source };
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
        expect(playerAt(scenarioGame, other).hand).toEqual([]);
        expect(playerAt(scenarioGame, other).deck).toEqual([next, bottom, top]);
        await (async () => {
            if (player === 2) {
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = { type: "End Turn", player: 2 };
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
                return true;
            }
            if (player === 1) {
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
                return true;
            }
            throw new Error("Unspecified script case");
        })();
        expect(playerAt(scenarioGame, other).hand).toEqual([next]);
        expect(playerAt(scenarioGame, other).deck).toEqual([bottom, top]);
    });
});
