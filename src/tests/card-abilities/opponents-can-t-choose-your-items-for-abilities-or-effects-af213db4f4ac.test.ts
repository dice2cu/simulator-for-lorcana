import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { Decision } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: af213db4f4ac
const abilityText = "Opponents can't choose your items for abilities or effects.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Aurora - Lore Guardian",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("excludes protected items from an opponent choice", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioDecisions: Decision[] = [];
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "Dinglehopper"]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["Dinglehopper"]);
        const protectedItem = playerAt(scenarioGame, 1).play[1].card;
        const opponentItem = playerAt(scenarioGame, 2).play[0].card;
        {
            const sourceDefinition = scenarioCards.definition(opponentItem.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                {
                    type: "Choose Cards",
                    from: { zone: "Play", cardType: "Item" },
                    count: 1,
                    effect: { type: "Banish", cards: "Selected Cards" },
                },
                { card: opponentItem, player: 2, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(
                scenarioResolution,
                {
                    2: new ScriptedPlayer().on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                    }),
                },
                {
                    decisions: scenarioDecisions,
                },
            );
            scenarioGame = finished(scenarioResolution);
        }
        const request = scenarioDecisions.find((decision) => decision.type === "Choose Cards");
        if (!request || request.type !== "Choose Cards") throw new Error("Expected a card choice");
        expect(request.cards).not.toContainEqual(protectedItem);
        expect(request.cards).toContainEqual(opponentItem);
        expect(scenarioRules().locate(protectedItem)?.zone).toBe("Play");
    });
});
