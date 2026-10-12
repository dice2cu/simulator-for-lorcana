import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: 1927130e45ce
const abilityText =
    "Whenever this character sings a song, you may play that song again from your discard for free. If you do, put that card on the bottom of your deck instead of into your discard.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Ursula - Deceiver of All",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("replays the actual sung song and bottoms it only when accepted (%s)", async (replay) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            {
                fullName: "Draw Song",
                names: ["Draw Song"],
                type: "Action",
                colors: [],
                subtypes: ["Song"],
                cost: 1,
                inkwell: false,
                playRules: [{ type: "Sing", cost: 1 }],
                effect: { type: "Draw", player: "You", amount: 1 },
            },
        ]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, Array(3).fill("Dinglehopper"));
        const singer = playerAt(scenarioGame, 1).play[0].card,
            song = playerAt(scenarioGame, 1).hand[0],
            deck = [...playerAt(scenarioGame, 1).deck];
        expect(
            await (async () => {
                if (replay === false) {
                    const action0: PlayerAction | undefined = { type: "Sing", player: 1, song, singers: [singer] };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer().on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: false } };
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (replay === true) {
                    const action0: PlayerAction | undefined = { type: "Sing", player: 1, song, singers: [singer] };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {
                        1: new ScriptedPlayer().on("Optional", (request) => {
                            return { type: "Decision", answer: { type: "Optional", accept: true } };
                        }),
                    });
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                throw new Error("Unspecified script case");
            })(),
        ).toBe(true);
        expect(inPlay(scenarioRules(), singer).exerted).toBe(true);
        expect(playerAt(scenarioGame, 1).hand).toEqual(deck.slice(0, replay ? 2 : 1));
        expect(playerAt(scenarioGame, 1).discard).toEqual(replay ? [] : [song]);
        expect(playerAt(scenarioGame, 1).deck).toEqual(replay ? [deck[2], song] : deck.slice(1));
        expect(playerAt(scenarioGame, 1).inkwell).toEqual([]);
    });
});
