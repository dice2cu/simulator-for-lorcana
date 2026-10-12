import * as engine from "../../engine/engine";
import { InvalidInput } from "../../engine/invalid-input";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/once-during-your-turn-you-may-pay-2-to-reveal-the-top-card-o-4c54e8bb6c91.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 4c54e8bb6c91
const abilityText =
    "Once during your turn, you may pay 2 ⬡ to reveal the top card of your deck. If it's a character card, put it into your hand. Otherwise, put it on the bottom of your deck.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Pongo - Determined Father",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each(["Character", "Item"])("pays 2 ink and places a revealed %s correctly", async (type) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Bottom",
                    names: ["Bottom"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
                type === "Character"
                    ? scenarioCards.fixture({
                          fullName: "Revealed",
                          names: ["Revealed"],
                          type: "Character",
                          colors: ["Amber"],
                          subtypes: [],
                          cost: 0,
                          inkwell: false,
                          strength: 0,
                          willpower: 1,
                          lore: 0,
                      })
                    : scenarioCards.fixture({
                          fullName: "Revealed",
                          names: ["Revealed"],
                          type: "Item",
                          colors: ["Amber"],
                          subtypes: [],
                          cost: 0,
                          inkwell: false,
                      }),
            ].reverse(),
        );
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 4 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const top = [...playerAt(scenarioGame, 1).deck].reverse()[1];
        const index = scenarioCards.definition(source.card.fullName).abilities?.findIndex((effect) => "type" in effect && effect.type === "Activated") ?? -1;
        if (index < 0) throw new Error("Expected a reveal ability");
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
                        ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source.card) && action.ability.i === index) ||
                            (action.type === "Boost" && action.ability === index && sameCard(action.card, source.card))),
                );
                if (!action) throw new Error("Expected a legal action");
                scenarioResolution.submit({ type: "Action", action });
                resolvePlayers(
                    scenarioResolution,
                    {
                        1: new ScriptedPlayer().on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Ink", amount: 2 }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(4);
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
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).inkwell.filter((ink) => !ink.exerted)).toHaveLength(2);
        if (type === "Character") expect(playerAt(scenarioGame, 1).hand).toContainEqual(top);
        else expect([...playerAt(scenarioGame, 1).deck].reverse()[0]).toEqual(top);
        expect(
            await (async () => {
                const action: PlayerAction | undefined = (
                    scenarioLive?.request?.type === "Action" ? scenarioLive.request.actions : getLegalActions(scenarioGame, { card: scenarioCards.lookup })
                ).find(
                    (action) =>
                        action.player === 1 &&
                        ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source.card) && action.ability.i === index) ||
                            (action.type === "Boost" && action.ability === index && sameCard(action.card, source.card))),
                );
                if (!action) return false;
                try {
                    if (scenarioLive) {
                        scenarioResolution = scenarioLive;
                        scenarioResolution.submit({ type: "Action", action });
                    } else scenarioResolution = engine.startAction(scenarioGame, action, { card: scenarioCards.lookup });
                } catch (error) {
                    if (error instanceof InvalidInput) return false;
                    throw error;
                }
                resolvePlayers(scenarioResolution, {}, { untilAction: Boolean(scenarioLive) });
                scenarioGame = finished(scenarioResolution, Boolean(scenarioLive));
                return true;
                return true;
            })(),
        ).toBe(false);
    });
});
