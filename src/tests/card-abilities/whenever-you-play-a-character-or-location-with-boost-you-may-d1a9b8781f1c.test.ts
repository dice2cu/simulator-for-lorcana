import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: d1a9b8781f1c
const abilityText = "Whenever you play a character or location with Boost, you may put the top card of your deck facedown under them.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Scrooge McDuck - Cavern Prospector",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each(["Character", "Location"] as const)("tucks the real top card under the played Boost %s", async (type) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const facts = {
            fullName: "Boost Target",
            names: ["Boost Target"] as const,
            colors: [] as const,
            subtypes: [],
            cost: 1,
            inkwell: false,
            abilities: [{ type: "Keyword" as const, keyword: { name: "Boost" as const, cost: [{ type: "Ink" as const, amount: 1 }] } }],
        };
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            type === "Character" ? { ...facts, type, strength: 1, willpower: 5, lore: 0 } : { ...facts, type, moveCost: 2, willpower: 5, lore: 0 },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 1 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const target = playerAt(scenarioGame, 1).hand[0],
            top = playerAt(scenarioGame, 1).deck[0];
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && action.card.fullName === target.fullName,
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Ink", amount: 1 }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(1);
                            return {
                                type: "Decision",
                                answer: { type: "Pay Cost", pay: true, payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0]] }] },
                            };
                        })
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        const state = playerAt(scenarioGame, 1).play.find((state) => state.card.i === target.i);
        if (!state) throw new Error("Played target is missing");
        expect(state.under).toEqual([{ card: top, faceDown: true }]);
        expect(playerAt(scenarioGame, 1).deck).toEqual([]);
    });
});
