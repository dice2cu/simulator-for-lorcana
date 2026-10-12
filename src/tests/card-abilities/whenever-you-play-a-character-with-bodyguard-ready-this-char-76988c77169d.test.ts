import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect, isExerted } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-you-play-a-character-with-bodyguard-ready-this-char-76988c77169d.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 76988c77169d
const abilityText = "Whenever you play a character with Bodyguard, ready this character. He can't quest for the rest of this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Goofy - Musketeer Swordsman",
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
                    fullName: "Goofy - Musketeer Swordsman",
                    names: ["Goofy"],
                    type: "Character",
                    colors: ["Amber"],
                    subtypes: ["Dreamborn", "Hero", "Musketeer"],
                    cost: 4,
                    inkwell: false,
                    strength: 3,
                    willpower: 4,
                    lore: 2,
                }),
                exerted: !false,
            },
        ]);
        const player = playerAt(scenarioGame, 1);
        const source = playerAt(scenarioGame, 1).play[0];
        const ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 0);
        {
            const sourceDefinition = scenarioCards.definition(source.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                ability,
                { card: source.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(!isExerted(scenarioRules(), source.card)).toBe(true);
    });
});
