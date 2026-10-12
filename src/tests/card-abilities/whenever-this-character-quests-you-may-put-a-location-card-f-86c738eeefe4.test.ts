import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-this-character-quests-you-may-put-a-location-card-f-86c738eeefe4.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 86c738eeefe4
const abilityText = "Whenever this character quests, you may put a location card from chosen player's discard on the bottom of their deck to gain 1 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Goldie O'Gilt - Cunning Prospector",
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
                fullName: "Moved Card",
                names: ["Moved Card"],
                type: "Location",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                willpower: 1,
                lore: 0,
                moveCost: 0,
            }),
        ]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            moved = playerAt(scenarioGame, 1).discard[0],
            ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 1); /* "you may": yes */
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
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    })
                    .on("Choose Player", (request) => {
                        expect(request.players).toEqual([1, 2]);
                        return { type: "Decision", answer: { type: "Choose Player", player: 1 } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect([...playerAt(scenarioGame, 1).deck].reverse()[0]).toEqual(moved);
        expect(playerAt(scenarioGame, 1).lore).toBe(1);
    });
});
