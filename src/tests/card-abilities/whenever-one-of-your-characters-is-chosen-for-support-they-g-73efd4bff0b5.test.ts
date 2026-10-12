import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, keywords as cardKeywords } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-one-of-your-characters-is-chosen-for-support-they-g-73efd4bff0b5.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 73efd4bff0b5
const abilityText = "Whenever one of your characters is chosen for Support, they gain Resist +1 this turn. (Damage dealt to them is reduced by 1.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Prince Phillip - Gallant Defender",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "HeiHei - Boat Snack", "Mickey Mouse - True Friend"]);
        const supporter = playerAt(scenarioGame, 1).play[1],
            target = playerAt(scenarioGame, 1).play[2];
        {
            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: supporter.card };
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
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(3)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(cardKeywords(scenarioRules(), target.card).map((keyword) => keyword.toLowerCase())).toContainEqual("resist");
    });
});
