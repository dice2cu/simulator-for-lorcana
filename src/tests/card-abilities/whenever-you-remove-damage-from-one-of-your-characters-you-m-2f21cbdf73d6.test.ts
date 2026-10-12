import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/whenever-you-remove-damage-from-one-of-your-characters-you-m-2f21cbdf73d6.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 2f21cbdf73d6
const abilityText =
    "Whenever you remove damage from one of your characters, you may ready them. If you do, they can't quest or challenge for the rest of this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mirabel Madrigal - Family Guardian",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            "Dinglehopper",
            {
                definition: scenarioCards.fixture({
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 3,
                    lore: 0,
                }),
                damage: 1,
                exerted: true,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [source, healer, target] = playerAt(scenarioGame, 1).play;
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                    (action) =>
                        action.player === 1 &&
                        ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, healer.card) && action.ability.i === 0) ||
                            (action.type === "Boost" && action.ability === 0 && sameCard(action.card, healer.card))),
                );
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Pay Cost", (request) => {
                            expect(request.optional).toBe(false);
                            expect(request.cost).toEqual([{ type: "Exert", cards: { cards: [scenarioCards.instance(2)] } }]);
                            expect(request.ink[0].player).toBe(1);
                            expect(request.ink[0].cards).toHaveLength(0);
                            return {
                                type: "Decision",
                                answer: { type: "Pay Cost", pay: true, payment: [{ type: "Exert", player: 1, cards: [scenarioCards.instance(2)] }] },
                            };
                        })
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                        })
                        .on("Choose Amount", (request) => {
                            expect(request.min).toBe(0);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Amount", amount: 1 } };
                        })
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(!inPlay(scenarioRules(), target.card).exerted).toBe(true);
        expect(scenarioRules().restricted(target.card, "Can't Quest")).toBe(true);
        expect(scenarioRules().restricted(target.card, "Can't Challenge")).toBe(true);
    });
});
