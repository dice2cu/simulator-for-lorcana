import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/if-you-have-a-character-named-jafar-in-play-draw-2-cards-if-0fa37da58cdb.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 0fa37da58cdb
const abilityText =
    "If you have a character named Jafar in play, draw 2 cards. If you have a character named Genie in play, return chosen character with cost 4 or less to their player's hand.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Lamp",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Genie - Test",
                    names: ["Genie"],
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
            {
                definition: scenarioCards.fixture({
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 1,
                    inkwell: false,
                    strength: 0,
                    willpower: 6,
                    lore: 0,
                }),
                damage: 1,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [source, , target] = playerAt(scenarioGame, 1).play;
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0);
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
                    expect(request.min).toBe(1);
                    expect(request.max).toBe(1);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toContainEqual(target.card);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).not.toContainEqual(target.card);
    });
});
