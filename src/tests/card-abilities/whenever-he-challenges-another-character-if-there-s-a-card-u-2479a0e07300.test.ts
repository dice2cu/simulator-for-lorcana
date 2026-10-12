import * as engine from "../../engine/engine";
import { Rules as RuleQueries } from "../../engine/rules";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates, inPlay, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
// Converted from reference/card-abilities/whenever-he-challenges-another-character-if-there-s-a-card-u-2479a0e07300.test.ts
import { describe, expect, it } from "vitest";
import type { Effect } from "../../model/ability";
// Generated ability ID: 2479a0e07300
const abilityText = "Whenever he challenges another character, if there's a card under this character, each opponent loses 1 lore and you gain 1 lore.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Beast - Aggressive Lord",
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
        const player = playerAt(scenarioGame, 1),
            source = playerAt(scenarioGame, 1).play[0],
            opponent = playerAt(scenarioGame, 2),
            ability: Effect = printedEffect(scenarioCards.definition(source.card.fullName), 1);
        playerAt(scenarioGame, 2).lore = 5;
        inPlay(scenarioRules(), source.card).under = [
            scenarioCards.create(
                scenarioCards.fixture({
                    fullName: "Under Card",
                    names: ["Under Card"],
                    type: "Action",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    effect: { type: "Sequence", effects: [] },
                }),
            ),
        ].map((card) => ({ card, faceDown: true }));
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
        expect(playerAt(scenarioGame, 2).lore).toBe(4);
        expect(playerAt(scenarioGame, 1).lore).toBe(1);
    });
});
