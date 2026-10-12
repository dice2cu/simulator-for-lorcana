import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/chosen-character-gets-2-this-turn-whenever-they-challenge-an-44958159cf36.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 44958159cf36
const abilityText = "Chosen character gets +2 ¤ this turn. Whenever they challenge another character this turn, you may draw a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Medallion Weights",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Aladdin",
                    names: ["Aladdin"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Pirate", "Villain"],
                    cost: 0,
                    inkwell: false,
                    strength: 5,
                    willpower: 5,
                    lore: 2,
                }),
                damage: 2,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
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
                    willpower: 20,
                    lore: 0,
                }),
                exerted: true,
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 2 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, [prototypeCardName].reverse());
        const [source, target] = playerAt(scenarioGame, 1).play;
        const ability: Effect = {
            type: "Choose Cards",
            from: { zone: "Play", cardType: "Character" },
            count: 1,
            effect: {
                type: "Sequence",
                effects: [
                    { type: "Modify Cards", cards: "Selected Cards", modifier: { stat: "Strength", amount: 2 }, duration: { until: "End Of Turn" } },
                    {
                        type: "Create Trigger",
                        trigger: {
                            event: "Challenge",
                            attacker: { capture: "Selected Cards" },
                            defender: { zone: "Any", cardType: "Character", exclude: { capture: "Selected Cards" } },
                        },
                        effect: { type: "Optional", effect: { type: "Draw", player: "You", amount: 1 } },
                        duration: { until: "End Of Turn" },
                    },
                ],
            },
        };
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
        expect(
            await (async () => {
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = (
                    scenarioLive?.request?.type === "Action" ? scenarioLive.request.actions : getLegalActions(scenarioGame, { card: scenarioCards.lookup })
                ).find(
                    (action) =>
                        action.player === 1 &&
                        ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source.card) && action.ability.i === 0) ||
                            (action.type === "Boost" && action.ability === 0 && sameCard(action.card, source.card))),
                );
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer()
                            .on("Pay Cost", (request) => {
                                expect(request.optional).toBe(false);
                                expect(request.cost).toEqual([
                                    { type: "Exert", cards: { cards: [scenarioCards.instance(1)] } },
                                    { type: "Ink", amount: 2 },
                                ]);
                                expect(request.ink[0].player).toBe(1);
                                expect(request.ink[0].cards).toHaveLength(2);
                                return {
                                    type: "Decision",
                                    answer: {
                                        type: "Pay Cost",
                                        pay: true,
                                        payment: [
                                            { type: "Exert", player: 1, cards: [scenarioCards.instance(1)] },
                                            { type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1]] },
                                        ],
                                    },
                                };
                            })
                            .on("Choose Cards", (request) => {
                                expect(request.min).toBe(1);
                                expect(request.max).toBe(1);
                                return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                            }),
                    },
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                return true;
            })(),
        ).toBe(true);
        expect(scenarioRules().characteristic(target.card, "Strength")).toBe(7);
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(0);
        expect(
            await (async () => {
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = {
                    type: "Challenge",
                    player: 1,
                    attacker: target.card,
                    defender: playerAt(scenarioGame, 2).play[0].card,
                };
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer().on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        }),
                    },
                    {
                        untilAction: true,
                    },
                );
                scenarioGame = finished(scenarioResolution, true);
                if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toHaveLength(1);
    });
});
