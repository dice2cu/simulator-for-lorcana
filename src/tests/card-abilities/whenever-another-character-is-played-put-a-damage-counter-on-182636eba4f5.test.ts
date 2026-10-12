import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/whenever-another-character-is-played-put-a-damage-counter-on-182636eba4f5.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 182636eba4f5
const abilityText = "Whenever another character is played, put a damage counter on them.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Queen of Hearts - Unpredictable Bully",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, ["Mickey Mouse - True Friend"]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 3 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const card = playerAt(scenarioGame, 1).hand[0];
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) => action.type === "Play" && action.player === 1 && action.card.fullName === card.fullName,
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Pay Cost", (request) => {
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
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), card).damage ?? 0).toBe(1);
    });
});
