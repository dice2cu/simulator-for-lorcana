import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: e8791184f4a5
const abilityText =
    "Temporary Shift 7 ⬡ (You may pay 7 ⬡ to play this on top of one of your characters named Ming Lee. At the end of your turn, remove all damage from this character and return only this card to your hand.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Ming Lee - Giant Red Panda",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("heals the shifted stack at turn end and returns only the top card", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        const definition = scenarioCards.definition(prototypeCardName);
        if (definition.type !== "Character") throw new Error("Expected a character");
        const shift = definition.abilities?.find((ability) => ability.type === "Keyword" && ability.keyword.name === "Shift");
        if (!shift || shift.type !== "Keyword" || shift.keyword.name !== "Shift") throw new Error("Expected Shift");
        const cost = shift.keyword.cost.reduce((total, cost) => {
            if (cost.type !== "Ink" || typeof cost.amount !== "number") throw new Error("Expected an ink cost");
            return total + cost.amount;
        }, 0);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: {
                    fullName: "Shift Base",
                    names: definition.names,
                    type: "Character",
                    colors: definition.colors,
                    subtypes: ["Red Panda"],
                    cost: 0,
                    inkwell: false,
                    strength: 1,
                    willpower: 8,
                    lore: 0,
                },
                damage: 3,
            },
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: cost }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const base = playerAt(scenarioGame, 1).play[0].card;
        const shifter = playerAt(scenarioGame, 1).hand[0];
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
                const action: PlayerAction | undefined = (
                    scenarioLive?.request?.type === "Action" ? scenarioLive.request.actions : getLegalActions(scenarioGame, { card: scenarioCards.lookup })
                ).find(
                    (action) =>
                        action.type === "Shift" &&
                        action.player === 1 &&
                        sameCard(action.card, shifter) &&
                        action.onto.length === 1 &&
                        sameCard(action.onto[0], base),
                );
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer().on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Ink", amount: 7 }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(7);
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
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).play.map((state) => state.card)).toContainEqual(shifter);
        expect(inPlay(scenarioRules(), shifter).under?.map((entry) => entry.card)).toContainEqual(base);
        expect(inPlay(scenarioRules(), shifter).damage).toBe(3);
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
        expect(playerAt(scenarioGame, 1).hand).toContainEqual(shifter);
        expect(playerAt(scenarioGame, 1).play.map((state) => state.card)).toContainEqual(base);
        expect(inPlay(scenarioRules(), base).damage ?? 0).toBe(0);
    });
});
