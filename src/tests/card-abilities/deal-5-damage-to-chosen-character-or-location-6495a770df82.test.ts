import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/deal-5-damage-to-chosen-character-or-location-6495a770df82.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 6495a770df82
const abilityText = "Deal 5 damage to chosen character or location.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "And Then Along Came Zeus",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 4 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Target Location",
                    names: ["Target Location"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 99,
                    lore: 0,
                    moveCost: 0,
                }),
            },
        ]);
        const target = playerAt(scenarioGame, 2).play[0];
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Pay Cost", (request) => {
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
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(6)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), target.card).damage ?? 0).toBe(5);
    });
});
