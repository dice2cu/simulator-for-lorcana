import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import { InvalidInput } from "../../engine/invalid-input";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/your-pirate-characters-may-move-here-for-free-4c29b6337bab.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 4c29b6337bab
const abilityText = "Your Pirate characters may move here for free.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Jolly Roger - Hook's Ship",
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
            {
                definition: scenarioCards.fixture({
                    fullName: "Pirate Mover",
                    names: ["Pirate Mover"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Pirate"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Wrong Mover",
                    names: ["Wrong Mover"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
        ]);
        const p = playerAt(scenarioGame, 1),
            location = playerAt(scenarioGame, 1).play[0],
            eligible = playerAt(scenarioGame, 1).play[1],
            ineligible = playerAt(scenarioGame, 1).play[2];
        (() => {
            const definition = scenarioCards.definition(location.card.fullName);
            if (definition.type !== "Location") throw new Error("Expected a location");
            scenarioCards.definitions.set(definition.fullName, { ...definition, moveCost: 3 });
        })();
        const freeMove = scenarioRules()
            .alternateCosts(eligible.card, "Move", location.card)
            .find((entry) => entry.rule.cost.length === 0);
        if (!freeMove) throw new Error("Missing free movement rule");
        expect(freeMove.rule.cost).toHaveLength(0);
        expect(scenarioRules().moveCost(ineligible.card, location.card, true)).toBe(3);
        const move = (1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).find(
            (action) => action.type === "Move" && action.card.i === eligible.card.i && action.alternateCost,
        );
        if (!move) throw new Error("The free movement rule did not produce a legal move");
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = move;
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {});
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).play.find((state) => state.card.i === eligible.card.i)?.location).toEqual(location.card);
        expect(
            await (async () => {
                const action: PlayerAction | undefined = { type: "Move", player: 1, card: ineligible.card, location: location.card };
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
