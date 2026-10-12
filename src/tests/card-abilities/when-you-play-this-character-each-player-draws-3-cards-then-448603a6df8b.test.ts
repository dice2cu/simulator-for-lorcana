import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/when-you-play-this-character-each-player-draws-3-cards-then-448603a6df8b.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 448603a6df8b
const abilityText =
    "When you play this character, each player draws 3 cards, then discards 3 cards at random. Choose an opposing character and deal 2 damage to them for each action card discarded this way.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Headless Horseman - Cursed Rider",
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
                    willpower: 20,
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
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 1);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Action One",
                    names: ["Action One"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
                scenarioCards.fixture({
                    fullName: "Action Two",
                    names: ["Action Two"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
                scenarioCards.fixture({
                    fullName: "Action Three",
                    names: ["Action Three"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ].reverse(),
        );
        playerAt(scenarioGame, 2).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Action Four",
                    names: ["Action Four"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
                scenarioCards.fixture({
                    fullName: "Action Five",
                    names: ["Action Five"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
                scenarioCards.fixture({
                    fullName: "Action Six",
                    names: ["Action Six"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
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
            resolvePlayers(
                scenarioResolution,
                {
                    1: new ScriptedPlayer().on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                    }),
                },
                {
                    random: [
                        { type: "Random Cards", cards: [scenarioCards.instance(7), scenarioCards.instance(8), scenarioCards.instance(6)] },
                        { type: "Random Cards", cards: [scenarioCards.instance(9), scenarioCards.instance(11), scenarioCards.instance(10)] },
                    ],
                },
            );
            scenarioGame = finished(scenarioResolution);
        }
        // Three drawn and three discarded leave the same hand size.
        expect(playerAt(scenarioGame, 1).hand.length).toEqual(before);
        expect(playerAt(scenarioGame, 1).discard).toHaveLength(3);
        expect(playerAt(scenarioGame, 2).discard).toHaveLength(3);
        expect(inPlay(scenarioRules(), opposingCharacter.card).damage ?? 0).toBe(13);
    });
});
