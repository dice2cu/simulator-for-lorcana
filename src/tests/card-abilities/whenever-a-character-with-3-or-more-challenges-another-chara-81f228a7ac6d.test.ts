import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-a-character-with-3-or-more-challenges-another-chara-81f228a7ac6d.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 81f228a7ac6d
const abilityText =
    "Whenever a character with 3 ¤ or more challenges another character while here, gain 1 lore. If the challenging character has 6 ¤ or more, gain 3 lore instead.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Snuggly Duckling - Disreputable Pub",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "Mickey Mouse - Brave Little Tailor"]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["Mickey Mouse - True Friend"]);
        const source = playerAt(scenarioGame, 1).play[0],
            target = playerAt(scenarioGame, 2).play[0];
        target.exerted = true;
        const attacker = playerAt(scenarioGame, 1).play[1];
        (() => {
            const card = scenarioCards.create(scenarioCards.definition("Motunui - Island Paradise"));
            playerAt(scenarioGame, 2).play.push({ card, damage: 0, exerted: false, drying: false });
            return card;
        })();
        const printed = scenarioCards.definition(attacker.card.fullName);
        if (printed.type !== "Character") throw new Error("Expected a character");
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, scenarioCards.fixture({ ...printed, strength: 6 })]);
        const challenging = playerAt(scenarioGame, 1).play[1];
        challenging.location = playerAt(scenarioGame, 1).play[0].card;
        {
            const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: challenging.card, defender: target.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).lore).toBe(3);
    });
});
