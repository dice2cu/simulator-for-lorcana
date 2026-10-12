import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { Decision } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { describe, expect, it } from "vitest";
// Generated ability ID: bac36cfdaba5
const abilityText = "Opponents must choose this character for actions and abilities if able.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "John Smith - Undaunted Protector",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("requires an opponent to choose this character when eligible", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioDecisions: Decision[] = [];
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "Hercules - Divine Hero"]);
        playerAt(scenarioGame, 2).play = cardStates(scenarioCards, ["Dinglehopper"]);
        const [source, otherCharacter] = playerAt(scenarioGame, 1).play.map((state) => state.card);
        const opponentSource = playerAt(scenarioGame, 2).play[0].card;
        {
            const sourceDefinition = scenarioCards.definition(opponentSource.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                {
                    type: "Choose Cards",
                    from: { player: "Opponents", zone: "Play", cardType: "Character" },
                    count: 1,
                    effect: { type: "Deal Damage", cards: "Selected Cards", amount: 1 },
                },
                { card: opponentSource, player: 2, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(
                scenarioResolution,
                {
                    2: new ScriptedPlayer().on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(1)] } };
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
        expect(request.cards).toEqual([source]);
        expect(request.cards).not.toContainEqual(otherCharacter);
    });
});
