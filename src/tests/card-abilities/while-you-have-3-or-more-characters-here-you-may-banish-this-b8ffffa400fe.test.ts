import * as engine from "../../engine/engine";
import { InvalidInput } from "../../engine/invalid-input";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/while-you-have-3-or-more-characters-here-you-may-banish-this-b8ffffa400fe.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: b8ffffa400fe
const abilityText = "While you have 3 or more characters here, you may banish this location to play a character from your discard for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Pride Lands - Jungle Oasis",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([2, 3])("requires three characters here, then banishes the location and plays from discard free (count: %s)", async (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            ...Array.from({ length: count }, (_, index) => ({
                definition: scenarioCards.fixture({
                    fullName: "Here " + index,
                    names: ["Here " + index],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            })),
        ]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Return Me",
                names: ["Return Me"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 8,
                inkwell: false,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
            scenarioCards.fixture({
                fullName: "Item",
                names: ["Item"],
                type: "Item",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
            }),
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 0 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const others = playerAt(scenarioGame, 1).play.slice(1);
        for (const card of others) card.location = source.card;
        const [returned, item] = playerAt(scenarioGame, 1).discard;
        const index = scenarioCards.definition(source.card.fullName).abilities?.findIndex((ability) => ability.type === "Activated") ?? -1;
        expect(index).toBeGreaterThanOrEqual(0);
        expect(
            await (async () => {
                if (count === 3) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) =>
                            action.player === 1 &&
                            ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source.card) && action.ability.i === index) ||
                                (action.type === "Boost" && action.ability === index && sameCard(action.card, source.card))),
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer()
                            .on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([{ type: "Banish", cards: { cards: [scenarioCards.instance(1)] } }]);
                                expect(request.ink[0].player).toBe(1);
                                expect(request.ink[0].cards).toHaveLength(0);
                                return {
                                    type: "Decision",
                                    answer: { type: "Pay Cost", pay: true, payment: [{ type: "Banish", player: 1, cards: [scenarioCards.instance(1)] }] },
                                };
                            })
                            .on("Choose Cards", (request) => {
                                expect(request.min).toBe(1);
                                expect(request.max).toBe(1);
                                return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(5)] } };
                            }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (count === 2) {
                    const action: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) =>
                            action.player === 1 &&
                            ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source.card) && action.ability.i === index) ||
                                (action.type === "Boost" && action.ability === index && sameCard(action.card, source.card))),
                    );
                    if (!action) return false;
                    try {
                        scenarioResolution = engine.startAction(scenarioGame, action, { card: scenarioCards.lookup });
                    } catch (error) {
                        if (error instanceof InvalidInput) return false;
                        throw error;
                    }
                    resolvePlayers(scenarioResolution, {});
                    scenarioGame = finished(scenarioResolution);
                    return true;
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(count === 3);
        expect(playerAt(scenarioGame, 1).play.map((ink) => ink.card)).toEqual(
            count === 3 ? [...others.map((state) => state.card), returned] : [source.card, ...others.map((state) => state.card)],
        );
        expect(playerAt(scenarioGame, 1).discard).toEqual(count === 3 ? [item, source.card] : [returned, item]);
        expect(playerAt(scenarioGame, 1).inkwell.map((ink) => ink.card)).toHaveLength(0);
    });
});
