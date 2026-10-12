import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-this-character-challenges-another-character-with-3-5bd32da3e2e6.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 5bd32da3e2e6
const abilityText = "Whenever this character challenges another character with 3 ¤ or less, banish that character. (No damage is dealt in that challenge.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Boo - Energetic Child",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["Mickey Mouse - True Friend"]);
        const source = playerAt(scenarioGame, 1).play[0],
            target = playerAt(scenarioGame, 2).play[0];
        target.exerted = true;
        {
            const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source.card, defender: target.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 2).discard).toContainEqual(target.card);
        expect(inPlay(scenarioRules(), source.card).damage ?? 0).toBe(0);
    });
});
