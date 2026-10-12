import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/banish-any-number-of-your-items-then-draw-a-card-for-each-it-ddb3186c136f.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: ddb3186c136f
const abilityText = "Banish any number of your items, then draw a card for each item banished this way.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Royal Tantrum",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 2])("draws exactly one card per item actually banished (%s)", async (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "First Item",
                    names: ["First Item"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Second Item",
                    names: ["Second Item"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Kept Item",
                    names: ["Kept Item"],
                    type: "Item",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Character",
                    names: ["Character"],
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
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            Array.from({ length: 4 }, (_, index) =>
                scenarioCards.fixture({
                    fullName: "Draw " + index,
                    names: ["Draw " + index],
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
        const originalPlay = [...playerAt(scenarioGame, 1).play];
        const chosen = playerAt(scenarioGame, 1).play.slice(1, 1 + count);
        const deck = [...[...playerAt(scenarioGame, 1).deck].reverse()];
        await (async () => {
            if (count === 2) {
                const sourceDefinition = scenarioCards.definition(source.card.fullName);
                scenarioResolution = engine.startEffect(
                    scenarioGame,
                    {
                        type: "Choose Cards",
                        from: { zone: "Play", player: "You", cardType: "Item" },
                        count: "Any",
                        effect: {
                            type: "Sequence",
                            effects: [
                                { type: "Banish", cards: "Selected Cards" },
                                { type: "Draw", player: "You", amount: { count: { filter: { result: "Banished Cards" }, where: { cardType: "Item" } } } },
                            ],
                        },
                    },
                    { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                    { card: scenarioCards.lookup },
                );
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Choose Cards", (request) => {
                        expect(request.min).toBe(0);
                        expect(request.max).toBe(3);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2), scenarioCards.instance(3)] } };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            if (count === 0) {
                const sourceDefinition = scenarioCards.definition(source.card.fullName);
                scenarioResolution = engine.startEffect(
                    scenarioGame,
                    {
                        type: "Choose Cards",
                        from: { zone: "Play", player: "You", cardType: "Item" },
                        count: "Any",
                        effect: {
                            type: "Sequence",
                            effects: [
                                { type: "Banish", cards: "Selected Cards" },
                                { type: "Draw", player: "You", amount: { count: { filter: { result: "Banished Cards" }, where: { cardType: "Item" } } } },
                            ],
                        },
                    },
                    { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                    { card: scenarioCards.lookup },
                );
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Choose Cards", (request) => {
                        expect(request.min).toBe(0);
                        expect(request.max).toBe(3);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [] } };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            throw new Error("Unspecified script case");
        })();
        expect(playerAt(scenarioGame, 1).discard).toEqual(chosen.map((state) => state.card));
        expect(playerAt(scenarioGame, 1).play.map((state) => state.card)).toEqual(
            originalPlay.filter((card) => !chosen.includes(card)).map((state) => state.card),
        );
        expect(playerAt(scenarioGame, 1).hand).toEqual(count === 0 ? [] : deck.slice(-count).reverse());
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(deck.slice(0, deck.length - count));
    });
});
