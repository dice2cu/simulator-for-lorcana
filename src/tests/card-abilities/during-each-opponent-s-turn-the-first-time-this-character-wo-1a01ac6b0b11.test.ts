import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/during-each-opponent-s-turn-the-first-time-this-character-wo-1a01ac6b0b11.test.ts
import { describe, expect, it } from "vitest";
import type { CharacterCard } from "../../model/card";
// Generated ability ID: 1a01ac6b0b11
const abilityText = "During each opponent's turn, the first time this character would take damage, she takes no damage instead.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Lilo - Bundled Up",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        const printed = scenarioCards.definition(prototypeCardName);
        if (printed.type !== "Character") throw new Error("Expected a character");
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: { ...printed, willpower: 3 }, exerted: true }]);
        const attacker: CharacterCard = {
            fullName: "Damage attacker",
            names: ["Damage attacker"],
            type: "Character" as const,
            colors: [],
            subtypes: [],
            cost: 0,
            inkwell: false,
            strength: 2,
            willpower: 10,
            lore: 0,
        };
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [attacker, attacker]);
        const player = playerAt(scenarioGame, 1);
        const opponent = playerAt(scenarioGame, 2);
        const source = playerAt(scenarioGame, 1).play[0];
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
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
        expect(
            await (async () => {
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = { type: "Challenge", player: 2, attacker: opponent.play[0].card, defender: source.card };
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
            })(),
        ).toBe(true);
        expect(inPlay(scenarioRules(), source.card).damage ?? 0).toBe(0);
        expect(
            await (async () => {
                if (!scenarioLive) throw new Error("No live turn");
                scenarioResolution = scenarioLive;
                const action: PlayerAction | undefined = { type: "Challenge", player: 2, attacker: opponent.play[1].card, defender: source.card };
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
            })(),
        ).toBe(true);
        expect(inPlay(scenarioRules(), source.card).damage ?? 0).toBe(2);
    });
});
