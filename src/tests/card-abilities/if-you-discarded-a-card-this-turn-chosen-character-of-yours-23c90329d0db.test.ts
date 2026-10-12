import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, keywords as cardKeywords } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/if-you-discarded-a-card-this-turn-chosen-character-of-yours-23c90329d0db.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 23c90329d0db
const abilityText =
    "If you discarded a card this turn, chosen character of yours gains Resist +1 until the start of your next turn. (Damage dealt to them is reduced by 1.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Discarded Armor",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "Mickey Mouse - True Friend"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 10 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper", "Dinglehopper"]);
        const source = playerAt(scenarioGame, 1).play[0];
        const target = playerAt(scenarioGame, 1).play[1];
        const historyAction = scenarioCards.fixture({
            fullName: "History Action",
            names: ["History Action"],
            type: "Action",
            colors: ["Amber"],
            subtypes: [],
            cost: 0,
            inkwell: true,
            effect: { type: "Discard", cards: { zone: "Hand", player: "You", take: 1 } },
        });
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [historyAction, "Dinglehopper"]);
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
                ).find((action) => action.type === "Play" && action.player === 1 && action.card.fullName === historyAction.fullName);
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
                                expect(request.cost).toEqual([{ type: "Exert", cards: { cards: [scenarioCards.instance(1)] } }]);
                                expect(request.ink[0].player).toBe(1);
                                expect(request.ink[0].cards).toHaveLength(10);
                                return {
                                    type: "Decision",
                                    answer: { type: "Pay Cost", pay: true, payment: [{ type: "Exert", player: 1, cards: [scenarioCards.instance(1)] }] },
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
        expect(cardKeywords(scenarioRules(), target.card).map((keyword) => keyword.toLowerCase())).toContainEqual("resist");
    });
});
