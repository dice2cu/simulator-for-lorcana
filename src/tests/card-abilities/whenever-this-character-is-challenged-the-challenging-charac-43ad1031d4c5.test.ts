import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-this-character-is-challenged-the-challenging-charac-43ad1031d4c5.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 43ad1031d4c5
const abilityText = "Whenever this character is challenged, the challenging character's player discards all cards in their hand.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Belle - Hidden Archer",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["Mickey Mouse - Brave Little Tailor"]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, ["Dinglehopper", "Dinglehopper"]);
        const cards = [...playerAt(scenarioGame, 2).hand];
        const source = playerAt(scenarioGame, 1).play[0],
            attacker = playerAt(scenarioGame, 2).play[0];
        source.exerted = true;
        {
            const action0: PlayerAction | undefined = { type: "Challenge", player: 2, attacker: attacker.card, defender: source.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 2).discard).toEqual(expect.arrayContaining(cards));
    });
});
