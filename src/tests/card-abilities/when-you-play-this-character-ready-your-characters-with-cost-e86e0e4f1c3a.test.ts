import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import { InvalidInput } from "../../engine/invalid-input";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/when-you-play-this-character-ready-your-characters-with-cost-e86e0e4f1c3a.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: e86e0e4f1c3a
const abilityText = "When you play this character, ready your characters with cost 3 or less. They can't quest for the rest of this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Scar - Shameless Firebrand",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 2,
                    inkwell: false,
                    strength: 2,
                    willpower: 6,
                    lore: 1,
                }),
                exerted: !false,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Other",
                    names: ["Other"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 3,
                    inkwell: false,
                    strength: 2,
                    willpower: 6,
                    lore: 1,
                }),
                exerted: !false,
            },
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 20 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const target = playerAt(scenarioGame, 1).play[0];
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Pay Cost", (request) => {
                    expect(request.optional).toBe(false);
                    expect(request.cost).toEqual([{ type: "Ink", amount: 8 }]);
                    expect(request.ink[0].player).toBe(1);
                    expect(request.ink[0].cards).toHaveLength(20);
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
                                    ],
                                },
                            ],
                        },
                    };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(
            playerAt(scenarioGame, 1)
                .play.filter((card) => card.card.fullName !== prototypeCardName)
                .every((card) => !inPlay(scenarioRules(), card.card).exerted),
        ).toBe(true);
        expect(
            await (async () => {
                const action: PlayerAction | undefined = { type: "Quest", player: 1, card: target.card };
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
            })(),
        ).toBe(false);
    });
});
