import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: ead4b7f689d6
const abilityText =
    "When you play this character, if 2 or more cards were put into your discard this turn, you may banish any number of chosen opposing characters with total ¤ 10 or less.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Leviathan - Guardian of Atlantis",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([1, 2])("requires two real discard entries before the play trigger (%s)", async (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            prototypeCardName,
            ...Array.from({ length: count }, () => ({
                fullName: "Preparation",
                names: ["Preparation"] as const,
                type: "Action" as const,
                colors: [],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: { type: "Gain Lore" as const, player: "You" as const, amount: 0 },
            })),
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: scenarioCards.definition(prototypeCardName).cost }, () => ({
            card: scenarioCards.create("Dinglehopper"),
            exerted: false,
        }));
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                ...{
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
                fullName: "Four",
                names: ["Four"],
                strength: 4,
            },
            {
                ...{
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
                fullName: "Six",
                names: ["Six"],
                strength: 6,
            },
            {
                ...{
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
                fullName: "Eleven",
                names: ["Eleven"],
                strength: 11,
            },
        ]);
        const [four, six, eleven] = playerAt(scenarioGame, 2).play;
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
        for (let i = 0; i < count; i++)
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
                if (count === 1) {
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
                                expect(request.cost).toEqual([{ type: "Ink", amount: 10 }]);
                                expect(request.ink[0].player).toBe(1);
                                expect(request.ink[0].cards).toHaveLength(10);
                                return {
                                    type: "Decision",
                                    answer: {
                                        type: "Pay Cost",
                                        pay: true,
                                        payment: [
                                            {
                                                type: "Ink",
                                                player: 1,
                                                cards: [
                                                    request.ink[0].cards[0],
                                                    request.ink[0].cards[1],
                                                    request.ink[0].cards[2],
                                                    request.ink[0].cards[3],
                                                    request.ink[0].cards[4],
                                                    request.ink[0].cards[5],
                                                    request.ink[0].cards[6],
                                                    request.ink[0].cards[7],
                                                    request.ink[0].cards[8],
                                                    request.ink[0].cards[9],
                                                ],
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
                }
                if (count === 2) {
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
                            1: new ScriptedPlayer()
                                .on("Pay Cost", (request) => {
                                    expect(request.optional).toBe(false);
                                    expect(request.cost).toEqual([{ type: "Ink", amount: 10 }]);
                                    expect(request.ink[0].player).toBe(1);
                                    expect(request.ink[0].cards).toHaveLength(10);
                                    return {
                                        type: "Decision",
                                        answer: {
                                            type: "Pay Cost",
                                            pay: true,
                                            payment: [
                                                {
                                                    type: "Ink",
                                                    player: 1,
                                                    cards: [
                                                        request.ink[0].cards[0],
                                                        request.ink[0].cards[1],
                                                        request.ink[0].cards[2],
                                                        request.ink[0].cards[3],
                                                        request.ink[0].cards[4],
                                                        request.ink[0].cards[5],
                                                        request.ink[0].cards[6],
                                                        request.ink[0].cards[7],
                                                        request.ink[0].cards[8],
                                                        request.ink[0].cards[9],
                                                    ],
                                                },
                                            ],
                                        },
                                    };
                                })
                                .on("Optional", (request) => {
                                    return { type: "Decision", answer: { type: "Optional", accept: true } };
                                })
                                .on("Choose Cards", (request) => {
                                    expect(request.min).toBe(0);
                                    expect(request.max).toBe(3);
                                    return {
                                        type: "Decision",
                                        answer: { type: "Choose Cards", cards: [scenarioCards.instance(15), scenarioCards.instance(16)] },
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
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 2).play).toEqual(count === 2 ? [eleven] : [four, six, eleven]);
        expect(playerAt(scenarioGame, 2).discard).toEqual(count === 2 ? [four.card, six.card] : []);
        expect(playerAt(scenarioGame, 1).play).toHaveLength(1);
    });
});
