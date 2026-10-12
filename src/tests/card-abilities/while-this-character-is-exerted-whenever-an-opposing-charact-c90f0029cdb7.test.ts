import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: c90f0029cdb7
const abilityText = "While this character is exerted, whenever an opposing character challenges, you may deal 1 damage to the challenging character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Merida - Gifted Archer",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("damages the actual attacker only while Merida is exerted (%s)", async (exerted) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            { definition: prototypeCardName, exerted },
            { definition: "HeiHei - Boat Snack", exerted: true },
        ]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, [
            {
                ...{
                    fullName: "Victim",
                    names: ["Victim"],
                    type: "Character" as const,
                    colors: [],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                },
                willpower: 10,
            },
        ]);
        const attacker = playerAt(scenarioGame, 2).play[0].card,
            defender = playerAt(scenarioGame, 1).play[1].card;
        expect(
            await (async () => {
                if (exerted === false) {
                    const action0: PlayerAction | undefined = { type: "Challenge", player: 2, attacker, defender };
                    if (!action0) throw new Error("Expected a legal action");
                    scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
                    resolvePlayers(scenarioResolution, {});
                    scenarioGame = finished(scenarioResolution);
                    return true;
                }
                if (exerted === true) {
                    const action0: PlayerAction | undefined = { type: "Challenge", player: 2, attacker, defender };
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
        expect(inPlay(scenarioRules(), attacker).damage ?? 0).toBe(exerted ? 2 : 1); // HeiHei deals one challenge damage.
    });
});
