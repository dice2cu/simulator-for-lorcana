import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/shift-discard-an-action-card-you-may-discard-an-action-card-7a77442bcf7c.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 7a77442bcf7c
const abilityText = "Shift: Discard an action card (You may discard an action card to play this on top of one of your characters named Diablo.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Diablo - Devoted Herald",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const characterName = scenarioCards.definition(prototypeCardName).names[0];
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            prototypeCardName,
            scenarioCards.fixture({
                fullName: "Payment",
                names: ["Payment"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
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
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const shiftedCard = playerAt(scenarioGame, 1).hand[0];
        const paymentCards = playerAt(scenarioGame, 1).hand.slice(1);
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
                    expect(request.cost).toEqual([
                        {
                            type: "Choose Cards",
                            from: { cards: [scenarioCards.instance(2)] },
                            count: 1,
                            cost: [{ type: "Discard", cards: "Selected Cards" }],
                        },
                    ]);
                    expect(request.ink[0].player).toBe(1);
                    expect(request.ink[0].cards).toHaveLength(0);
                    return {
                        type: "Decision",
                        answer: { type: "Pay Cost", pay: true, payment: [{ type: "Discard", player: 1, cards: [scenarioCards.instance(2)] }] },
                    };
                }),
            });
            scenarioGame = finished(scenarioResolution);
            return true;
        })();
        expect(played).toBe(true);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(shiftedCard);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).not.toContainEqual(shiftTarget.card);
        expect(playerAt(scenarioGame, 1).discard).toEqual(expect.arrayContaining(paymentCards));
    });
});
