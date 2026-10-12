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
// Generated ability ID: 53597c887677
const abilityText = "You pay 1 ⬡ less to shift a character on top of this character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Belle - Always Reading",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("discounts a concrete Shift by one ink", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        const printed = scenarioCards.definition(prototypeCardName);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            {
                fullName: "Shifter",
                names: printed.names,
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 6,
                inkwell: false,
                strength: 1,
                willpower: 5,
                lore: 0,
                abilities: [{ type: "Keyword", keyword: { name: "Shift", cost: [{ type: "Ink", amount: 5 }] } }],
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 4 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const source = playerAt(scenarioGame, 1).play[0].card;
        const base = source;
        const shifter = playerAt(scenarioGame, 1).hand[0];
        expect(
            scenarioRules().shiftCosts(
                shifter,
                [{ type: "Ink", amount: 5 }],
                {
                    source: { card: shifter, player: 1, kind: "Ability" },
                    selected: [],
                    parent: [],
                },
                [base],
            ),
        ).toEqual([{ type: "Ink", amount: 4 }]);
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) =>
                        action.type === "Shift" &&
                        action.player === 1 &&
                        sameCard(action.card, shifter) &&
                        action.onto.length === 1 &&
                        sameCard(action.onto[0], base),
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 4 }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(4);
                        return {
                            type: "Decision",
                            answer: {
                                type: "Pay Cost",
                                pay: true,
                                payment: [
                                    {
                                        type: "Ink",
                                        player: 1,
                                        cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2], request.ink[0].cards[3]],
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
