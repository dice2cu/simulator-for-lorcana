import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-this-character-quests-you-may-draw-a-card-a4acfbafabe3.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: a4acfbafabe3
const abilityText = "Whenever this character quests, you may draw a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Maleficent - Mistress of All Evil",
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
                    fullName: "Maleficent - Mistress of All Evil",
                    names: ["Maleficent"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Villain", "Sorcerer"],
                    cost: 5,
                    inkwell: true,
                    strength: 2,
                    willpower: 3,
                    lore: 2,
                }),
                exerted: !true,
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Mickey Mouse - True Friend"].reverse());
        const player = playerAt(scenarioGame, 1);
        const character = playerAt(scenarioGame, 1).play[0];
        {
            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: character.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    })
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: false } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toHaveLength(0);
        expect(playerAt(scenarioGame, 1).hand.map((card) => card.fullName)).toContainEqual("Mickey Mouse - True Friend");
    });
});
