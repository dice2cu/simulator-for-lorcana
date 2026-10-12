import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, printedEffect, keywords as cardKeywords } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-a-character-of-yours-named-heihei-quests-this-chara-201c1d52c8d4.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 201c1d52c8d4
const abilityText = "Whenever a character of yours named HeiHei quests, this character gets +1 ◊ and loses Reckless this turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Maui - Soaring Demigod",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        const scenarioRules = () => scenarioResolution?.rules ?? new RuleQueries(scenarioGame, scenarioCards.lookup);
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const p = playerAt(scenarioGame, 1),
            s = playerAt(scenarioGame, 1).play[0],
            a: Effect = printedEffect(scenarioCards.definition(s.card.fullName), 1),
            before = scenarioRules().characteristic(s.card, "Lore") ?? 0;
        {
            const sourceDefinition = scenarioCards.definition(s.card.fullName);
            scenarioResolution = engine.startEffect(
                scenarioGame,
                a,
                { card: s.card, player: 1, kind: sourceDefinition.type === "Action" ? "Action" : "Ability" },
                { card: scenarioCards.lookup },
            );
            resolvePlayers(scenarioResolution, {});
            scenarioGame = finished(scenarioResolution);
        }
        expect(scenarioRules().characteristic(s.card, "Lore")).toBe(before + 1);
        expect(cardKeywords(scenarioRules(), s.card).map((k) => k.toLowerCase())).not.toContainEqual("reckless");
    });
});
