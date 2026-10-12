import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/when-you-play-this-character-return-up-to-2-item-cards-from-b5a3f802b5ec.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: b5a3f802b5ec
const abilityText = "When you play this character, return up to 2 item cards from your discard to your hand.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Tamatoa - Happy as a Clam",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "One",
                names: ["One"],
                type: "Item",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
            }),
            scenarioCards.fixture({
                fullName: "Two",
                names: ["Two"],
                type: "Item",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
            }),
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            items = [...playerAt(scenarioGame, 1).discard],
            ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0);
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Choose Cards", (request) => {
                    expect(request.min).toBe(0);
                    expect(request.max).toBe(2);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2), scenarioCards.instance(3)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toEqual(expect.arrayContaining(items));
    });
});
