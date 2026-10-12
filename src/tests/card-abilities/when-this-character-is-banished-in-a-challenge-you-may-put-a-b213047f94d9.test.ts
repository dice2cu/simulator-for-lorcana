import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: b213047f94d9
const abilityText =
    "When this character is banished in a challenge, you may put all cards that were under him under another chosen character or location of yours.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mickey Mouse - Bob Cratchit",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("moves the banished Shift stack using event-time identities", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: prototypeCardName, exerted: true }, "HeiHei - Boat Snack"]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["Hercules - True Hero"]);
        const source = playerAt(scenarioGame, 1).play[0].card,
            recipient = playerAt(scenarioGame, 1).play[1].card,
            attacker = playerAt(scenarioGame, 2).play[0].card;
        inPlay(scenarioRules(), source).under = ["Dinglehopper", "Dinglehopper"].map((card) => ({ card: scenarioCards.create(card), faceDown: true }));
        const tucked = [...(playerAt(scenarioGame, 1).play[0].under ?? [])];
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
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                        }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 1).play).toHaveLength(1);
        expect(playerAt(scenarioGame, 1).play[0].under).toEqual(tucked);
        expect(playerAt(scenarioGame, 1).discard).toEqual([source]);
    });
});
