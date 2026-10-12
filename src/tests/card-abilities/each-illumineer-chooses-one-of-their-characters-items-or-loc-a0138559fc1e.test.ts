import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/each-illumineer-chooses-one-of-their-characters-items-or-loc-a0138559fc1e.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: a0138559fc1e
const abilityText =
    "Each Illumineer chooses one of their characters, items, or locations. Then, Jafar banishes all other opposing characters, items, and locations.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Cataclysmic Cyclone",
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
                    fullName: "Ally",
                    names: ["Ally"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Ally", "Hero", "Madrigal", "Pirate", "Gargoyle", "Floodborn"],
                    cost: 0,
                    inkwell: false,
                    strength: 4,
                    willpower: 10,
                    lore: 2,
                }),
                damage: 3,
                exerted: !false,
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Opponent",
                    names: ["Opponent"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Villain"],
                    cost: 2,
                    inkwell: false,
                    strength: 4,
                    willpower: 10,
                    lore: 1,
                }),
                damage: 1,
                exerted: !false,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Opposing Item",
                    names: ["Opposing Item"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 2,
                    inkwell: false,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Opposing Location",
                    names: ["Opposing Location"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 2,
                    inkwell: false,
                    willpower: 10,
                    lore: 0,
                    moveCost: 0,
                }),
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const ally = playerAt(scenarioGame, 1).play[1];
        const opposingCharacter = playerAt(scenarioGame, 2).play[0];
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
                2: new ScriptedPlayer().on("Choose Cards", (request) => {
                    expect(request.min).toBe(1);
                    expect(request.max).toBe(1);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 2).play.map((ink) => ink.card)).toEqual([opposingCharacter.card]);
        expect(playerAt(scenarioGame, 2).discard).toHaveLength(2);
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(ally.card);
    });
});
