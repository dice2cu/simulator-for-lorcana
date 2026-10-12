import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
import { describe, expect, it } from "vitest";
// Generated ability ID: ffcfb6f36917
const abilityText = "Shift a character from your discard for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Metamorphosis",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("uses an explicit free Shift action from discard and retains the base underneath", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                ...{
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 2,
                    willpower: 10,
                    lore: 0,
                },
                fullName: "Base",
                names: ["Shifter"],
            },
        ]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [
            {
                ...{
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 2,
                    willpower: 10,
                    lore: 0,
                },
                fullName: "Shifter",
                names: ["Shifter"],
                cost: 9,
                abilities: [{ type: "Keyword", keyword: { name: "Shift", cost: [{ type: "Ink", amount: 5 }] } }],
            },
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const base = playerAt(scenarioGame, 1).play[0].card,
            shifter = playerAt(scenarioGame, 1).discard[0];
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Ink", amount: 3 }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(3);
                            return {
                                type: "Decision",
                                answer: {
                                    type: "Pay Cost",
                                    pay: true,
                                    payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1], request.ink[0].cards[2]] }],
                                },
                            };
                        })
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                        })
                        .on("Action", (request) => {
                            const expected = { type: "Shift", player: 1, card: scenarioCards.instance(2), onto: [scenarioCards.instance(1)], ability: 0 };
                            const options = request.actions.filter((option) => JSON.stringify(option.action) === JSON.stringify(expected));
                            expect(options).toHaveLength(1);
                            return { type: "Action", option: options[0].option };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(inPlay(scenarioRules(), shifter).under).toEqual([{ card: base, faceDown: false }]);
        expect(playerAt(scenarioGame, 1).inkwell.every((ink) => ink.exerted)).toBe(true);
    });
});
