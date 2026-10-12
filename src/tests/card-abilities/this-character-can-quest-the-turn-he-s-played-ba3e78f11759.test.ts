import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/this-character-can-quest-the-turn-he-s-played-ba3e78f11759.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: ba3e78f11759
const abilityText = "This character can quest the turn he's played.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Dash Parr - Lava Runner",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const p = playerAt(scenarioGame, 1),
            s = playerAt(scenarioGame, 1).play[0];
        s.drying = true;
        const actions = 1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(actions).toContainEqual(expect.objectContaining({ type: "Quest", card: s.card }));
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: s.card };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {});
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
    });
});
