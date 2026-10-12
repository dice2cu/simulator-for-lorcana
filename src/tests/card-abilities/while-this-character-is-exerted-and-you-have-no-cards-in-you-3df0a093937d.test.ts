import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/while-this-character-is-exerted-and-you-have-no-cards-in-you-3df0a093937d.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: 3df0a093937d
const abilityText = "While this character is exerted and you have no cards in your hand, opponents can't play actions.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Tiana - Celebrating Princess",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName], !false);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, []);
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
        ]);
        scenarioGame.turn = { number: scenarioGame.turn.number, player: 2 };
        const action = playerAt(scenarioGame, 2).hand[0],
            actions = 2 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(actions.some((a) => a.type === "Play" && sameCard(cardInAction(a), action))).toBe(false);
    });
});
