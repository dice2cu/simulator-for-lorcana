import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: 326c8f0b1eed
const abilityText = "If a character was banished this turn, draw 2 cards.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Marching Off to Battle",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("draws two only after a real banishment in the same turn (%s)", async (banished) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                fullName: "Foe",
                names: ["Foe"],
                type: "Character" as const,
                colors: [],
                subtypes: [],
                cost: 0,
                inkwell: false,
                strength: 4,
                willpower: 10,
                lore: 0,
            },
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            prototypeCardName,
            {
                ...{
                    fullName: "Preparation",
                    names: ["Preparation"] as const,
                    type: "Action" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Gain Lore" as const, player: "You" as const, amount: 0 },
                },
                effect: { type: "Banish", cards: { zone: "Play", player: "Opponents" } },
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, Array(4).fill("Dinglehopper"));
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: scenarioCards.definition(prototypeCardName).cost }, () => ({
            card: scenarioCards.create("Dinglehopper"),
            exerted: false,
        }));
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
        const deck = [...playerAt(scenarioGame, 1).deck];
        if (banished)
            expect(
                await (async () => {
                    if (!scenarioLive) throw new Error("No live turn");
                    scenarioResolution = scenarioLive;
                    const action: PlayerAction | undefined = (
                        scenarioLive?.request?.type === "Action" ? scenarioLive.request.actions : getLegalActions(scenarioGame, { card: scenarioCards.lookup })
                    ).find((action) => action.type === "Play" && action.player === 1 && action.card.fullName === "Preparation");
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
                const action: PlayerAction | undefined = (
                    scenarioLive?.request?.type === "Action" ? scenarioLive.request.actions : getLegalActions(scenarioGame, { card: scenarioCards.lookup })
                ).find((action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName);
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer().on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Ink", amount: 4 }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(4);
                            return {
                                type: "Decision",
                                answer: {
                                    type: "Pay Cost",
                                    pay: true,
                                    payment: [
                                        {
                                            type: "Ink",
                                            player: 1,
                                            cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2], request.ink[0].cards[3]],
                                        },
                                    ],
                                },
                            };
                        }),
                    },
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand.filter((card) => card.fullName === "Dinglehopper")).toEqual(banished ? deck.slice(0, 2) : []);
        expect(playerAt(scenarioGame, 1).deck).toEqual(banished ? deck.slice(2) : deck);
    });
});
