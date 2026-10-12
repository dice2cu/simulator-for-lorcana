import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/when-this-character-is-banished-gain-2-lore-32ff4c967084.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 32ff4c967084
const abilityText = "When this character is banished, gain 2 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Baloo - von Bruinwald XIII",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Condition",
                    names: ["Condition"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Seven Dwarfs", "Princess"],
                    cost: 0,
                    inkwell: false,
                    strength: 1,
                    willpower: 5,
                    lore: 1,
                }),
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Banisher",
                    names: ["Banisher"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 20,
                    willpower: 20,
                    lore: 1,
                }),
                exerted: !false,
            },
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [prototypeCardName, prototypeCardName]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, [prototypeCardName, prototypeCardName].reverse());
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const banisher = playerAt(scenarioGame, 2).play[0];
        {
            const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source.card, defender: banisher.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).lore).toBe(2);
    });
});
