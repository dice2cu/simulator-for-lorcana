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
// Generated ability ID: 8ffd4ae65e0e
const abilityText =
    "Name a card, then reveal the top card of your deck. If it's the named card, put it into your hand and gain 3 lore. Otherwise, put it on the top of your deck.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Bruno Madrigal - Undetected Uncle",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("uses the named-card answer in the printed activation (%s)", async (matches) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper"]);
        const source = playerAt(scenarioGame, 1).play[0].card,
            top = playerAt(scenarioGame, 1).deck[0];
        expect(
            await (async () => {
                if (matches === false) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) =>
                            action.player === 1 &&
                            ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source) && action.ability.i === 1) ||
                                (action.type === "Boost" && action.ability === 1 && sameCard(action.card, source))),
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer()
                            .on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Exert", cards: { cards: [scenarioCards.instance(1)] } }]);
                                expect(request.ink[0].player).toBe(1);
                                expect(request.ink[0].cards).toHaveLength(0);
                                return {
                                    type: "Decision",
                                    answer: { type: "Pay Cost", pay: true, payment: [{ type: "Exert", player: 1, cards: [scenarioCards.instance(1)] }] },
                                };
                            })
                            .on("Name Card", (request) => {
                                return { type: "Decision", answer: { type: "Name Card", name: "Pawpsicle" } };
                            }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (matches === true) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) =>
                            action.player === 1 &&
                            ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source) && action.ability.i === 1) ||
                                (action.type === "Boost" && action.ability === 1 && sameCard(action.card, source))),
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer()
                            .on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Exert", cards: { cards: [scenarioCards.instance(1)] } }]);
                                expect(request.ink[0].player).toBe(1);
                                expect(request.ink[0].cards).toHaveLength(0);
                                return {
                                    type: "Decision",
                                    answer: { type: "Pay Cost", pay: true, payment: [{ type: "Exert", player: 1, cards: [scenarioCards.instance(1)] }] },
                                };
                            })
                            .on("Name Card", (request) => {
                                return { type: "Decision", answer: { type: "Name Card", name: "Dinglehopper" } };
                            }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toEqual(matches ? [top] : []);
        expect(playerAt(scenarioGame, 1).deck).toEqual(matches ? [] : [top]);
        expect(playerAt(scenarioGame, 1).lore).toBe(matches ? 3 : 0);
        expect(inPlay(scenarioRules(), source).exerted).toBe(true);
    });
});
