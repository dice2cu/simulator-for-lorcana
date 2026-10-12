import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/each-player-reveals-the-top-card-of-their-deck-draw-a-card-f-3defedda74fd.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 3defedda74fd
const abilityText = "Each player reveals the top card of their deck. Draw a card for each different ink symbol on cards revealed this way.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Colors of the Wind",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("draws once per distinct revealed ink symbol (different: %s)", async (different) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Lower Card",
                    names: ["Lower Card"],
                    type: "Character",
                    colors: ["Ruby"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
                scenarioCards.fixture({
                    fullName: "Revealed Ruby",
                    names: ["Revealed Ruby"],
                    type: "Character",
                    colors: ["Ruby"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            ].reverse(),
        );
        playerAt(scenarioGame, 2).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Opponent Top",
                    names: ["Opponent Top"],
                    type: "Character",
                    colors: [different ? "Steel" : "Ruby"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            ].reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        const originalDeck = [...[...playerAt(scenarioGame, 1).deck].reverse()];
        const opponentDeck = [...[...playerAt(scenarioGame, 2).deck].reverse()];
        const source = playerAt(scenarioGame, 1).play[0];
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                {
                    type: "Sequence",
                    effects: [
                        {
                            type: "For Each Player",
                            players: "All",
                            effect: { type: "Reveal", cards: { zone: "Deck", player: "Selected Player", position: "Top", take: 1 } },
                        },
                        { type: "Draw", player: "You", amount: { distinct: "Ink Type", cards: { result: "Revealed Cards" } } },
                    ],
                },
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toEqual(different ? [...originalDeck].reverse() : [originalDeck[1]]);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(different ? [] : [originalDeck[0]]);
        expect([...playerAt(scenarioGame, 2).deck].reverse()).toEqual(opponentDeck);
        expect(playerAt(scenarioGame, 2).hand).toEqual([]);
    });
});
