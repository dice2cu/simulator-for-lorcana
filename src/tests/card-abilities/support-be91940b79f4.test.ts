import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import type { PlayerAction } from "../../model/turn";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/support-be91940b79f4.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: be91940b79f4
const abilityText = "Support";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Mickey Mouse - Musketeer Captain",
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
                    fullName: "Lilo & Stitch - Fun-Loving Friends",
                    names: ["Lilo", "Stitch"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Storyborn", "Team", "Hero", "Alien"],
                    cost: 5,
                    inkwell: true,
                    strength: 3,
                    willpower: 5,
                    lore: 3,
                }),
                exerted: !true,
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Stitch - Rock Star",
                    names: ["Stitch"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Floodborn", "Hero", "Alien"],
                    cost: 6,
                    inkwell: true,
                    strength: 3,
                    willpower: 5,
                    lore: 3,
                }),
                exerted: !true,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const [supporter, target] = playerAt(scenarioGame, 1).play;
        const targetStrength = scenarioRules().characteristic(target.card, "Strength") ?? 0;
        const supportStrength = scenarioRules().characteristic(supporter.card, "Strength") ?? 0;
        const quested = await (async () => {
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
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(2)] } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
            return true;
        })();
        expect(quested).toBe(true);
        expect(scenarioRules().characteristic(target.card, "Strength")).toBe(targetStrength + supportStrength);
    });
});
