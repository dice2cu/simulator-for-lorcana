import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/each-player-chooses-one-of-their-characters-and-puts-them-in-037990a395cd.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 037990a395cd
const abilityText = "Each player chooses one of their characters and puts them into their inkwell facedown and exerted.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Falling Down the Rabbit Hole",
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
            ...Array.from({ length: 1 }, (_, i) => ({
                definition: scenarioCards.fixture({
                    fullName: "P1 " + i,
                    names: ["P1 " + i],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            })),
        ]);
        playerAt(scenarioGame, 2).play = cardStates(
            scenarioCards,
            Array.from({ length: 1 }, (_, i) => ({
                definition: scenarioCards.fixture({
                    fullName: "P2 " + i,
                    names: ["P2 " + i],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            })),
        );
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            p1 = playerAt(scenarioGame, 1).play.slice(1),
            opponent = playerAt(scenarioGame, 2),
            p2 = [...playerAt(scenarioGame, 2).play],
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
        expect(playerAt(scenarioGame, 1).inkwell.map((ink) => ink.card)).toEqual(expect.arrayContaining(p1.map((state) => state.card)));
        expect(playerAt(scenarioGame, 2).inkwell.map((ink) => ink.card)).toEqual(expect.arrayContaining(p2.map((state) => state.card)));
    });
});
