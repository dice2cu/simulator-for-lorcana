import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import { InvalidInput } from "../../engine/invalid-input";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { sameCard } from "../../engine/identity";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/ready-this-character-he-can-t-quest-for-the-rest-of-this-tur-23dbc7b819b0.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 23dbc7b819b0
const abilityText = "Ready this character. He can't quest for the rest of this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Maui - Whale",
    "Monstro - Infamous Whale",
    "Shere Khan - Fierce and Furious",
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
            {
                definition: scenarioCards.fixture({
                    fullName: "Maui - Whale",
                    names: ["Maui"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Hero", "Deity"],
                    cost: 7,
                    inkwell: true,
                    strength: 8,
                    willpower: 8,
                    lore: 1,
                }),
                exerted: !false,
            },
        ]);
        playerAt(scenarioGame, 1).inkwell = Array.from({ length: 2 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) =>
                    action.player === 1 &&
                    ((action.type === "Activate" && "ability" in action && sameCard(action.ability.card, source.card) && action.ability.i === 1) ||
                        (action.type === "Boost" && action.ability === 1 && sameCard(action.card, source.card))),
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Pay Cost", (request) => {
                    expect(request.optional).toBe(false);
                    expect(request.cost).toEqual([{ type: "Ink", amount: 2 }]);
                    expect(request.ink[0].player).toBe(1);
                    expect(request.ink[0].cards).toHaveLength(2);
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
        expect(!inPlay(scenarioRules(), source.card).exerted).toBe(true);
        expect(
            await (async () => {
                const action: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
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
            })(),
        ).toBe(false);
    });
});
