import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/each-opponent-plays-with-the-top-card-of-their-deck-faceup-913a8ea959f5.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 913a8ea959f5
const abilityText = "Each opponent plays with the top card of their deck faceup.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Roz - Always Watching",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("reveals opponents’ top cards, but not your own", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper", "Magic Mirror"]);
        playerAt(scenarioGame, 2).deck = cardIds(scenarioCards, ["Pawpsicle", "Dinglehopper"]);
        const ownTop = playerAt(scenarioGame, 1).deck[0];
        const [top, next] = playerAt(scenarioGame, 2).deck;
        expect(scenarioRules().revealedCards()).not.toContainEqual(ownTop);
        expect(scenarioRules().revealedCards()).toEqual([top]);
        const source = playerAt(scenarioGame, 1).play[0].card;
        {
            const sourceDefinition = scenarioCards.definition(source.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                { type: "Draw", player: "Opponents", amount: 1 },
                { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 2).hand).toEqual([top]);
        expect(scenarioRules().revealedCards()).toEqual([next]);
        {
            const sourceDefinition = scenarioCards.definition(source.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                { type: "Draw", player: "Opponents", amount: 1 },
                { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(scenarioRules().revealedCards()).toEqual([]);
    });
});
