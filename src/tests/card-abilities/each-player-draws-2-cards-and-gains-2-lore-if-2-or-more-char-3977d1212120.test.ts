import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 3977d1212120
const abilityText =
    "Each player draws 2 cards and gains 2 lore. If 2 or more characters sang this song, ready them. They can't quest for the rest of this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "I2I",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 1, 2])("rewards both players and readies singers only when two or more sang (%s)", async (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(
            scenarioCards,
            [0, 1].map((index) => ({
                definition: {
                    fullName: "Singer " + index,
                    names: ["Singer " + index],
                    type: "Character" as const,
                    colors: ["Amber" as const],
                    subtypes: [],
                    cost: 9,
                    inkwell: false,
                    strength: 1,
                    willpower: 5,
                    lore: 1,
                },
                exerted: index >= count,
            })),
        );
        for (const id of [1, 2] as const)
            playerAt(scenarioGame, id).deck = cardIds(
                scenarioCards,
                Array.from({ length: 4 }, () => "Dinglehopper"),
            );
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 9 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = playerAt(scenarioGame, 1).hand[0];
        const [first, second] = playerAt(scenarioGame, 1).play.map((state) => state.card);
        const singers = [first, second].slice(0, count);
        const originals = ([1, 2] as const).map((id) => ({ id, deck: [...playerAt(scenarioGame, id).deck] }));
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
        for (const { id, deck } of originals) {
            expect(playerAt(scenarioGame, id).hand).toEqual(deck.slice(0, 2));
            expect(playerAt(scenarioGame, id).deck).toEqual(deck.slice(2));
            expect(playerAt(scenarioGame, id).lore).toBe(2);
        }
        expect(!inPlay(scenarioRules(), first).exerted).toBe(count >= 2);
        expect(!inPlay(scenarioRules(), second).exerted).toBe(count >= 2);
        const quests = (1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).filter(
            (action) => action.type === "Quest",
        );
        expect(quests.some((action) => action.type === "Quest" && singers.some((singer) => sameCard(action.card, singer)))).toBe(false);
    });
});
