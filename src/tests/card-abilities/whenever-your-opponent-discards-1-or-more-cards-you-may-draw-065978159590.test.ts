import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: 065978159590
const abilityText = "Whenever your opponent discards 1 or more cards, you may draw a card for each card discarded.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Prince John - Greediest of All",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([1, 2])("draws exactly once for each card an opponent actually discards (%s)", async (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).hand = cardIds(
            scenarioCards,
            Array.from({ length: count + 1 }, () => "Dinglehopper"),
        );
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            Array.from({ length: 4 }, () => "Dinglehopper"),
        );
        const source = playerAt(scenarioGame, 1).play[0].card;
        const chosen = playerAt(scenarioGame, 2).hand.slice(0, count);
        const kept = playerAt(scenarioGame, 2).hand[count];
        const deck = [...playerAt(scenarioGame, 1).deck];
        await (async () => {
            if (count === 1) {
                const sourceDefinition = scenarioCards.definition(source.fullName);
                scenarioResolution = engine.startEffect(
                    scenarioGame,
                    {
                        type: "Choose Cards",
                        from: { player: "You", zone: "Hand" },
                        count,
                        effect: { type: "Discard", cards: "Selected Cards" },
                    },
                    { card: source, player: 2, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                    { card: scenarioCards.lookup },
                );
                resolvePlayers(scenarioResolution, {
                    2: new ScriptedPlayer().on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    }),
                    1: new ScriptedPlayer().on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            if (count === 2) {
                const sourceDefinition = scenarioCards.definition(source.fullName);
                scenarioResolution = engine.startEffect(
                    scenarioGame,
                    {
                        type: "Choose Cards",
                        from: { player: "You", zone: "Hand" },
                        count,
                        effect: { type: "Discard", cards: "Selected Cards" },
                    },
                    { card: source, player: 2, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                    { card: scenarioCards.lookup },
                );
                resolvePlayers(scenarioResolution, {
                    2: new ScriptedPlayer().on("Choose Cards", (request) => {
                        expect(request.min).toBe(2);
                        expect(request.max).toBe(2);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2), scenarioCards.instance(3)] } };
                    }),
                    1: new ScriptedPlayer()
                        .on("Choose Trigger", (request) => {
                            const expected = {
                                player: 1,
                                source: { card: scenarioCards.instance(1), player: 1, kind: "Ability" },
                                effect: { type: "Optional", effect: { type: "Draw", player: "You", amount: 1 } },
                            };
                            const options = request.options.filter(({ option, ...description }) => JSON.stringify(description) === JSON.stringify(expected));
                            expect(options).toHaveLength(2);
                            return { type: "Decision", answer: { type: "Choose Trigger", option: options[0].option } };
                        })
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        })
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            throw new Error("Unspecified script case");
        })();
        expect(playerAt(scenarioGame, 2).hand).toEqual([kept]);
        expect(playerAt(scenarioGame, 2).discard).toEqual(chosen);
        expect(playerAt(scenarioGame, 1).hand).toEqual(deck.slice(0, count));
        expect(playerAt(scenarioGame, 1).deck).toEqual(deck.slice(count));
    });
});
