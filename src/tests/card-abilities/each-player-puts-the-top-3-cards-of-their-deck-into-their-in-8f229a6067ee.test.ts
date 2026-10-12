import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/each-player-puts-the-top-3-cards-of-their-deck-into-their-in-8f229a6067ee.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 8f229a6067ee
const abilityText = "Each player puts the top 3 cards of their deck into their inkwell facedown and exerted.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Friend Like Me",
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
            Array.from({ length: 3 }, (_, i) =>
                scenarioCards.fixture({
                    fullName: "P1 " + i,
                    names: ["P1 " + i],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ).reverse(),
        );
        playerAt(scenarioGame, 2).deck = cardIds(
            scenarioCards,
            Array.from({ length: 3 }, (_, i) =>
                scenarioCards.fixture({
                    fullName: "P2 " + i,
                    names: ["P2 " + i],
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
            p1 = [...[...playerAt(scenarioGame, 1).deck].reverse()],
            p2 = [...[...playerAt(scenarioGame, 2).deck].reverse()],
            ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName));
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
        expect(playerAt(scenarioGame, 1).inkwell.map((ink) => ink.card)).toEqual(expect.arrayContaining(p1));
        expect(playerAt(scenarioGame, 2).inkwell.map((ink) => ink.card)).toEqual(expect.arrayContaining(p2));
    });
});
