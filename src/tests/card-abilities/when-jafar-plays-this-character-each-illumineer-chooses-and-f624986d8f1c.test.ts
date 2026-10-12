import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/when-jafar-plays-this-character-each-illumineer-chooses-and-f624986d8f1c.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: f624986d8f1c
const abilityText =
    "When Jafar plays this character, each Illumineer chooses and banishes one of their characters, one of their items, and one of their locations.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Metal Scorpion - Deadly Statue",
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
                    fullName: "Their Character",
                    names: ["Their Character"],
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
                    fullName: "Their Item",
                    names: ["Their Item"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
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
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const own = [...playerAt(scenarioGame, 1).play];
        const theirs = [...playerAt(scenarioGame, 2).play];
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                {
                    type: "For Each Player",
                    players: "Opponents",
                    effect: {
                        type: "Choose Cards",
                        from: { zone: "Play", player: "Selected Player", cardType: "Character" },
                        count: 1,
                        player: "Selected Player",
                        effect: {
                            type: "Sequence",
                            effects: [
                                { type: "Banish", cards: "Selected Cards" },
                                {
                                    type: "Choose Cards",
                                    from: { zone: "Play", player: "Selected Player", cardType: "Item" },
                                    count: 1,
                                    player: "Selected Player",
                                    effect: {
                                        type: "Sequence",
                                        effects: [
                                            { type: "Banish", cards: "Selected Cards" },
                                            {
                                                type: "Choose Cards",
                                                from: { zone: "Play", player: "Selected Player", cardType: "Location" },
                                                count: 1,
                                                player: "Selected Player",
                                                effect: { type: "Banish", cards: "Selected Cards" },
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                },
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                2: new ScriptedPlayer()
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(4)] } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(5)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).play.map((ink) => ink.card)).toEqual(own.map((state) => state.card));
        expect(playerAt(scenarioGame, 2).discard).toEqual(expect.arrayContaining(theirs.map((state) => state.card)));
        expect(playerAt(scenarioGame, 2).play.map((ink) => ink.card)).toHaveLength(0);
    });
});
