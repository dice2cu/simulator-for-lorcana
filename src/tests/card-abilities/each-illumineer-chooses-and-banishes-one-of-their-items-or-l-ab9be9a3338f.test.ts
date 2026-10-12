import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/each-illumineer-chooses-and-banishes-one-of-their-items-or-l-ab9be9a3338f.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: ab9be9a3338f
const abilityText = "Each Illumineer chooses and banishes one of their items or locations.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Disastrous Sandstorm",
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
                    fullName: "Their Location",
                    names: ["Their Location"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 1,
                    lore: 0,
                    moveCost: 0,
                }),
            },
        ]);
        const p = playerAt(scenarioGame, 1),
            o = playerAt(scenarioGame, 2),
            s = playerAt(scenarioGame, 1).play[0],
            own = playerAt(scenarioGame, 1).play[1],
            theirs = playerAt(scenarioGame, 2).play[0],
            a: Effect = printedEffect(scenarioCards.definition(s.card.fullName));
        // Jafar is a third player, separate from the two Illumineers.
        scenarioGame.players[3] = emptyPlayer();
        playerAt(scenarioGame, 1).play.shift();
        playerAt(scenarioGame, 3).play.push(s);
        {
            const sourceDefinition = scenarioCards.definition(s.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                a,
                { card: s.card, player: 3, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Choose Cards", (request) => {
                    expect(request.min).toBe(1);
                    expect(request.max).toBe(1);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                }),
                2: new ScriptedPlayer().on("Choose Cards", (request) => {
                    expect(request.min).toBe(1);
                    expect(request.max).toBe(1);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).discard).toContainEqual(own.card);
        expect(playerAt(scenarioGame, 2).discard).toContainEqual(theirs.card);
    });
});
