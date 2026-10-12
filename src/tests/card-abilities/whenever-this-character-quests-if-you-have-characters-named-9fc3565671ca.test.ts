import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-this-character-quests-if-you-have-characters-named-9fc3565671ca.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 9fc3565671ca
const abilityText = "Whenever this character quests, if you have characters named Dewey and Louie in play, you may draw 3 cards.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Huey - Savvy Nephew",
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
                    fullName: "Dewey",
                    names: ["Dewey"],
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
            ...(count === 1
                ? [
                      {
                          definition: scenarioCards.fixture({
                              fullName: "Louie",
                              names: ["Louie"],
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
        const drawn = deck[deck.length - 1];
        await (async () => {
            if (count === 0) {
                const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: false } };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            if (count === 1) {
                const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Choose Trigger", (request) => {
                            const expected = {
                                player: 1,
                                source: { card: scenarioCards.instance(1), player: 1, kind: "Ability" },
                                effect: {
                                    type: "Optional",
                                    effect: {
                                        type: "Choose Cards",
                                        from: { zone: "Play", player: "You", cardType: "Character", exclude: "Self" },
                                        count: 1,
                                        effect: {
                                            type: "Modify Cards",
                                            cards: "Selected Cards",
                                            modifier: { stat: "Strength", amount: { stat: "Strength", card: "Self" } },
                                            duration: { until: "End Of Turn" },
                                        },
                                    },
                                },
                            };
                            const options = request.options.filter(({ option, ...description }) => JSON.stringify(description) === JSON.stringify(expected));
                            expect(options).toHaveLength(1);
                            return { type: "Decision", answer: { type: "Choose Trigger", option: options[0].option } };
                        })
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: false } };
                        })
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            throw new Error("Unspecified script case");
        })();
        expect(playerAt(scenarioGame, 1).hand).toEqual(count === 1 ? deck.slice(-3).reverse() : []);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(count === 1 ? deck.slice(0, -3) : deck);
    });
});
