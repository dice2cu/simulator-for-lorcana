import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/look-at-the-top-5-cards-of-your-deck-you-may-reveal-up-to-1-0fedbaded15a.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 0fedbaded15a
const abilityText =
    "Look at the top 5 cards of your deck. You may reveal up to 1 Madrigal character card and up to 1 song card and put them into your hand. Put the rest on the top of your deck in any order.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Family Madrigal",
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
            [
                scenarioCards.fixture({
                    fullName: "Eligible Card",
                    names: ["Eligible Card"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: ["Song"],
                    cost: 1,
                    playRules: [{ type: "Sing", cost: 1 }],
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
                ...Array.from({ length: 4 }, (_, index) =>
                    scenarioCards.fixture({
                        fullName: "Other Card " + index,
                        names: ["Other Card " + index],
                        type: "Item",
                        colors: ["Amber"],
                        subtypes: [],
                        cost: 0,
                        inkwell: false,
                    }),
                ),
            ].reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const eligible = [...playerAt(scenarioGame, 1).deck].reverse()[0];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName));
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
                        expect(request.min).toBe(0);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(6)] } };
                    })
                    .on("Order Cards", (request) => {
                        expect(request.cards).toHaveLength(4);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Order Cards",
                                cards: [scenarioCards.instance(2), scenarioCards.instance(3), scenarioCards.instance(4), scenarioCards.instance(5)],
                            },
                        };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toContainEqual(eligible);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).not.toContainEqual(eligible);
    });
});
