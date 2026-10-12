import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-a-character-quests-while-here-remove-up-to-2-damage-63e918b7479a.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 63e918b7479a
const abilityText = "Whenever a character quests while here, remove up to 2 damage from them. If they're a Hero character, remove up to 4 damage instead.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Winter Camp - Medical Tent",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName, "Mickey Mouse - True Friend"]);
        const location = playerAt(scenarioGame, 1).play[0],
            quester = playerAt(scenarioGame, 1).play[1];
        // Use a non-Hero so the printed two-damage branch applies.
        const printed = scenarioCards.definition(quester.card.fullName);
        if (printed.type !== "Character") throw new Error("Expected a character");
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            scenarioCards.fixture({ ...printed, fullName: "Non-Hero Quester", names: ["Non-Hero Quester"], subtypes: [], willpower: 5 }),
        ]);
        const source = playerAt(scenarioGame, 1).play[1];
        source.damage = 3;
        source.location = playerAt(scenarioGame, 1).play[0].card;
        {
            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: source.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer().on("Choose Amount", (request) => {
                    expect(request.min).toBe(0);
                    expect(request.max).toBe(2);
                    return { type: "Decision", answer: { type: "Choose Amount", amount: 2 } };
                }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), source.card).damage ?? 0).toBe(1);
    });
});
