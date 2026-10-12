import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/challenger-4-while-challenging-this-character-gets-4-5440b5bcb26a.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 5440b5bcb26a
const abilityText = "Challenger +4 (While challenging, this character gets +4 ¤.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Druun - Ravenous Plague",
    "Simba - Returned King",
    "Zeus - God of Lightning",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Druun - Ravenous Plague",
                    names: ["Druun"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Villain"],
                    cost: 4,
                    inkwell: true,
                    strength: 1,
                    willpower: 5,
                    lore: 1,
                }),
                exerted: !true,
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Test Defender",
                    names: ["Test Defender"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 99,
                    lore: 0,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const attacker = playerAt(scenarioGame, 1).play[0];
        const defender = playerAt(scenarioGame, 2).play[0];
        const expectedDamage = (scenarioRules().characteristic(attacker.card, "Strength") ?? 0) + 4;
        {
            const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: attacker.card, defender: defender.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), defender.card).damage ?? 0).toEqual(expectedDamage);
    });
});
