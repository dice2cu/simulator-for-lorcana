import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/challenger-4-when-challenging-this-character-gets-4-41b61bfe686c.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 41b61bfe686c
const abilityText = "Challenger +4 (When challenging, this character gets +4 ¤.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Simba - Returned King",
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
                    fullName: "Simba - Returned King",
                    names: ["Simba"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Hero", "King"],
                    cost: 7,
                    inkwell: true,
                    strength: 4,
                    willpower: 6,
                    lore: 2,
                }),
                exerted: !true,
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Stitch - Rock Star",
                    names: ["Stitch"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Floodborn", "Hero", "Alien"],
                    cost: 6,
                    inkwell: true,
                    strength: 3,
                    willpower: 5,
                    lore: 3,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const attacker = playerAt(scenarioGame, 1).play[0];
        const defender = playerAt(scenarioGame, 2).play[0];
        const challenged = await (async () => {
            const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: attacker.card, defender: defender.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
            return true;
        })();
        expect(challenged).toBe(true);
        expect(playerAt(scenarioGame, 2).play.map((entry) => entry.card)).not.toContainEqual(defender.card);
        expect(inPlay(scenarioRules(), attacker.card).damage ?? 0).toBe(3);
    });
});
