import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/whenever-a-character-quests-while-here-you-may-remove-up-to-b0ec363aa125.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: b0ec363aa125
const abilityText = "Whenever a character quests while here, you may remove up to 2 damage from them. Then, you may remove up to 2 damage from this location.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Casa Madrigal - Courtyard",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            {
                definition: scenarioCards.fixture({
                    fullName: "Casa Madrigal - Courtyard",
                    names: ["Casa Madrigal"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 4,
                    inkwell: true,
                    willpower: 7,
                    lore: 2,
                    moveCost: 1,
                }),
                damage: 3,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Quester",
                    names: ["Quester"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 10,
                    lore: 1,
                }),
                damage: 4,
                exerted: !true,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [location, quester] = playerAt(scenarioGame, 1).play;
        quester.location = location.card;
        {
            const action0: PlayerAction | undefined = { type: "Quest", player: 1, card: quester.card };
            if (!action0) throw new Error("Expected a legal action");
            scenarioResolution = engine.startAction(scenarioGame, action0, { card: scenarioCards.lookup });
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    })
                    .on("Choose Amount", (request) => {
                        expect(request.min).toBe(0);
                        expect(request.max).toBe(2);
                        return { type: "Decision", answer: { type: "Choose Amount", amount: 2 } };
                    })
                    .on("Optional", (request) => {
                        return { type: "Decision", answer: { type: "Optional", accept: true } };
                    })
                    .on("Choose Amount", (request) => {
                        expect(request.min).toBe(0);
                        expect(request.max).toBe(2);
                        return { type: "Decision", answer: { type: "Choose Amount", amount: 2 } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), quester.card).damage ?? 0).toBe(2);
        expect(inPlay(scenarioRules(), location.card).damage ?? 0).toBe(1);
    });
});
