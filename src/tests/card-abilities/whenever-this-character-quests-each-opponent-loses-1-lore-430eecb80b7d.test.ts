import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-this-character-quests-each-opponent-loses-1-lore-430eecb80b7d.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 430eecb80b7d
const abilityText = "Whenever this character quests, each opponent loses 1 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Jasmine - Rebellious Princess",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Jasmine - Rebellious Princess",
                    names: ["Jasmine"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Hero", "Princess"],
                    cost: 3,
                    inkwell: true,
                    strength: 2,
                    willpower: 3,
                    lore: 2,
                }),
                exerted: !true,
            },
        ]);
        playerAt(scenarioGame, 2).lore = 3;
        const player = playerAt(scenarioGame, 1);
        const character = playerAt(scenarioGame, 1).play[0];
        {
            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: character.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 2).lore).toBe(2);
    });
});
