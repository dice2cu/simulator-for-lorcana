import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/you-pay-1-less-for-the-next-action-or-item-you-play-this-tur-823c27f2b5b3.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 823c27f2b5b3
const abilityText = "You pay 1 ⬡ less for the next action or item you play this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Buzz's Arm",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Reduced Card",
                names: ["Reduced Card"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 4,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const reducedCard = playerAt(scenarioGame, 1).hand[0];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 1);
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && action.card.fullName === reducedCard.fullName,
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 3 }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(3);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] }],
                            },
                        };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).not.toContainEqual(reducedCard);
    });
});
