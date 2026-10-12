import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { describe, expect, it } from "vitest";
// Generated ability ID: 19fc18846050
const abilityText = "During opponents' turns, if an effect would cause you to discard one or more cards from your hand, you don't discard.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Magica De Spell - Cruel Sorceress",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([true, false])("prevents effect discards only during an opponent turn (%s)", async (opponentTurn) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, ["Dinglehopper"]);
        scenarioGame.turn = { number: scenarioGame.turn.number, player: opponentTurn ? 2 : 1 };
        const source = playerAt(scenarioGame, 1).play[0].card;
        const protectedCard = playerAt(scenarioGame, 1).hand[0];
        {
            const sourceDefinition = scenarioCards.definition(source.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                { type: "Discard", cards: { cards: [protectedCard] } },
                { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).hand).toEqual(opponentTurn ? [protectedCard] : []);
        expect(playerAt(scenarioGame, 1).discard).toEqual(opponentTurn ? [] : [protectedCard]);
    });
});
