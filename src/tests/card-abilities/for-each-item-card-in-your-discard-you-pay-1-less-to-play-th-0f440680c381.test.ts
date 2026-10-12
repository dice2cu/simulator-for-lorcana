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
import { describe, expect, it } from "vitest";
// Generated ability ID: 0f440680c381
const abilityText = "For each item card in your discard, you pay 1 ⬡ less to play this character using her Shift ability.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Belle - Mechanic Extraordinaire",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("discounts Shift for items but not actions in the discard", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper", "Be Prepared"]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                fullName: "Belle Base",
                names: ["Belle"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                strength: 1,
                willpower: 5,
                lore: 0,
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 5 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = playerAt(scenarioGame, 1).hand[0];
        const base = playerAt(scenarioGame, 1).play[0].card;
        const scope = { source: { card: source, player: 1 as const, kind: "Ability" as const }, selected: [], parent: [] };
        expect(scenarioRules().shiftCosts(source, [{ type: "Ink", amount: 6 }], scope, [base])).toEqual([{ type: "Ink", amount: 4 }]);
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) =>
                        action.type === "Shift" &&
                        action.player === 1 &&
                        sameCard(action.card, source) &&
                        action.onto.length === 1 &&
                        sameCard(action.onto[0], base),
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 5 }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(5);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [
                                    {
                                        type: "Ink",
                                        player: 1,
                                        cards: [
                                            request.ink[0].cards[0],
                                            request.ink[0].cards[1],
                                            request.ink[0].cards[2],
                                            request.ink[0].cards[3],
                                            request.ink[0].cards[4],
                                        ],
                                    },
                                ],
                            },
                        };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).inkwell.filter((ink) => !ink.exerted)).toHaveLength(0);
    });
});
