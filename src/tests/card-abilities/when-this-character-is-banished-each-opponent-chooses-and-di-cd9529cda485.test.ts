import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: cd9529cda485
const abilityText = "When this character is banished, each opponent chooses and discards a card for each card that was under him.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Goofy - Ghost of Jacob Marley",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it.each([0, 2, 4])("discards one card per previously tucked card, capped by the hand (%s)", async (count) => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, Array(3).fill("Dinglehopper"));
        const source = playerAt(scenarioGame, 1).play[0].card;
        inPlay(scenarioRules(), source).under = Array(count)
            .fill("Dinglehopper")
            .map((card) => ({ card: scenarioCards.create(card), faceDown: true }));
        const tucked = (playerAt(scenarioGame, 1).play[0].under ?? []).map((under) => under.card);
        const discarded = playerAt(scenarioGame, 2).hand.slice(0, Math.min(count, 3));
        await (async () => {
            if (count === 2) {
                const sourceDefinition = scenarioCards.definition(source.fullName);
                scenarioResolution = engine.startEffect(
                    scenarioGame,
                    { type: "Banish", cards: { cards: [source] } },
                    { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                    { card: scenarioCards.lookup },
                );
                resolvePlayers(scenarioResolution, {
                    2: new ScriptedPlayer().on("Choose Cards", (request) => {
                        expect(request.min).toBe(2);
                        expect(request.max).toBe(2);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2), scenarioCards.instance(3)] } };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            if (count === 4) {
                const sourceDefinition = scenarioCards.definition(source.fullName);
                scenarioResolution = engine.startEffect(
                    scenarioGame,
                    { type: "Banish", cards: { cards: [source] } },
                    { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                    { card: scenarioCards.lookup },
                );
                resolvePlayers(scenarioResolution, {
                    2: new ScriptedPlayer().on("Choose Cards", (request) => {
                        expect(request.min).toBe(3);
                        expect(request.max).toBe(3);
                        return {
                            type: "Decision",
                            answer: { type: "Choose Cards", cards: [scenarioCards.instance(2), scenarioCards.instance(3), scenarioCards.instance(4)] },
                        };
                    }),
                });
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            if (count === 0) {
                const sourceDefinition = scenarioCards.definition(source.fullName);
                scenarioResolution = engine.startEffect(
                    scenarioGame,
                    { type: "Banish", cards: { cards: [source] } },
                    { card: source, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                    { card: scenarioCards.lookup },
                );
                resolvePlayers(scenarioResolution, {});
                scenarioGame = finished(scenarioResolution);
                return true;
            }
            throw new Error("Unspecified script case");
        })();
        expect(playerAt(scenarioGame, 2).discard).toEqual(discarded);
        expect(playerAt(scenarioGame, 2).hand).toHaveLength(3 - discarded.length);
        expect(playerAt(scenarioGame, 1).discard).toEqual([source, ...tucked]);
    });
});
