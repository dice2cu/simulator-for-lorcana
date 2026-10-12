import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-one-of-your-gargoyle-characters-challenges-another-0f748e668a09.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 0f748e668a09
const abilityText = "Whenever one of your Gargoyle characters challenges another character, gain 1 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Goliath - Guardian of Castle Wyvern",
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
                    fullName: "Attacker",
                    names: ["Attacker"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Gargoyle", "Hyena", "Super"],
                    cost: 0,
                    inkwell: false,
                    strength: 2,
                    willpower: 20,
                    lore: 1,
                }),
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Defender",
                    names: ["Defender"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 1,
                    willpower: 20,
                    lore: 1,
                }),
                damage: 1,
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const attacker = playerAt(scenarioGame, 1).play[1];
        const defender = playerAt(scenarioGame, 2).play[0];
        {
            const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: attacker.card, defender: defender.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).lore).toBe(1);
    });
});
