import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/at-the-start-of-your-turn-remove-up-to-3-damage-from-this-ch-b32945cb3451.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: b32945cb3451
const abilityText = "At the start of your turn, remove up to 3 damage from this character.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Pluto - Determined Defender",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioLive: Resolution | undefined, scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Pluto - Determined Defender",
                    names: ["Pluto"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Floodborn", "Ally"],
                    cost: 7,
                    inkwell: true,
                    strength: 3,
                    willpower: 8,
                    lore: 2,
                }),
                damage: 5,
            },
        ]);
        const source = playerAt(scenarioGame, 1).play[0];
        {
            scenarioLive = engine.startTurn(scenarioGame, { card: scenarioCards.lookup });
            scenarioResolution = scenarioLive;
            resolvePlayers(
                scenarioResolution,
                {
                    1: new ScriptedPlayer().on("Choose Amount", (request) => {
                        expect(request.min).toBe(0);
                        expect(request.max).toBe(3);
                        return { type: "Decision", answer: { type: "Choose Amount", amount: 3 } };
                    }),
                },
                {
                    untilAction: true,
                },
            );
            scenarioGame = finished(scenarioResolution, true);
            if (scenarioLive && !scenarioLive.request) scenarioLive = undefined;
        }
        expect(inPlay(scenarioRules(), source.card).damage ?? 0).toBe(2);
    });
});
