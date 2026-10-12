import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/banish-chosen-character-of-yours-to-draw-2-cards-if-that-cha-0cbb42a9fb1e.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 0cbb42a9fb1e
const abilityText = "Banish chosen character of yours to draw 2 cards. If that character had a card under them, draw 3 cards instead.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Time to Go!",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("banishes the chosen friendly character and draws two or three cards (%s)", async (underneath) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Payment",
                    names: ["Payment"],
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
        playerAt(scenarioGame, 1).discard = cardIds(
            scenarioCards,
            underneath
                ? [
                      scenarioCards.fixture({
                          fullName: "Under Card",
                          names: ["Under Card"],
                          type: "Action",
                          colors: ["Amber"],
                          subtypes: [],
                          cost: 0,
                          inkwell: false,
                          effect: { type: "Sequence", effects: [] },
                      }),
                  ]
                : [],
        );
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            Array.from({ length: 5 }, (_, index) =>
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
        const [source, payment] = playerAt(scenarioGame, 1).play;
        const under = [...playerAt(scenarioGame, 1).discard];
        playerAt(scenarioGame, 1).discard = [];
        inPlay(scenarioRules(), payment.card).under = under.map((card) => ({ card, faceDown: true }));
        const deck = [...[...playerAt(scenarioGame, 1).deck].reverse()];
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                {
                    type: "Choose Cards",
                    from: { zone: "Play", player: "You", cardType: "Character" },
                    count: 1,
                    effect: {
                        type: "Conditional",
                        if: { every: "Selected Cards", where: { cardsUnder: { atLeast: 1 } } },
                        then: { type: "Do Then", do: { type: "Banish", cards: "Selected Cards" }, then: { type: "Draw", player: "You", amount: 3 } },
                        otherwise: { type: "Do Then", do: { type: "Banish", cards: "Selected Cards" }, then: { type: "Draw", player: "You", amount: 2 } },
                    },
                },
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Choose Cards", (request) => {
                    expect(request.min).toBe(1);
                    expect(request.max).toBe(1);
                    return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        const amount = underneath ? 3 : 2;
        expect(playerAt(scenarioGame, 1).play.map((ink) => ink.card)).toEqual([source.card]);
        expect(playerAt(scenarioGame, 1).discard).toEqual([payment.card, ...under]);
        expect(playerAt(scenarioGame, 1).hand).toEqual(deck.slice(-amount).reverse());
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(deck.slice(0, deck.length - amount));
    });
});
