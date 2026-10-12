import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/shift-4-you-may-pay-4-to-play-this-on-top-of-one-of-your-cha-f0ea94af18ff.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: f0ea94af18ff
const abilityText = "Shift 4 ⬡ (You may pay 4 ⬡ to play this on top of one of your characters named Stitch.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Stitch - Rock Star",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const characterName = scenarioCards.definition(prototypeCardName).names[0];
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: characterName,
                    names: [characterName],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                exerted: !false,
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 4 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const shiftedCard = playerAt(scenarioGame, 1).hand[0];
        const shiftTarget = playerAt(scenarioGame, 1).play[0];
        const played = await (async () => {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) =>
                    action.type === "Shift" &&
                    action.player === 1 &&
                    sameCard(action.card, shiftedCard) &&
                    action.onto.length === 1 &&
                    sameCard(action.onto[0], shiftTarget.card),
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Pay Cost", (request) => {
                    expect(request.optional).toBe(false);
                    expect(request.cost).toEqual([{ type: "Ink", amount: 4 }]);
                    expect(request.ink[0].player).toBe(1);
                    expect(request.ink[0].cards).toHaveLength(4);
                    return {
                        type: "Decision",
                        answer: {
                            type: "Pay Cost",
                            pay: true,
                            payment: [
                                {
                                    type: "Ink",
                                    player: 1,
                                    cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2], request.ink[0].cards[3]],
                                },
                            ],
                        },
                    };
                }),
            });
            scenarioGame = finished(scenarioResolution);
            return true;
        })();
        expect(played).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).not.toContainEqual(shiftedCard);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(shiftedCard);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).not.toContainEqual(shiftTarget.card);
    });
});
