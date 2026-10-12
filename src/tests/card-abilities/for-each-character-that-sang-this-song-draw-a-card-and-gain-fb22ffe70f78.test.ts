import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: fb22ffe70f78
const abilityText = "For each character that sang this song, draw a card and gain 1 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Fantastical and Magical",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 1, 2])("draws and gains lore once per actual singer (%s)", async (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(
            scenarioCards,
            Array.from({ length: count }, (_, index) =>
                scenarioCards.fixture({
                    fullName: "Singer " + index,
                    names: ["Singer " + index],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 9,
                    inkwell: false,
                    strength: 1,
                    willpower: 5,
                    lore: 0,
                }),
            ),
        );
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            Array.from({ length: 5 }, () => "Dinglehopper"),
        );
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: scenarioCards.definition(prototypeCardName).cost }, () => ({
            card: scenarioCards.create("Dinglehopper"),
            exerted: false,
        }));
        const source = playerAt(scenarioGame, 1).hand[0];
        const singers = playerAt(scenarioGame, 1).play.map((state) => state.card);
        const deck = [...playerAt(scenarioGame, 1).deck];
        expect(
            await (async () => {
                if (count === 2) {
                    const action0: PlayerAction | undefined = count
                        ? { type: "Sing", player: 1, song: source, singers }
                        : { type: "Play", player: 1, card: source };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {});
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (count === 0) {
                    const action0: PlayerAction | undefined = count
                        ? { type: "Sing", player: 1, song: source, singers }
                        : { type: "Play", player: 1, card: source };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer().on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Ink", amount: 9 }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(9);
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
                                            ],
                                        },
                                    ],
                                },
                            };
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (count === 1) {
                    const action0: PlayerAction | undefined = count
                        ? { type: "Sing", player: 1, song: source, singers }
                        : { type: "Play", player: 1, card: source };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {});
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).lore).toBe(count);
        expect(playerAt(scenarioGame, 1).hand).toEqual(deck.slice(0, count));
        expect(playerAt(scenarioGame, 1).deck).toEqual(deck.slice(count));
    });
});
