import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, isExerted } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/this-character-enters-play-exerted-84dab8d8ea28.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 84dab8d8ea28
const abilityText = "This character enters play exerted.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Baymax - Low Battery",
    "Bolt - Down but Not Out",
    "Sleepy - Nodding Off",
    "Flash - Records Specialist",
    "Louis - Endearing Alligator",
    "Peter Pan - Never Land Prankster",
    "Flotsam - Wicked Defender",
    "Prince Eric - Grim Groom",
    "Razoul - Unyielding Guard",
    "Hercules - Manipulated Hero",
    "Iago - Raucous Lookout",
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
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 20 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) => action.type === "Play" && action.player === 1 && action.card.fullName === prototypeCardName,
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Pay Cost", (request) => {
                    expect(request.optional).toBe(false);
                    expect(request.cost).toEqual([{ type: "Ink", amount: 2 }]);
                    expect(request.ink[0].player).toBe(1);
                    expect(request.ink[0].cards).toHaveLength(20);
                    return {
                        type: "Decision",
                        answer: {
                            type: "Pay Cost",
                            pay: true,
                            payment: [{ type: "Ink", player: 1, cards: [request.ink[0].cards[0], request.ink[0].cards[1]] }],
                        },
                    };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        const character = playerAt(scenarioGame, 1).play[0];
        expect(!isExerted(scenarioRules(), character.card)).toBe(false);
    });
});
