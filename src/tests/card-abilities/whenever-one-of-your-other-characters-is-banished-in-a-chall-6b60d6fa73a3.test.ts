import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: 6b60d6fa73a3
const abilityText = "Whenever one of your other characters is banished in a challenge, you may return that card to your hand, then choose and discard a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Horned King - Wicked Ruler",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("returns the exact card after a real challenge banishment", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: {
                    fullName: "Returned",
                    names: ["Returned"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: ["Broom", "Illusion"],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                },
                exerted: true,
            },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["Hercules - True Hero"]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, ["Dinglehopper"]);
        const source = playerAt(scenarioGame, 1).play[0].card,
            target = playerAt(scenarioGame, 1).play[1].card,
            attacker = playerAt(scenarioGame, 2).play[0].card;
        const fodder = playerAt(scenarioGame, 1).hand[0];
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Challenge", player: 2, attacker, defender: target };
                if (!action0) throw new Error("Expected a legal action");
                scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer()
                        .on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        })
                        .on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(4)] } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toEqual([target]);
        expect(playerAt(scenarioGame, 1).discard).toEqual([fodder]);
        expect(playerAt(scenarioGame, 1).play.map((state) => state.card)).toEqual([source]);
    });
});
