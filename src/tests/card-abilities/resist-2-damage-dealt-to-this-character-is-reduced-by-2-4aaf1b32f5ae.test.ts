import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/resist-2-damage-dealt-to-this-character-is-reduced-by-2-4aaf1b32f5ae.test.ts
import { describe, expect, it } from "vitest";
// Generated ability ID: 4aaf1b32f5ae
const abilityText = "Resist +2 (Damage dealt to this character is reduced by 2.)";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Denahi - Impatient Hunter",
    "Hercules - Divine Hero",
    "Lythos - Rock Titan",
    "Tiana - Celebrating Princess",
    "Tuk Tuk - Disarmingly Cute",
    "Cinderella - Stouthearted",
    "John Silver - Stern Captain",
    "Omnidroid - Ultimate Iteration",
    "Raya - Unstoppable Force",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        const printed = scenarioCards.definition(prototypeCardName);
        if (printed.type !== "Character") throw new Error("Expected a Resist character");
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            // Keep the character alive so this test can inspect the resisted damage.
            { ...printed, willpower: Math.max(printed.willpower, 3) },
        ]);
        const player = playerAt(scenarioGame, 1);
        const character = playerAt(scenarioGame, 1).play[0];
        {
            const sourceDefinition = scenarioCards.definition(character.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                { type: "Deal Damage", amount: 4, cards: { cards: [character.card] } },
                { card: character.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(inPlay(scenarioRules(), character.card).damage ?? 0).toBe(2);
    });
});
