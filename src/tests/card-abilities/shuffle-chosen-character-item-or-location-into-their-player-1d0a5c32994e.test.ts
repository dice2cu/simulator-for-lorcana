import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/shuffle-chosen-character-item-or-location-into-their-player-1d0a5c32994e.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 1d0a5c32994e
const abilityText = "Shuffle chosen character, item, or location into their player's deck. That player draws 2 cards.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "You're Welcome",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each(["Character", "Item", "Location"])("shuffles the chosen %s and draws exactly two for its owner only", async (type) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition:
                    type === "Character"
                        ? scenarioCards.fixture({
                              fullName: "Shuffled",
                              names: ["Shuffled"],
                              type: "Character",
                              colors: ["Amber"],
                              subtypes: [],
                              cost: 0,
                              inkwell: false,
                              strength: 0,
                              willpower: 5,
                              lore: 0,
                          })
                        : type === "Item"
                          ? scenarioCards.fixture({
                                fullName: "Shuffled",
                                names: ["Shuffled"],
                                type: "Item",
                                colors: ["Amber"],
                                subtypes: [],
                                cost: 0,
                                inkwell: false,
                            })
                          : scenarioCards.fixture({
                                fullName: "Shuffled",
                                names: ["Shuffled"],
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
            {
                definition: scenarioCards.fixture({
                    fullName: "Keep In Play",
                    names: ["Keep In Play"],
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
        playerAt(scenarioGame, 2).deck = cardIds(
            scenarioCards,
            Array.from({ length: 4 }, (_, index) =>
                scenarioCards.fixture({
                    fullName: "Deck " + index,
                    names: ["Deck " + index],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ).reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const [shuffled, kept] = playerAt(scenarioGame, 2).play;
        const cards = [...[...playerAt(scenarioGame, 2).deck].reverse(), shuffled.card];
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                printedEffect(scenarioCards.definition(source.card.fullName)),
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(
                scenarioResolution,
                {
                    1: new ScriptedPlayer().on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    }),
                },
                {
                    random: [
                        {
                            type: "Shuffle",
                            cards: [
                                scenarioCards.instance(4),
                                scenarioCards.instance(6),
                                scenarioCards.instance(7),
                                scenarioCards.instance(2),
                                scenarioCards.instance(5),
                            ],
                        },
                    ],
                },
            );
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 2).play.map((ink) => ink.card)).toEqual([kept.card]);
        expect(playerAt(scenarioGame, 2).hand).toHaveLength(2);
        expect([...playerAt(scenarioGame, 2).deck].reverse()).toHaveLength(3);
        expect([...[...playerAt(scenarioGame, 2).deck].reverse(), ...playerAt(scenarioGame, 2).hand]).toEqual(expect.arrayContaining(cards));
        expect(new Set([...[...playerAt(scenarioGame, 2).deck].reverse(), ...playerAt(scenarioGame, 2).hand])).toHaveLength(5);
        expect(playerAt(scenarioGame, 2).discard).toEqual([]);
        expect(playerAt(scenarioGame, 1).hand).toEqual([]);
    });
});
