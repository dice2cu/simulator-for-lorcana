import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/look-at-the-top-5-cards-of-your-deck-put-one-into-your-hand-1931bcb5d1bc.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 1931bcb5d1bc
const abilityText = "Look at the top 5 cards of your deck. Put one into your hand and the rest on the bottom of your deck in any order.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Vision of the Future",
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
            Array.from({ length: 5 }, (_, index) =>
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
            selected = [...playerAt(scenarioGame, 1).deck].reverse().slice(0, 1),
            remainder = [...playerAt(scenarioGame, 1).deck].reverse().slice(1),
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
                        expect(request.min).toBe(1);
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
        expect(playerAt(scenarioGame, 1).hand).toEqual(expect.arrayContaining(selected));
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(expect.arrayContaining(remainder));
    });
});
