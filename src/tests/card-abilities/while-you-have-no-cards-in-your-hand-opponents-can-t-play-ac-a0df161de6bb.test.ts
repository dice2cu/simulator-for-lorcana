import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions } from "../../engine/actions";
// Converted from reference/card-abilities/while-you-have-no-cards-in-your-hand-opponents-can-t-play-ac-a0df161de6bb.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: a0df161de6bb
const abilityText = "While you have no cards in your hand, opponents can't play actions with cost 4 or more.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Gizmoduck - Duckburg Defender",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, []);
        playerAt(scenarioGame, 2).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Expensive",
                names: ["Expensive"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 4,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
            scenarioCards.fixture({
                fullName: "Cheap",
                names: ["Cheap"],
                type: "Action",
                colors: ["Amber"],
                subtypes: [],
                cost: 3,
                inkwell: false,
                effect: { type: "Sequence", effects: [] },
            }),
        ]);
        playerAt(scenarioGame, 2).inkwell = Array.from({ length: 4 }, () => ({ card: scenarioCards.create("Dinglehopper"), exerted: false }));
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        const o = playerAt(scenarioGame, 2),
            actions = 2 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(actions.some((action) => action.type === "Play" && sameCard(action.card, playerAt(scenarioGame, 2).hand[0]))).toBe(false);
        expect(actions.some((action) => action.type === "Play" && sameCard(action.card, playerAt(scenarioGame, 2).hand[1]))).toBe(true);
    });
});
