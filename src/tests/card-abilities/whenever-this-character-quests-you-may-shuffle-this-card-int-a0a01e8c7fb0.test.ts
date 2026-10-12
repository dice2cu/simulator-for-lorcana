import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-this-character-quests-you-may-shuffle-this-card-int-a0a01e8c7fb0.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: a0a01e8c7fb0
const abilityText = "Whenever this character quests, you may shuffle this card into your deck to draw 3 cards.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Genie - Supportive Friend",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("shuffles itself before drawing three only if accepted (%s)", async (accept) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            Array.from({ length: 5 }, (_, index) =>
                scenarioCards.fixture({
                    fullName: "Deck " + index,
                    names: ["Deck " + index],
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
        const source = playerAt(scenarioGame, 1).play[0];
        const deck = [...[...playerAt(scenarioGame, 1).deck].reverse()];
        await (async () => {
            if (accept === false) {
                const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: false } };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            if (accept === true) {
                const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer().on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        }),
                    },
                    {
                        random: [
                            {
                                type: "Shuffle",
                                cards: [
                                    scenarioCards.instance(6),
                                    scenarioCards.instance(2),
                                    scenarioCards.instance(5),
                                    scenarioCards.instance(4),
                                    scenarioCards.instance(1),
                                    scenarioCards.instance(3),
                                ],
                            },
                        ],
                    },
                );
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            throw new Error("Unspecified script case");
        })();
        expect(playerAt(scenarioGame, 1).play.map((ink) => ink.card)).toEqual(accept ? [] : [source.card]);
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(accept ? 3 : 0);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toHaveLength(accept ? 3 : 5);
        expect([...[...playerAt(scenarioGame, 1).deck].reverse(), ...playerAt(scenarioGame, 1).hand]).toEqual(
            expect.arrayContaining(accept ? [...deck, source.card] : deck),
        );
        expect(playerAt(scenarioGame, 1).discard).toEqual([]);
    });
});
