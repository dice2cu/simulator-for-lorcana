import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/chosen-player-draws-a-card-for-each-different-ink-type-of-ch-fb063bb985ab.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: fb063bb985ab
const abilityText = "Chosen player draws a card for each different ink type of characters you have in play.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "With a Few Good Friends",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 2])("draws exactly the counted amount (%s)", async (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            ...(count === 2
                ? [
                      {
                          definition: scenarioCards.fixture({
                              fullName: "Ruby One",
                              names: ["Ruby One"],
                              type: "Character",
                              colors: ["Ruby"],
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
                              fullName: "Ruby Two",
                              names: ["Ruby Two"],
                              type: "Character",
                              colors: ["Ruby"],
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
                              fullName: "Steel",
                              names: ["Steel"],
                              type: "Character",
                              colors: ["Steel"],
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
                              fullName: "Not Character",
                              names: ["Not Character"],
                              type: "Item",
                              colors: ["Amber"],
                              subtypes: [],
                              cost: 0,
                              inkwell: false,
                          }),
                      },
                  ]
                : []),
        ]);
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
                    expect(request.players).toEqual([1, 2]);
                    return { type: "Decision", answer: { type: "Choose Player", player: 1 } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        const amount = count;
        expect(playerAt(scenarioGame, 1).hand).toEqual(amount === 0 ? [] : deck.slice(-amount).reverse());
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(deck.slice(0, deck.length - amount));
    });
});
