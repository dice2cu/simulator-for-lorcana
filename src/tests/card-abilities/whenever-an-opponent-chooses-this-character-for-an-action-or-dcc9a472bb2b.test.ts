import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/whenever-an-opponent-chooses-this-character-for-an-action-or-dcc9a472bb2b.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: dcc9a472bb2b
const abilityText = "Whenever an opponent chooses this character for an action or ability, they choose and discard a card.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Flynn Rider - High-Climbing Rogue",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const target = playerAt(scenarioGame, 1).play[0];
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Scenario Action",
                names: ["Scenario Action"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: {
                    type: "Choose Cards",
                    from: { zone: "Play", player: "Opponents" },
                    count: 1,
                    effect: { type: "Deal Damage", cards: "Selected Cards", amount: 1 },
                },
            }),
        ]);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, [scenarioCards.definition("Scenario Action"), "Dinglehopper"]);
        const discarded = playerAt(scenarioGame, 2).hand[1];
        {
            const action0: PlayerAction | undefined = getLegalActions(scenarioGame, { card: scenarioCards.lookup }).find(
                (action) => action.type === "Play" && action.player === 2 && action.card.fullName === "Scenario Action",
            );
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                2: new ScriptedPlayer()
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(1)] } };
                    })
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(4)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 2).discard).toContainEqual(discarded);
    });
});
