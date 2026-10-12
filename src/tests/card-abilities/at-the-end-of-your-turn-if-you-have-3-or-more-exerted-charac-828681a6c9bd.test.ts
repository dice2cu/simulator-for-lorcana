import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: 828681a6c9bd
const abilityText =
    "At the end of your turn, if you have 3 or more exerted characters in play, deal 1 damage to chosen opposing character, gain 1 lore, and draw a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Elinor - Renowned Diplomat",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([2, 3])("requires three exerted characters at the actual turn end (%s)", async (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, ...Array(count).fill("HeiHei - Boat Snack")]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                fullName: "Enemy",
                names: ["Enemy"],
                type: "Character" as const,
                colors: [],
                subtypes: [],
                cost: 0,
                inkwell: false,
                strength: 0,
                willpower: 10,
                lore: 0,
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, Array(5).fill("Dinglehopper"));
        playerAt(scenarioGame, 2).deck = cardIds(scenarioCards, Array(5).fill("Dinglehopper"));
        const friends = playerAt(scenarioGame, 1)
                .play.slice(1)
                .map((state) => state.card),
            target = playerAt(scenarioGame, 2).play[0].card,
            drawn = playerAt(scenarioGame, 1).deck[0];
        await (async () => {
            if (count === 2) {
                const preparation = scenarioCards.create({
                    type: "Action",
                    fullName: "Test exertion action",
                    names: ["Test exertion action"],
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Exert", cards: { cards: friends } },
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
                const action: PlayerAction | undefined = { type: "Play", player: 1, card: scenarioCards.instance(15) };
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
            }
            if (count === 3) {
                const preparation = scenarioCards.create({
                    type: "Action",
                    fullName: "Test exertion action",
                    names: ["Test exertion action"],
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Exert", cards: { cards: friends } },
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
                const action: PlayerAction | undefined = { type: "Play", player: 1, card: scenarioCards.instance(16) };
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
            }
            throw new Error("Unspecified script case");
        })();
        await (async () => {
            if (count === 2) {
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
                return true;
            }
            if (count === 3) {
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = { type: "End Turn", player: 1 };
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer().on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(5)] } };
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
        expect(inPlay(scenarioRules(), target).damage ?? 0).toBe(count === 3 ? 1 : 0);
        expect(playerAt(scenarioGame, 1).lore).toBe(count === 3 ? 1 : 0);
        expect(playerAt(scenarioGame, 1).hand).toEqual(count === 3 ? [drawn] : []);
    });
});
