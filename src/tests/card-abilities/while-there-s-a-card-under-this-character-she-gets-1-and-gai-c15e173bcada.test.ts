import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: c15e173bcada
const abilityText =
    "While there's a card under this character, she gets +1 ◊ and gains “Whenever this character is challenged, each opponent chooses and discards a card.”";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Megara - Secret Keeper",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("grants lore and the discard trigger only with a card underneath (%s)", async (under) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [{ definition: prototypeCardName, exerted: true }]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["HeiHei - Boat Snack"]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, ["Dinglehopper"]);
        const source = playerAt(scenarioGame, 1).play[0].card,
            attacker = playerAt(scenarioGame, 2).play[0].card,
            discarded = playerAt(scenarioGame, 2).hand[0];
        if (under) inPlay(scenarioRules(), source).under = ["Dinglehopper"].map((card) => ({ card: scenarioCards.create(card), faceDown: true }));
        expect(scenarioRules().characteristic(source, "Lore")).toBe(1 + Number(under));
        expect(
            await (async () => {
                if (under === true) {
                    const action0: PlayerAction | undefined = { type: "Challenge", player: 2, attacker, defender: source };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        2: new ScriptedPlayer().on("Choose Cards", (request) => {
                            expect(request.min).toBe(1);
                            expect(request.max).toBe(1);
                            return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (under === false) {
                    const action0: PlayerAction | undefined = { type: "Challenge", player: 2, attacker, defender: source };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {});
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(true);
        expect(playerAt(scenarioGame, 2).hand).toEqual(under ? [] : [discarded]);
        expect(playerAt(scenarioGame, 2).discard).toContainEqual(attacker);
        expect(playerAt(scenarioGame, 2).discard.some((card) => card.i === discarded.i)).toBe(under);
    });
});
