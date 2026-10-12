import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/draw-3-cards-then-put-2-cards-from-your-hand-on-the-top-of-y-7d7aaaf6d4fc.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 7d7aaaf6d4fc
const abilityText = "Draw 3 cards, then put 2 cards from your hand on the top of your deck in any order.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Hypnotic Deduction",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Seven Dwarfs", "Princess"],
                    cost: 2,
                    inkwell: false,
                    strength: 3,
                    willpower: 8,
                    lore: 1,
                }),
                damage: 3,
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [prototypeCardName, prototypeCardName, prototypeCardName, prototypeCardName, prototypeCardName].reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const target = playerAt(scenarioGame, 2).play[0];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName));
        // draws the top 3 and puts two of them back on top
        const drawn = [...playerAt(scenarioGame, 1).deck].reverse().slice(-3);
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
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3), scenarioCards.instance(4)] } };
                    })
                    .on("Order Cards", (request) => {
                        expect(request.cards).toHaveLength(2);
                        return { type: "Decision", answer: { type: "Order Cards", cards: [scenarioCards.instance(3), scenarioCards.instance(4)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toEqual([drawn[0]]);
    });
});
