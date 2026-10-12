import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: 1c35cdecc814
const abilityText =
    "During your turn, when this character is banished, you may put the top card of your deck facedown under one of your characters or locations with Boost.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Duckworth - Ghost Butler",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each(["Flynn Rider - Spectral Scoundrel", "Scrooge's Counting House - Ebenezer's Office"])(
        "tucks under the chosen Boost permanent after an actual banishment: %s",
        async (targetName) => {
            const scenarioCards = testCards();
            let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
            let scenarioResolution: Resolution | undefined;
            const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
            playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, targetName]);
            playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
                {
                    definition: {
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
                        strength: 20,
                        willpower: 99,
                    },
                    exerted: true,
                },
            ]);
            playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, ["Dinglehopper"]);
            const source = playerAt(scenarioGame, 1).play[0].card,
                target = playerAt(scenarioGame, 1).play[1].card,
                defender = playerAt(scenarioGame, 2).play[0].card,
                top = playerAt(scenarioGame, 1).deck[0];
            expect(
                await (async () => {
                    const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source, defender };
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
            expect(playerAt(scenarioGame, 1).discard).toContainEqual(source);
            expect(playerAt(scenarioGame, 1).deck).toEqual([]);
            expect(inPlay(scenarioRules(), target).under).toEqual([{ card: top, faceDown: true }]);
        },
    );
});
