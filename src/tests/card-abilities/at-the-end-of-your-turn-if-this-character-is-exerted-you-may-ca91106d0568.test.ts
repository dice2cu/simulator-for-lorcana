import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/at-the-end-of-your-turn-if-this-character-is-exerted-you-may-ca91106d0568.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: ca91106d0568
const abilityText =
    "At the end of your turn, if this character is exerted, you may draw cards equal to the ¤ of chosen Ally character of yours. If you do, choose and discard 2 cards and banish that character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Scar - Finally King",
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
                    strength: 5,
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
        source.exerted = !false;
        const opposingCharacter = playerAt(scenarioGame, 2).play[0];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 1);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Draw One",
                    names: ["Draw One"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                scenarioCards.fixture({
                    fullName: "Draw Two",
                    names: ["Draw Two"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                scenarioCards.fixture({
                    fullName: "Draw Three",
                    names: ["Draw Three"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                scenarioCards.fixture({
                    fullName: "Draw Four",
                    names: ["Draw Four"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                scenarioCards.fixture({
                    fullName: "Draw Five",
                    names: ["Draw Five"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            ].reverse(),
        );
        const before = playerAt(scenarioGame, 1).hand.length;
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
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(2);
                        expect(request.max).toBe(2);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(10), scenarioCards.instance(9)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand.length).toBe(before + 3);
        expect(playerAt(scenarioGame, 1).discard).toContainEqual(ally.card);
    });
});
