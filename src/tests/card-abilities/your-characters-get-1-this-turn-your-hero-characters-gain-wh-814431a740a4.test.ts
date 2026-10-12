import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/your-characters-get-1-this-turn-your-hero-characters-gain-wh-814431a740a4.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 814431a740a4
const abilityText =
    "Your characters get +1 ¤ this turn. Your Hero characters gain “Whenever this character challenges another character, each opponent loses 1 lore and you gain 1 lore” this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Hero Work",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Hero",
                names: ["Hero"],
                type: "Character",
                colors: [],
                subtypes: ["Hero"],
                cost: 0,
                inkwell: false,
                strength: 1,
                willpower: 10,
                lore: 0,
            }),
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Defender",
                    names: ["Defender"],
                    type: "Character",
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                }),
                exerted: true,
            },
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: scenarioCards.definition(prototypeCardName).cost }, () => ({
            card: scenarioCards.create("Dinglehopper"),
            exerted: false,
        }));
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            opponent = playerAt(scenarioGame, 2),
            ability: Effect = {
                type: "Sequence",
                effects: [
                    {
                        type: "Modify Cards",
                        cards: { zone: "Play", player: "You", cardType: "Character" },
                        modifier: { stat: "Strength", amount: 1 },
                        duration: { until: "End Of Turn" },
                    },
                    {
                        type: "Modify Cards",
                        cards: { zone: "Play", player: "You", cardType: "Character", where: { classification: "Hero" } },
                        modifier: {
                            gainAbility: {
                                type: "Triggered",
                                trigger: { event: "Challenge", attacker: "Self", defender: { zone: "Any", cardType: "Character", exclude: "Self" } },
                                effect: {
                                    type: "Sequence",
                                    effects: [
                                        { type: "Lose Lore", player: "Opponents", amount: 1 },
                                        { type: "Gain Lore", player: "You", amount: 1 },
                                    ],
                                },
                            },
                        },
                        duration: { until: "End Of Turn" },
                    },
                ],
            };
        playerAt(scenarioGame, 2).lore = 5;
        {
            scenarioLive = engine.startTurn(scenarioGame, { card: scenarioCards.lookup });
            scenarioResolution = scenarioLive;
            resolvePlayers(
                scenarioResolution,
                {},
                {
                    untilAction: true,
                },
            );
            scenarioGame = finished(scenarioResolution, true);
            if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
        }
        {
            if (!scenarioLive) throw new Error("No live turn");
            scenarioResolution = scenarioLive;
            const action: PlayerAction | undefined = (
                scenarioLive?.request?.type === "Action" ? scenarioLive.request.actions : getLegalActions(scenarioGame, { card: scenarioCards.lookup })
            ).find((action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName);
            if (!action) throw new Error("Expected a legal action");
            scenarioResolution.submit({ type: "Action", action });
            resolvePlayers(
                scenarioResolution,
                {
                    1: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 2 }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(2);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1]] }],
                            },
                        };
                    }),
                },
                {
                    untilAction: true,
                },
            );
            scenarioGame = finished(scenarioResolution, true);
            if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
        }
        expect(playerAt(scenarioGame, 2).lore).toBe(5);
        expect(playerAt(scenarioGame, 1).lore).toBe(0);
        expect(
            await (async () => {
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = {
                    type: "Challenge",
                    player: 1,
                    attacker: source.card,
                    defender: playerAt(scenarioGame, 2).play[0].card,
                };
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {},
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 2).lore).toBe(4);
        expect(playerAt(scenarioGame, 1).lore).toBe(1);
    });
});
