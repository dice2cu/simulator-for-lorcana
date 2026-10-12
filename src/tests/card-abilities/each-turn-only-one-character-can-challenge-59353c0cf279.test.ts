import * as engine from "../../engine/engine";
import { InvalidInput } from "../../engine/invalid-input";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/each-turn-only-one-character-can-challenge-59353c0cf279.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 59353c0cf279
const abilityText = "Each turn, only one character can challenge.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Prince Charming - Protector of the Realm",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Second Attacker",
                    names: ["Second Attacker"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 1,
                    willpower: 5,
                    lore: 0,
                }),
                exerted: !true,
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "First Target",
                    names: ["First Target"],
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
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Second Target",
                    names: ["Second Target"],
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
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [firstAttacker, secondAttacker] = playerAt(scenarioGame, 1).play;
        const [firstTarget, secondTarget] = playerAt(scenarioGame, 2).play;
        firstAttacker.exerted = !true;
        firstAttacker.drying = false;
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
        const firstChallenge = await (async () => {
            if (!scenarioLive) throw new Error("No live turn");
            scenarioResolution = scenarioLive;
            const action: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: firstAttacker.card, defender: firstTarget.card };
            if (!action) throw new Error("Expected a legal action");
            scenarioResolution.submit({ type: "Action", action });
            resolvePlayers(
                scenarioResolution,
                {},
                {
                    untilAction: true,
                },
            );
            scenarioGame = finished(scenarioResolution, true);
            if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
            return true;
        })();
        const secondChallenge = await (async () => {
            const action: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: secondAttacker.card, defender: secondTarget.card };
            if (!action) return false;
            try {
                if (scenarioLive) {
                    scenarioResolution = scenarioLive;
                    scenarioResolution.submit({ type: "Action", action });
                } else scenarioResolution = engine.startAction(scenarioGame, action, { card: scenarioCards.lookup });
            } catch (error) {
                if (error instanceof InvalidInput) return false;
                throw error;
            }
            resolvePlayers(scenarioResolution, {}, { untilAction: Boolean(scenarioLive) });
            scenarioGame = finished(scenarioResolution, Boolean(scenarioLive));
            return true;
            return true;
        })();
        expect(firstChallenge).toBe(true);
        expect(secondChallenge).toBe(false);
    });
});
