import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { ScriptedPlayer } from "../player/scripted-player";
// Converted from reference/card-abilities/if-you-have-3-or-more-characters-in-play-gain-2-lore-and-rem-564083268742.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 564083268742
const abilityText = "If you have 3 or more characters in play, gain 2 lore and remove up to 2 damage from chosen location.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Miracle Candle",
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
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "One",
                    names: ["One"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Two",
                    names: ["Two"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Three",
                    names: ["Three"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    strength: 0,
                    willpower: 1,
                    lore: 0,
                }),
            },
            {
                definition: scenarioCards.fixture({
                    fullName: "Damaged Target",
                    names: ["Damaged Target"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 10,
                    lore: 0,
                    moveCost: 0,
                }),
                damage: 4,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const target = playerAt(scenarioGame, 1).play[4];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0);
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {
                1: new ScriptedPlayer()
                    .on("Choose Cards", (request) => {
                        expect(request.min).toBe(1);
                        expect(request.max).toBe(1);
                        return { type: "Decision", answer: { type: "Choose Cards", cards: [scenarioCards.instance(5)] } };
                    })
                    .on("Choose Amount", (request) => {
                        expect(request.min).toBe(0);
                        expect(request.max).toBe(2);
                        return { type: "Decision", answer: { type: "Choose Amount", amount: 2 } };
                    }),
            });
            scenarioGame = finished(scenarioResolution);
        }
        expect(playerAt(scenarioGame, 1).lore).toBe(2);
        expect(inPlay(scenarioRules(), target.card).damage ?? 0).toBe(2);
    });
});
