import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: ee45fcddae21
const abilityText = "Whenever a Robot character is banished, you may banish this item to discard your hand and draw 2 cards.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Syndrome's Remote",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([false, true])("replaces the hand only after a Robot banishment (%s)", async (robot) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
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
                subtypes: robot ? ["Robot"] : [],
            },
        ]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, ["Dinglehopper"]);
        playerAt(scenarioGame, 1).deck = cardIds(scenarioCards, Array(4).fill("Dinglehopper"));
        const source = playerAt(scenarioGame, 1).play[0].card,
            victim = playerAt(scenarioGame, 2).play[0].card,
            oldHand = playerAt(scenarioGame, 1).hand[0],
            deck = [...playerAt(scenarioGame, 1).deck];
        await (async () => {
            if (robot === false) {
                const sourceDefinition = scenarioCards.definition(source.fullName);
                scenarioResolution = engine.startEffect(
                    scenarioGame,
                    { type: "Banish", cards: { cards: [victim] } },
                    { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                    { card: scenarioCards.lookup },
                );
                resolvePlayers(scenarioResolution, {});
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            if (robot === true) {
                const sourceDefinition = scenarioCards.definition(source.fullName);
                scenarioResolution = engine.startEffect(
                    scenarioGame,
                    { type: "Banish", cards: { cards: [victim] } },
                    { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
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
            throw new Error("Unspecified script case");
        })();
        expect(playerAt(scenarioGame, 1).play.map((state) => state.card)).toEqual(robot ? [] : [source]);
        expect(playerAt(scenarioGame, 1).discard).toEqual(robot ? [source, oldHand] : []);
        expect(playerAt(scenarioGame, 1).hand).toEqual(robot ? deck.slice(0, 2) : [oldHand]);
        expect(playerAt(scenarioGame, 1).deck).toEqual(robot ? deck.slice(2) : deck);
    });
});
