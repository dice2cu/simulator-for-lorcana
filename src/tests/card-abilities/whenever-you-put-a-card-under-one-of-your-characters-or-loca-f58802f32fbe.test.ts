import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: f58802f32fbe
const abilityText = "Whenever you put a card under one of your characters or locations, you may pay 1 ⬡ to draw a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Webby's Diary",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("pays one ink and draws only when the actual tuck trigger is accepted (%s)", async (accept) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "HeiHei - Boat Snack"]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 1 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = playerAt(scenarioGame, 1).play[0].card,
            target = playerAt(scenarioGame, 1).play[1].card,
            [top, drawn] = playerAt(scenarioGame, 1).deck;
        await (async () => {
            if (accept === true) {
                const sourceDefinition = scenarioCards.definition(source.fullName);
                scenarioResolution = engine.startEffect(
                    scenarioGame,
                    {
                        type: "Move Card",
                        cards: { zone: "Deck", player: "You", position: "Top", take: 1 },
                        to: "Under",
                        under: { cards: [target] },
                        faceDown: true,
                    },
                    { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                    { card: scenarioCards.lookup },
                );
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        })
                        .on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Ink", amount: 1 }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(1);
                            return {
                                type: "Decision",
                                answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0]] }] },
                            };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            if (accept === false) {
                const sourceDefinition = scenarioCards.definition(source.fullName);
                scenarioResolution = engine.startEffect(
                    scenarioGame,
                    {
                        type: "Move Card",
                        cards: { zone: "Deck", player: "You", position: "Top", take: 1 },
                        to: "Under",
                        under: { cards: [target] },
                        faceDown: true,
                    },
                    { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                    { card: scenarioCards.lookup },
                );
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: false } };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            throw new Error("Unspecified script case");
        })();
        expect(playerAt(scenarioGame, 1).hand).toEqual(accept ? [drawn] : []);
        expect(playerAt(scenarioGame, 1).deck).toEqual(accept ? [] : [drawn]);
        expect(playerAt(scenarioGame, 1).inkwell.filter((ink) => ink.exerted)).toHaveLength(accept ? 1 : 0);
        expect(inPlay(scenarioRules(), target).under).toEqual([{ card: top, faceDown: true }]);
    });
});
