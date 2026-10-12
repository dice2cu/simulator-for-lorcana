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
// Generated ability ID: e57316123932
const abilityText = "Your characters gain “⟳, 1 ⬡ — Deal 1 damage to chosen character” this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Food Fight!",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("grants an activated ability that pays exertion and ink to deal one damage", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, ["HeiHei - Boat Snack"]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                ...{
                    fullName: "Victim",
                    names: ["Victim"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                },
                willpower: 10,
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 2 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const ally = playerAt(scenarioGame, 1).play[0].card,
            target = playerAt(scenarioGame, 2).play[0].card;
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 1 }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(2);
                        return {
                            type: "Decision",
                            answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0]] }] },
                        };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        const action = (scenarioGame.turn.player !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).find(
            (action) => action.type === "Activate" && "card" in action && action.card.i === ally.i,
        );
        if (!action) throw new Error("Granted ability is not usable");
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = action;
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([
                                { type: "Exert", cards: { cards: [scenarioCards.instance(2)] } },
                                { type: "Ink", amount: 1 },
                            ]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(1);
                            return {
                                type: "Decision",
                                answer: {
                                    type: "Pay Cost",
                                    pay: true,
                                    payment: [
                                        { type: "Exert", player: 1, cards: [scenarioCards.instance(2)] },
                                        { type: "Ink", player: 1, cards: [request.ink[0].cards[0]] },
                                    ],
                                },
                            };
                        })
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(inPlay(scenarioRules(), target).damage).toBe(1);
        expect(inPlay(scenarioRules(), ally).exerted).toBe(true);
        expect(playerAt(scenarioGame, 1).inkwell.every((ink) => ink.exerted)).toBe(true);
    });
});
