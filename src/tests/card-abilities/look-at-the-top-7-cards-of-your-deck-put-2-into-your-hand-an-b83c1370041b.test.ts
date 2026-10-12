import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/look-at-the-top-7-cards-of-your-deck-put-2-into-your-hand-an-b83c1370041b.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: b83c1370041b
const abilityText = "Look at the top 7 cards of your deck. Put 2 into your hand and the rest on the bottom of your deck in any order.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Dig a Little Deeper",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            Array.from({ length: 7 }, (_, index) =>
                scenarioCards.fixture({
                    fullName: "Deck Card " + index,
                    names: ["Deck Card " + index],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ).reverse(),
        );
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            selected = [...playerAt(scenarioGame, 1).deck].reverse().slice(0, 2),
            remainder = [...playerAt(scenarioGame, 1).deck].reverse().slice(2),
            ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName));
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(2);
                        expect(request.max).toBe(2);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(8), scenarioCards.instance(7)] } };
                    })
                    .on("Order Cards", (request) => {
                        expect(request.cards).toHaveLength(5);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Order Cards",
                                cards: [
                                    scenarioCards.instance(2),
                                    scenarioCards.instance(3),
                                    scenarioCards.instance(4),
                                    scenarioCards.instance(5),
                                    scenarioCards.instance(6),
                                ],
                            },
                        };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toEqual(expect.arrayContaining(selected));
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(expect.arrayContaining(remainder));
    });
});
