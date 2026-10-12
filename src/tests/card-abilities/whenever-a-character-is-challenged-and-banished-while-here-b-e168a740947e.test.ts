import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-a-character-is-challenged-and-banished-while-here-b-e168a740947e.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: e168a740947e
const abilityText = "Whenever a character is challenged and banished while here, banish the challenging character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Kuzco's Palace - Home of the Emperor",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Defender",
                    names: ["Defender"],
                    type: "Character",
                    colors: ["Emerald"],
                    subtypes: ["Floodborn"],
                    cost: 0,
                    inkwell: true,
                    strength: 0,
                    willpower: 10,
                    lore: 0,
                }),
                exerted: true,
            },
        ]);
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
        const defender = playerAt(scenarioGame, 1).play[1];
        const challenger = playerAt(scenarioGame, 2).play[0];
        defender.location = source.card;
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Challenge", player: 2, attacker: challenger.card, defender: defender.card };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {});
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 2).discard).toContainEqual(challenger.card);
    });
});
