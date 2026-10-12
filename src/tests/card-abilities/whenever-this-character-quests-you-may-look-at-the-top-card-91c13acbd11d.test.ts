import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-this-character-quests-you-may-look-at-the-top-card-91c13acbd11d.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 91c13acbd11d
const abilityText = "Whenever this character quests, you may look at the top card of chosen player's deck. Put it on top of their deck or into their discard.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mad Hatter - Eccentric Host",
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
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Top Card",
                    names: ["Top Card"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 1,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                scenarioCards.fixture({
                    fullName: "Second Card",
                    names: ["Second Card"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 1,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
                scenarioCards.fixture({
                    fullName: "Third Card",
                    names: ["Third Card"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 1,
                    inkwell: false,
                }),
                scenarioCards.fixture({
                    fullName: "Fourth Card",
                    names: ["Fourth Card"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 1,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ].reverse(),
        );
        const beforeZones =
            [...playerAt(scenarioGame, 1).deck].reverse().length +
            playerAt(scenarioGame, 1).hand.length +
            playerAt(scenarioGame, 1).discard.length +
            playerAt(scenarioGame, 1).play.length +
            playerAt(scenarioGame, 1).inkwell.length;
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
                    .on("Choose Mode", (request) => {
                        expect(request.options).toHaveLength(2);
                        return { type: "Decision", answer: { type: "Choose Mode", mode: 0 } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        const afterZones =
            [...playerAt(scenarioGame, 1).deck].reverse().length +
            playerAt(scenarioGame, 1).hand.length +
            playerAt(scenarioGame, 1).discard.length +
            playerAt(scenarioGame, 1).play.length +
            playerAt(scenarioGame, 1).inkwell.length;
        expect(afterZones).toEqual(beforeZones);
    });
});
