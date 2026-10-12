import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/when-you-play-this-character-the-opposing-players-together-c-a50152d1ab53.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: a50152d1ab53
const abilityText = "When you play this character, the opposing players together choose an item or location of theirs and banish it.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Tamatoa - Grabby Crab",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("banishes exactly one jointly chosen opposing item or location, even from a second opponent", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        scenarioGame.players[3] = emptyPlayer();
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Own Item",
                    names: ["Own Item"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "First Item",
                    names: ["First Item"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Character",
                    names: ["Character"],
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
        ]);
        playerAt(scenarioGame, 3).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Chosen Location",
                    names: ["Chosen Location"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 5,
                    lore: 0,
                    moveCost: 0,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const own = [...playerAt(scenarioGame, 1).play];
        const untouched = [...playerAt(scenarioGame, 2).play];
        const location = playerAt(scenarioGame, 3).play[0];
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                printedEffect(scenarioCards.definition(source.card.fullName), 0),
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(
                scenarioResolution,
                {},
                {
                    joint: new ScriptedPlayer().on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(5)] } };
                    }),
                },
            );
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).play.map((ink) => ink.card)).toEqual(own.map((state) => state.card));
        expect(playerAt(scenarioGame, 2).play.map((ink) => ink.card)).toEqual(untouched.map((state) => state.card));
        expect(playerAt(scenarioGame, 3).play.map((ink) => ink.card)).toEqual([]);
        expect(playerAt(scenarioGame, 3).discard).toEqual([location.card]);
        expect(playerAt(scenarioGame, 2).discard).toEqual([]);
    });
});
