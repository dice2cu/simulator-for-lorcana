import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/chosen-opponent-chooses-3-of-their-characters-and-returns-on-123c6b71e59f.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 123c6b71e59f
const abilityText =
    "Chosen opponent chooses 3 of their characters and returns one of those cards to their hand, puts one on the bottom of their deck, and puts one on the top of their deck.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Family Scattered",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("lets the chosen opponent assign three characters to hand, bottom and top in their chosen order", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        scenarioGame.players[3] = emptyPlayer();
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Unchosen",
                    names: ["Unchosen"],
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
        playerAt(scenarioGame, 3).play = cardStates(
            scenarioCards,
            Array.from({ length: 4 }, (_, index) => ({
                definition: scenarioCards.fixture({
                    fullName: "Character " + index,
                    names: ["Character " + index],
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
        playerAt(scenarioGame, 3).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Existing",
                    names: ["Existing"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ].reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const [one, two, three, kept] = playerAt(scenarioGame, 3).play;
        const existing = [...playerAt(scenarioGame, 3).deck].reverse()[0];
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                printedEffect(scenarioCards.definition(source.card.fullName)),
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Choose Player", (request) => {
                    expect(request.players).toEqual([2, 3]);
                    return { type: "Decision", answer: { type: "Choose Player", player: 3 } };
                }),
                3: new ScriptedPlayer()
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(3);
                        expect(request.max).toBe(3);
                        return {
                            type: "Decision",
                            answer: { type: "Choose Cards", cards: [scenarioCards.instance(5), scenarioCards.instance(3), scenarioCards.instance(4)] },
                        };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(5)] } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(4)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 3).play.map((ink) => ink.card)).toEqual([kept.card]);
        expect(playerAt(scenarioGame, 3).hand).toEqual([three.card]);
        expect([...playerAt(scenarioGame, 3).deck].reverse()).toEqual([one.card, existing, two.card]);
        expect(playerAt(scenarioGame, 3).discard).toEqual([]);
        expect(playerAt(scenarioGame, 2).play.map((ink) => ink.card)).toHaveLength(1);
    });
});
