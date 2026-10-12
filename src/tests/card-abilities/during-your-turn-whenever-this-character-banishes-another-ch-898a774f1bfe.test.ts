import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/during-your-turn-whenever-this-character-banishes-another-ch-898a774f1bfe.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 898a774f1bfe
const abilityText = "During your turn, whenever this character banishes another character in a challenge, you may draw a card and gain 1 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Stitch - Alien Troublemaker",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("applies every part of the ability only when accepted (%s)", async (accept) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["Rhino - One-Sixteenth Wolf"]);
        playerAt(scenarioGame, 1).deck = cardIds(
            scenarioCards,
            Array.from({ length: 4 }, (_, index) =>
                scenarioCards.fixture({
                    fullName: "Draw " + index,
                    names: ["Draw " + index],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ).reverse(),
        );
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        source.drying = false;
        const victim = playerAt(scenarioGame, 2).play[0];
        victim.exerted = !false;
        const deck = [...[...playerAt(scenarioGame, 1).deck].reverse()];
        expect(
            await (async () => {
                if (accept === false) {
                    const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source.card, defender: victim.card };
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
                if (accept === true) {
                    const action0: PlayerAction | undefined = { type: "Challenge", player: 1, attacker: source.card, defender: victim.card };
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
        expect(playerAt(scenarioGame, 1).hand).toEqual(accept ? deck.slice(-1) : []);
        expect(playerAt(scenarioGame, 1).lore).toBe(accept ? 1 : 0);
        expect([...playerAt(scenarioGame, 1).deck].reverse()).toEqual(accept ? deck.slice(0, -1) : deck);
    });
});
