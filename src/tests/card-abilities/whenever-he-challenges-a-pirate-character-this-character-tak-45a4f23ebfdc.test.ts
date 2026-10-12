import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-he-challenges-a-pirate-character-this-character-tak-45a4f23ebfdc.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 45a4f23ebfdc
const abilityText = "Whenever he challenges a Pirate character, this character takes no damage from the challenge.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Peter Pan - Pirate's Bane",
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
                    fullName: "Peter Pan - Pirate's Bane",
                    names: ["Peter Pan"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Floodborn", "Hero"],
                    cost: 6,
                    inkwell: true,
                    strength: 2,
                    willpower: 8,
                    lore: 2,
                }),
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Big Pirate",
                    names: ["Big Pirate"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Pirate"],
                    cost: 0,
                    inkwell: false,
                    strength: 6,
                    willpower: 10,
                    lore: 0,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const victim = playerAt(scenarioGame, 2).play[0];
        {
            const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source.card, defender: victim.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), source.card).damage ?? 0).toBe(0);
        expect(inPlay(scenarioRules(), victim.card).damage ?? 0).toBeGreaterThan(0);
    });
});
