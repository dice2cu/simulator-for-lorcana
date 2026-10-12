import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: e6d7cd116f41
const abilityText =
    "When you play this character, you may shuffle chosen opposing character into their player's deck. If you do, that player may play a character from their discard for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Chernabog - Unnatural Force",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("shuffles the target and lets its owner choose a free discard play (%s)", async (replay) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                fullName: "Target",
                names: ["Target"],
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
        playerAt(scenarioGame, 2).discard = cardIds(scenarioCards, [
            {
                ...{
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 4,
                    willpower: 10,
                    lore: 0,
                },
                fullName: "Returned",
                cost: 8,
            },
            "Dinglehopper",
        ]);
        playerAt(scenarioGame, 2).deck = cardIds(scenarioCards, ["Dinglehopper"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 5 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const shuffled = playerAt(scenarioGame, 2).play[0].card,
            [returned, item] = playerAt(scenarioGame, 2).discard,
            existing = playerAt(scenarioGame, 2).deck[0];
        expect(
            await (async () => {
                if (replay === true) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(
                        scenarioResolution,
                        {
                            1: new ScriptedPlayer()
                                .on("Pay Cost", (request) => {
                                    expect(request.optional).toBe(false);
                                    expect(request.cost).toEqual([{ type: "Ink", amount: 5 }]);
                                    expect(request.ink[0].player).toBe(1);
                                    expect(request.ink[0].cards).toHaveLength(5);
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
                                    expect(request.min).toBe(1);
                                    expect(request.max).toBe(1);
                                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                                }),
                            2: new ScriptedPlayer()
                                .on("Optional", (request) => {
                                    return { type: "Decision", answer: { type: "Optional", accept: true } };
                                })
                                .on("Choose Cards", (request) => {
                                    expect(request.min).toBe(1);
                                    expect(request.max).toBe(1);
                                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                                }),
                        },
                        {
                            random: [{ type: "Shuffle", cards: [scenarioCards.instance(2), scenarioCards.instance(5)] }],
                        },
                    );
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (replay === false) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(
                        scenarioResolution,
                        {
                            1: new ScriptedPlayer()
                                .on("Pay Cost", (request) => {
                                    expect(request.optional).toBe(false);
                                    expect(request.cost).toEqual([{ type: "Ink", amount: 5 }]);
                                    expect(request.ink[0].player).toBe(1);
                                    expect(request.ink[0].cards).toHaveLength(5);
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
                                    expect(request.min).toBe(1);
                                    expect(request.max).toBe(1);
                                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                                }),
                            2: new ScriptedPlayer().on("Optional", (request) => {
                                return { type: "Decision", answer: { type: "Optional", accept: false } };
                            }),
                        },
                        {
                            random: [{ type: "Shuffle", cards: [scenarioCards.instance(2), scenarioCards.instance(5)] }],
                        },
                    );
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 2).play.map((state) => state.card)).toEqual(replay ? [returned] : []);
        expect(playerAt(scenarioGame, 2).discard).toEqual(replay ? [item] : [returned, item]);
        expect(playerAt(scenarioGame, 2).deck).toHaveLength(2);
        expect(playerAt(scenarioGame, 2).deck).toEqual(expect.arrayContaining([shuffled, existing]));
        expect(playerAt(scenarioGame, 2).inkwell).toEqual([]);
    });
});
