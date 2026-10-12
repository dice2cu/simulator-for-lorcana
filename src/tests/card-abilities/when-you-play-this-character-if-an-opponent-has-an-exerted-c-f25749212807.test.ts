import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/when-you-play-this-character-if-an-opponent-has-an-exerted-c-f25749212807.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: f25749212807
const abilityText = "When you play this character, if an opponent has an exerted character in play, gain 1 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Honeymaren - Northuldra Guide",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([
        { board: "absent", met: false },
        { board: "own qualifying permanent only", met: false },
        { board: "opposing wrong type", met: false },
        { board: "opposing wrong status", met: false },
        { board: "opposing qualifying permanent", met: true },
    ])("checks its condition with $board", async ({ board, met }) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        if (board === "own qualifying permanent only")
            playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
                {
                    definition: scenarioCards.fixture({
                        fullName: "Condition",
                        names: ["Condition"],
                        type: "Character",
                        colors: ["Amber"],
                        subtypes: [],
                        cost: 0,
                        inkwell: false,
                        strength: 0,
                        willpower: 6,
                        lore: 0,
                    }),
                    damage: 0,
                    exerted: !false,
                },
            ]);
        if (board === "opposing qualifying permanent")
            playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
                {
                    definition: scenarioCards.fixture({
                        fullName: "Condition",
                        names: ["Condition"],
                        type: "Character",
                        colors: ["Amber"],
                        subtypes: [],
                        cost: 0,
                        inkwell: false,
                        strength: 0,
                        willpower: 6,
                        lore: 0,
                    }),
                    damage: 0,
                    exerted: !false,
                },
            ]);
        if (board === "opposing wrong type")
            playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
                {
                    definition: scenarioCards.fixture({
                        fullName: "Condition",
                        names: ["Condition"],
                        type: "Item",
                        colors: ["Amber"],
                        subtypes: [],
                        cost: 0,
                        inkwell: false,
                    }),
                    damage: 0,
                    exerted: !false,
                },
            ]);
        if (board === "opposing wrong status")
            playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
                {
                    definition: scenarioCards.fixture({
                        fullName: "Condition",
                        names: ["Condition"],
                        type: "Character",
                        colors: ["Amber"],
                        subtypes: [],
                        cost: 0,
                        inkwell: false,
                        strength: 0,
                        willpower: 6,
                        lore: 0,
                    }),
                    damage: 1,
                    exerted: !true,
                },
            ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Pawpsicle"].reverse());
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
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
                        expect(request.cost).toEqual([{ type: "Ink", amount: 2 }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(3);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1]] }],
                            },
                        };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        const player = playerAt(scenarioGame, 1);
        expect(playerAt(scenarioGame, 1).lore).toBe(met ? 1 : 0);
    });
});
