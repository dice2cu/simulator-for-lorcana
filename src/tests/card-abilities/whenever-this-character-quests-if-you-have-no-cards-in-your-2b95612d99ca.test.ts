import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-this-character-quests-if-you-have-no-cards-in-your-2b95612d99ca.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 2b95612d99ca
const abilityText = "Whenever this character quests, if you have no cards in your hand, draw a card for each Ally character you have in play.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Jasmine - Inspired Researcher",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 1])("only resolves when its condition is met (%s)", async (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Ally One",
                    names: ["Ally One"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Ally"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Ally Two",
                    names: ["Ally Two"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Ally"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Not An Ally",
                    names: ["Not An Ally"],
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
        playerAt(scenarioGame, 1).hand = cardIds(
            scenarioCards,
            count === 1
                ? [
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
        const source = playerAt(scenarioGame, 1).play[0];
        const deck = [...[...playerAt(scenarioGame, 1).deck].reverse()];
        const drawn = deck[deck.length - 1];
        const originalHand = [...playerAt(scenarioGame, 1).hand];
        {
            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toEqual(count === 0 ? deck.slice(-2).reverse() : originalHand);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(count === 0 ? deck.slice(0, -2) : deck);
    });
});
