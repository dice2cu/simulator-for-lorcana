import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/if-an-opposing-character-was-banished-in-a-challenge-this-tu-0a097006154c.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 0a097006154c
const abilityText = "If an opposing character was banished in a challenge this turn, draw 2 cards.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Card Advantage",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("requires the specified banishment this turn before drawing two (%s)", async (banished) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Banisher",
                    names: ["Banisher"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 1,
                    willpower: 3,
                    lore: 0,
                }),
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(
            scenarioCards,
            [
                {
                    definition: scenarioCards.fixture({
                        fullName: "Victim",
                        names: ["Victim"],
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
            ],
            !false,
        );
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            Array.from({ length: 4 }, (_, index) =>
                scenarioCards.fixture({
                    fullName: "Draw " + index,
                    names: ["Draw " + index],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ).reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 2 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = playerAt(scenarioGame, 1).hand[0];
        const deck = [...[...playerAt(scenarioGame, 1).deck].reverse()];
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
        if (banished)
            expect(
                await (async () => {
                    if (!scenarioLive) throw new Error("No live turn");
                    scenarioResolution = scenarioLive;
                    const action: PlayerAction | undefined = {
                        type: "Challenge",
                        player: 1,
                        attacker: playerAt(scenarioGame, 1).play[0].card,
                        defender: playerAt(scenarioGame, 2).play[0].card,
                    };
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
                const action: PlayerAction | undefined = { type: "Play", player: 1, card: source };
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer().on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Ink", amount: 2 }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(2);
                            return {
                                type: "Decision",
                                answer: {
                                    type: "Pay Cost",
                                    pay: true,
                                    payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1]] }],
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
        expect(playerAt(scenarioGame, 1).hand).toEqual(banished ? deck.slice(-2).reverse() : []);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(banished ? deck.slice(0, 2) : deck);
    });
});
