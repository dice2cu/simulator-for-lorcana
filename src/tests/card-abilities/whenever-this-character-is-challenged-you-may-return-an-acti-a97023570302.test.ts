import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: a97023570302
const abilityText = "Whenever this character is challenged, you may return an action card that isn't a song card from your discard to your hand.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Donald Duck - Lively Pirate",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("returns a non-song action after an actual challenge", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: prototypeCardName, exerted: true }]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                ...{
                    fullName: "Target",
                    names: ["Target"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 2,
                    willpower: 10,
                    lore: 0,
                },
                strength: 0,
            },
        ]);
        playerAt(scenarioGame, 1).discard = cardIds(scenarioCards, ["Fire the Cannons!", "Be Prepared"]);
        const source = playerAt(scenarioGame, 1).play[0].card,
            attacker = playerAt(scenarioGame, 2).play[0].card,
            [action, song] = playerAt(scenarioGame, 1).discard;
        expect(
            await (async () => {
                const action0: PlayerAction | undefined = { type: "Challenge", player: 2, attacker, defender: source };
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
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toEqual([action]);
        expect(playerAt(scenarioGame, 1).discard).toEqual([song]);
    });
});
