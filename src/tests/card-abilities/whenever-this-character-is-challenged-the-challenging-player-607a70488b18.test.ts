import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-this-character-is-challenged-the-challenging-player-607a70488b18.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 607a70488b18
const abilityText = "Whenever this character is challenged, the challenging player chooses and discards a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Anastasia - Bossy Stepsister",
    "Flynn Rider - Charming Rogue",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: prototypeCardName, exerted: true }]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Challenger",
                names: ["Challenger"],
                type: "Character",
                colors: ["Amber"],
                subtypes: ["Storyborn"],
                cost: 0,
                inkwell: true,
                strength: 20,
                willpower: 30,
                lore: 0,
                abilities: [{ type: "Keyword", keyword: { name: "Evasive" } }],
            }),
        ]);
        const source = playerAt(scenarioGame, 1).play[0];
        const defender = playerAt(scenarioGame, 1).play[0];
        const challenger = playerAt(scenarioGame, 2).play[0];
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, ["Dinglehopper"]);
        const discarded = playerAt(scenarioGame, 2).hand[0];
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Challenge", player: 2, attacker: challenger.card, defender: defender.card };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    2: new ScriptedPlayer().on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 2).discard).toContainEqual(discarded);
    });
});
