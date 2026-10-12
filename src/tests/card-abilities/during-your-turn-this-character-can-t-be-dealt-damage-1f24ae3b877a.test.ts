import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/during-your-turn-this-character-can-t-be-dealt-damage-1f24ae3b877a.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 1f24ae3b877a
const abilityText = "During your turn, this character can't be dealt damage.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Chief Bogo - Calling the Shots",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([1, 2] as const)("checks whose turn it is (%s)", async (activePlayer) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        const printed = scenarioCards.definition(prototypeCardName);
        if (printed.type !== "Character") throw new Error("Expected a character");
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            // The damage assertion needs a surviving character on the opponent's turn.
            { ...printed, willpower: Math.max(printed.willpower, 4) },
        ]);
        const player = playerAt(scenarioGame, 1);
        const character = playerAt(scenarioGame, 1).play[0];
        scenarioGame.turn = { number: scenarioGame.turn.number, player: activePlayer };
        {
            const sourceDefinition = scenarioCards.definition(character.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                { type: "Deal Damage", amount: 3, cards: { cards: [character.card] } },
                { card: character.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), character.card).damage ?? 0).toBe(activePlayer === 1 ? 0 : 3);
    });
});
