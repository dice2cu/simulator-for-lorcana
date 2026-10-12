import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/when-you-play-this-character-if-you-have-an-illusion-charact-4ebe57982f0d.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 4ebe57982f0d
const abilityText = "When you play this character, if you have an Illusion character in play, you may draw a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Treasure Guardian - Foreboding Sentry",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Condition",
                    names: ["Condition"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [
                        "Hero",
                        "Princess",
                        "Queen",
                        "Sorcerer",
                        "Super",
                        "Ally",
                        "Illusion",
                        "Alien",
                        "Detective",
                        "Knight",
                        "Madrigal",
                        "Pirate",
                        "Seven Dwarfs",
                    ],
                    abilities: [{ type: "Keyword", keyword: { name: "Evasive" } }],
                    cost: 0,
                    inkwell: false,
                    strength: 6,
                    willpower: 6,
                    lore: 1,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Other One",
                    names: ["Other One"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Gargoyle"],
                    cost: 0,
                    inkwell: false,
                    strength: 5,
                    willpower: 6,
                    lore: 1,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Other Two",
                    names: ["Other Two"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 5,
                    willpower: 6,
                    lore: 1,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Location",
                    names: ["Location"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 6,
                    lore: 1,
                    moveCost: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Item",
                    names: ["Item"],
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
                    fullName: "Opposing",
                    names: ["Opposing"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 6,
                    lore: 0,
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
                    cost: 0,
                    inkwell: false,
                }),
            },
        ]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Panic",
                names: ["Panic"],
                type: "Character",
                colors: ["Amber"],
                subtypes: ["Gargoyle"],
                cost: 0,
                inkwell: false,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
            scenarioCards.fixture({
                fullName: "Song",
                names: ["Song"],
                type: "Action",
                colors: ["Amber"],
                subtypes: ["Song"],
                cost: 0,
                playRules: [{ type: "Sing", cost: 0 }],
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, [
            prototypeCardName,
            prototypeCardName,
            prototypeCardName,
            prototypeCardName,
            prototypeCardName,
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, [prototypeCardName].reverse());
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 20 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        playerAt(scenarioGame, 2).inkwell = Array.from({ length: 25 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        inPlay(scenarioRules(), playerAt(scenarioGame, 1).play[0].card).under = [prototypeCardName].map((card) => ({
            card: scenarioCards.create(card),
            faceDown: true,
        }));
        playerAt(scenarioGame, 2).lore = 10;
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 4 }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(20);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [
                                    {
                                        type: "Ink",
                                        player: 1,
                                        cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2], request.ink[0].cards[3]],
                                    },
                                ],
                            },
                        };
                    })
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(1);
    });
});
