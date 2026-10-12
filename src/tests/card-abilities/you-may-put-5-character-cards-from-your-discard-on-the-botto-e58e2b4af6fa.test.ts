import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import { InvalidInput } from "../../engine/invalid-input";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay, isExerted } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/you-may-put-5-character-cards-from-your-discard-on-the-botto-e58e2b4af6fa.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: e58e2b4af6fa
const abilityText = "You may put 5 character cards from your discard on the bottom of your deck in any order to shift this character for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Maleficent & Diablo - Evil Incarnate",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([4, 5])("needs five discarded characters to Shift without ink (count: %s)", async (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Maleficent",
                    names: ["Maleficent"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 5,
                    lore: 0,
                }),
                exerted: !false,
                damage: 1,
            },
        ]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [
            ...Array.from({ length: count }, (_, index) =>
                scenarioCards.fixture({
                    fullName: "Payment " + index,
                    names: ["Payment " + index],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            ),
            scenarioCards.fixture({
                fullName: "Not A Character",
                names: ["Not A Character"],
                type: "Item",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
            }),
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            [
                scenarioCards.fixture({
                    fullName: "Existing Deck",
                    names: ["Existing Deck"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ].reverse(),
        );
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 0 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).hand[0];
        const base = playerAt(scenarioGame, 1).play[0];
        const payment = playerAt(scenarioGame, 1).discard.slice(0, count).reverse();
        const item = playerAt(scenarioGame, 1).discard[count];
        const existing = [...playerAt(scenarioGame, 1).deck].reverse()[0];
        expect(
            await (async () => {
                if (count === 4) {
                    const action: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) =>
                            action.type === "Shift" &&
                            action.player === 1 &&
                            sameCard(action.card, source) &&
                            action.onto.length === 1 &&
                            sameCard(action.onto[0], base.card),
                    );
                    if (!action) return false;
                    try {
                        scenarioResolution = engine.startAction(scenarioGame, action, { card: scenarioCards.lookup });
                    } catch (error) {
                        if (error instanceof InvalidInput) return false;
                        throw error;
                    }
                    resolvePlayers(scenarioResolution, {});
                    scenarioGame = finished(scenarioResolution);
                    return true;
                    return true;
                }
                if (count === 5) {
                    const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                        (action) =>
                            action.type === "Shift" &&
                            action.player === 1 &&
                            sameCard(action.card, source) &&
                            action.onto.length === 1 &&
                            sameCard(action.onto[0], base.card),
                    );
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer().on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([
                                {
                                    type: "Choose Cards",
                                    from: {
                                        cards: [
                                            scenarioCards.instance(3),
                                            scenarioCards.instance(4),
                                            scenarioCards.instance(5),
                                            scenarioCards.instance(6),
                                            scenarioCards.instance(7),
                                        ],
                                    },
                                    count: 5,
                                    cost: [{ type: "Move Card", cards: "Selected Cards", to: "Deck Bottom", order: "Chosen" }],
                                },
                            ]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(0);
                            return {
                                type: "Decision",
                                answer: {
                                    type: "Pay Cost",
                                    pay: true,
                                    payment: [
                                        {
                                            type: "Move Card",
                                            player: 1,
                                            cards: [
                                                scenarioCards.instance(3),
                                                scenarioCards.instance(4),
                                                scenarioCards.instance(5),
                                                scenarioCards.instance(6),
                                                scenarioCards.instance(7),
                                            ],
                                            to: "Deck Bottom",
                                        },
                                    ],
                                },
                            };
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(count === 5);
        expect(playerAt(scenarioGame, 1).play.map((ink) => ink.card)).toEqual(count === 5 ? [source] : [base.card]);
        expect(playerAt(scenarioGame, 1).discard).toEqual(count === 5 ? [item] : [...payment].reverse().concat(item));
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(count === 5 ? [...payment, existing] : [existing]);
        if (count === 5) {
            expect(!isExerted(scenarioRules(), source)).toBe(false);
            expect(inPlay(scenarioRules(), source).damage).toBe(1);
            expect(inPlay(scenarioRules(), source).under).toContainEqual({ card: base.card, faceDown: false });
        }
        expect(playerAt(scenarioGame, 1).inkwell.map((ink) => ink.card)).toHaveLength(0);
    });
});
