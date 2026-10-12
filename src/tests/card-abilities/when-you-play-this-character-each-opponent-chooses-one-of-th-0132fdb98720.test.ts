import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/when-you-play-this-character-each-opponent-chooses-one-of-th-0132fdb98720.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 0132fdb98720
const abilityText =
    "When you play this character, each opponent chooses one of their characters and puts that card on the bottom of their deck. Then, each opponent may draw a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Kuzco - Impulsive Llama",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("each opponent bottoms their chosen character and independently may draw (%s)", async (draw) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Bottomed",
                    names: ["Bottomed"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Kept",
                    names: ["Kept"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        playerAt(scenarioGame, 2).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Remaining",
                    names: ["Remaining"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
                scenarioCards.fixture({
                    fullName: "Drawn",
                    names: ["Drawn"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ].reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        const [bottomed, kept] = playerAt(scenarioGame, 2).play;
        const [remaining, drawn] = [...playerAt(scenarioGame, 2).deck].reverse();
        await (async () => {
            if (draw === true) {
                const fixtureSource = playerAt(scenarioGame, 1).play[0].card;
                const position = playerAt(scenarioGame, 1);
                position.play = position.play.filter((state) => !sameCard(state.card, fixtureSource));
                position.hand.push(fixtureSource);
                position.inkwell.push(
                    ...Array.from({ length: scenarioCards.definition(fixtureSource.fullName).cost }, () => ({
                        card: scenarioCards.create("Dinglehopper"),
                        exerted: false,
                    })),
                );
                const action0: PlayerAction | undefined = { type: "Play", player: 1, card: scenarioCards.instance(1) };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
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
                    2: new ScriptedPlayer()
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                        })
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            if (draw === false) {
                const fixtureSource = playerAt(scenarioGame, 1).play[0].card;
                const position = playerAt(scenarioGame, 1);
                position.play = position.play.filter((state) => !sameCard(state.card, fixtureSource));
                position.hand.push(fixtureSource);
                position.inkwell.push(
                    ...Array.from({ length: scenarioCards.definition(fixtureSource.fullName).cost }, () => ({
                        card: scenarioCards.create("Dinglehopper"),
                        exerted: false,
                    })),
                );
                const action0: PlayerAction | undefined = { type: "Play", player: 1, card: scenarioCards.instance(1) };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
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
                    2: new ScriptedPlayer()
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                        })
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: false } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            throw new Error("Unspecified script case");
        })();
        expect(playerAt(scenarioGame, 2).play.map((ink) => ink.card)).toEqual([kept.card]);
        expect(playerAt(scenarioGame, 2).hand).toEqual(draw ? [drawn] : []);
        expect([...playerAt(scenarioGame, 2).deck].reverse()).toEqual(draw ? [bottomed.card, remaining] : [bottomed.card, remaining, drawn]);
        expect(playerAt(scenarioGame, 1).hand).toEqual([]);
        expect(playerAt(scenarioGame, 2).discard).toEqual([]);
    });
});
