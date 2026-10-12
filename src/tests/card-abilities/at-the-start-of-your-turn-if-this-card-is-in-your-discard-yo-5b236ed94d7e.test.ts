import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, printedEffect, isExerted } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/at-the-start-of-your-turn-if-this-card-is-in-your-discard-yo-5b236ed94d7e.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 5b236ed94d7e
const abilityText = "At the start of your turn, if this card is in your discard, you may play her and she enters play exerted.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Lilo - Escape Artist",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, [prototypeCardName]);
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).discard[0],
            ability: Effect = printedEffect(scenarioCards.definition(source.fullName), 0);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 10 }, () => ({
            card: scenarioCards.create("Dinglehopper"),
            exerted: false,
        })); /* she is played paying her cost */ /* "you may": yes */
        {
            const sourceDefinition = scenarioCards.definition(source.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    })
                    .on("Pay Cost", (request) => {
                        expect(request.optional).toBe(false);
                        expect(request.cost).toEqual([{ type: "Ink", amount: 2 }]);
                        expect(request.ink[0].player).toBe(1);
                        expect(request.ink[0].cards).toHaveLength(10);
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
        expect(playerAt(scenarioGame, 1).play.map((entry) => entry.card)).toContainEqual(source);
        expect(!isExerted(scenarioRules(), source)).toBe(false);
    });
});
