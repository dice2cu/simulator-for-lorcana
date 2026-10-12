import * as engine from "../../engine/engine";
import type { Resolution } from "../../engine/resolution";
import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates, printedEffect } from "../player/fixtures";
import { resolvePlayers, finished } from "../player/resolve-players";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/opponents-can-t-play-actions-or-items-until-the-start-of-you-fc3637e076b0.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
import type { Effect } from "../../model/ability";
// Generated ability ID: fc3637e076b0
const abilityText = "Opponents can't play actions or items until the start of your next turn.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Keep the Ancient Ways",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        let scenarioResolution: Resolution | undefined;
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        const p = playerAt(scenarioGame, 1),
            s = playerAt(scenarioGame, 1).play[0],
            a: Effect = printedEffect(scenarioCards.definition(s.card.fullName));
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Action",
                names: ["Action"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
            scenarioCards.fixture({
                fullName: "Item",
                names: ["Item"],
                type: "Item",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
            }),
            scenarioCards.fixture({
                fullName: "Character",
                names: ["Character"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 0,
                inkwell: false,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
        ]);
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
        const actions = 2 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(actions.some((action) => action.type === "Play" && sameCard(action.card, playerAt(scenarioGame, 2).hand[0]))).toBe(false);
        expect(actions.some((action) => action.type === "Play" && sameCard(action.card, playerAt(scenarioGame, 2).hand[1]))).toBe(false);
        expect(actions.some((action) => action.type === "Play" && sameCard(action.card, playerAt(scenarioGame, 2).hand[2]))).toBe(true);
    });
});
