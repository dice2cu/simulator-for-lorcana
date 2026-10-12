import * as engine from "../../engine/engine";
import { InvalidInput } from "../../engine/invalid-input";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/reckless-this-character-can-t-quest-and-must-challenge-each-ce1b6b542acb.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: ce1b6b542acb
const abilityText = "Reckless (This character can't quest and must challenge each turn if able.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Arthur - Novice Sparrow",
    "Della Duck - Unstoppable Mom",
    "Felicia - Always Hungry",
    "Gaston - Arrogant Hunter",
    "Te Kā - The Burning One",
    "Tong - Survivor",
    "Tuk Tuk - Wrecking Ball",
    "Ares - God of War",
    "Bronx - Ferocious Beast",
    "Copper - On the Scent",
    "Denahi - Impatient Hunter",
    "Hercules - Daring Demigod",
    "Jebidiah Farnsworth - Cookie",
    "Liquidator - Iced Over",
    "Maui - Hero to All",
    "Maui - Soaring Demigod",
    "Pacha - Panicked Customer",
    "Tigger - Hunny Barbarian",
    "Aladdin - Barreling Through",
    "Mulan - Charging Ahead",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: "Arthur - Novice Sparrow", exerted: !true }]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [{ definition: "HeiHei - Boat Snack", exerted: !false }]);
        const reckless = playerAt(scenarioGame, 1).play[0];
        const quested = await (async () => {
            const action: PlayerAction | undefined = { type: "Quest", player: 1, card: reckless.card };
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
        })();
        const actions = 1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(quested).toBe(false);
        expect(actions.some((action) => action.type === "Quest" && sameCard(cardInAction(action), reckless.card))).toBe(false);
        expect(actions.some((action) => action.type === "Challenge" && sameCard(cardInAction(action), reckless.card))).toBe(true);
    });
});
