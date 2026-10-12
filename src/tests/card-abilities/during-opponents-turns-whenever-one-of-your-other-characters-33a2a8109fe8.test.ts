import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: 33a2a8109fe8
const abilityText = "During opponents' turns, whenever one of your other characters is banished, you may draw a card for each card that was under them.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Donald Duck - Fred Honeywell",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("counts the old tucked cards only on an opposing turn (%s)", async (opponentsTurn) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        scenarioGame.turn = { number: scenarioGame.turn.number, player: opponentsTurn ? 2 : 1 };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "HeiHei - Boat Snack"]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, Array(4).fill("Dinglehopper"));
        const source = playerAt(scenarioGame, 1).play[0].card,
            friend = playerAt(scenarioGame, 1).play[1].card;
        inPlay(scenarioRules(), friend).under = ["Dinglehopper", "Dinglehopper"].map((card) => ({ card: scenarioCards.create(card), faceDown: true }));
        const deck = [...playerAt(scenarioGame, 1).deck];
        await (async () => {
            if (opponentsTurn === true) {
                const sourceDefinition = scenarioCards.definition(source.fullName);
                scenarioResolution = engine.startEffect(
                    scenarioGame,
                    { type: "Banish", cards: { cards: [friend] } },
                    { card: source, player: opponentsTurn ? 2 : 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                    { card: scenarioCards.lookup },
                );
                resolvePlayers(scenarioResolution, {
                    1: new ScriptedPlayer().on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            if (opponentsTurn === false) {
                const sourceDefinition = scenarioCards.definition(source.fullName);
                scenarioResolution = engine.startEffect(
                    scenarioGame,
                    { type: "Banish", cards: { cards: [friend] } },
                    { card: source, player: opponentsTurn ? 2 : 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                    { card: scenarioCards.lookup },
                );
                resolvePlayers(scenarioResolution, {});
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            throw new Error("Unspecified script case");
        })();
        expect(playerAt(scenarioGame, 1).hand).toEqual(opponentsTurn ? deck.slice(0, 2) : []);
        expect(playerAt(scenarioGame, 1).deck).toEqual(opponentsTurn ? deck.slice(2) : deck);
    });
});
