import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-you-play-another-item-you-may-pay-1-to-draw-a-card-a45ffefbd4f3.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: a45ffefbd4f3
const abilityText = "Whenever you play another item, you may pay 1 ⬡ to draw a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Maurice's Workshop",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("pays one ink and draws exactly one card only when accepted (%s)", async (accept) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Event Card",
                    names: ["Event Card"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Drawn",
                    names: ["Drawn"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ].reverse(),
        );
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 1 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const subject = playerAt(scenarioGame, 1).play[1];
        const drawn = [...playerAt(scenarioGame, 1).deck].reverse()[0];
        await (async () => {
            if (accept === true) {
                const fixtureSource = subject.card;
                const position = playerAt(scenarioGame, 1);
                position.play = position.play.filter((state) => !sameCard(state.card, fixtureSource));
                position.hand.push(fixtureSource);
                position.inkwell.push(
                    ...Array.from({ length: scenarioCards.definition(fixtureSource.fullName).cost }, () => ({
                        card: scenarioCards.create("Dinglehopper"),
                        exerted: false,
                    })),
                );
                const action0: PlayerAction | undefined = { type: "Play", player: 1, card: scenarioCards.instance(2) };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
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
                const fixtureSource = subject.card;
                const position = playerAt(scenarioGame, 1);
                position.play = position.play.filter((state) => !sameCard(state.card, fixtureSource));
                position.hand.push(fixtureSource);
                position.inkwell.push(
                    ...Array.from({ length: scenarioCards.definition(fixtureSource.fullName).cost }, () => ({
                        card: scenarioCards.create("Dinglehopper"),
                        exerted: false,
                    })),
                );
                const action0: PlayerAction | undefined = { type: "Play", player: 1, card: scenarioCards.instance(2) };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
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
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(accept ? [] : [drawn]);
        expect(playerAt(scenarioGame, 1).inkwell.filter((card) => !!card.exerted)).toHaveLength(accept ? 1 : 0);
    });
});
