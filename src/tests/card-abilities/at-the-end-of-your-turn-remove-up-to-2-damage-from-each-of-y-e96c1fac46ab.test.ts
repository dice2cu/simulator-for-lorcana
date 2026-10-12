import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/at-the-end-of-your-turn-remove-up-to-2-damage-from-each-of-y-e96c1fac46ab.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: e96c1fac46ab
const abilityText = "At the end of your turn, remove up to 2 damage from each of your characters.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Piglet - Cocoa Maker",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper"]);
        playerAt(scenarioGame, 2).deck = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper"]);
        const printed = scenarioCards.definition(prototypeCardName);
        if (printed.type !== "Character") throw new Error("Expected a character");
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            // The original healing fixture used 5 damage. Keep it below lethal damage.
            { definition: scenarioCards.fixture({ ...printed, willpower: 8 }), damage: 5 },
            {
                definition: scenarioCards.fixture({
                    fullName: "Other",
                    names: ["Other"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                }),
                damage: 4,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
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
        {
            if (!scenarioLive) throw new Error("No live turn");
            scenarioResolution = scenarioLive;
            const action: PlayerAction | undefined = { type: "End Turn", player: 1 };
            if (!action) throw new Error("Expected a legal action");
            scenarioResolution.submit({ type: "Action", action });
            resolvePlayers(
                scenarioResolution,
                {
                    1: new ScriptedPlayer()
                        .on("Choose Amount", (request) => {
                            expect(request.min).toBe(0);
                            expect(request.max).toBe(2);
                            return { type: "Decision", answer: { type: "Choose Amount", amount: 2 } };
                        })
                        .on("Choose Amount", (request) => {
                            expect(request.min).toBe(0);
                            expect(request.max).toBe(2);
                            return { type: "Decision", answer: { type: "Choose Amount", amount: 2 } };
                        }),
                },
                {
                    untilAction: true,
                },
            );
            scenarioGame = finished(scenarioResolution, true);
            if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
        }
        expect(playerAt(scenarioGame, 1).play.map((card) => inPlay(scenarioRules(), card.card).damage ?? 0)).toEqual([3, 2]);
    });
});
