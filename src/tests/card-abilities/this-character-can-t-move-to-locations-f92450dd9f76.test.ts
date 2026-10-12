import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardStates } from "../player/fixtures";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/this-character-can-t-move-to-locations-f92450dd9f76.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: f92450dd9f76
const abilityText = "This character can't move to locations.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Max Goof - Rockin' Teen",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [
            prototypeCardName,
            {
                definition: scenarioCards.fixture({
                    fullName: "Location",
                    names: ["Location"],
                    type: "Location",
                    colors: ["Amber"],
                    subtypes: [],
                    cost: 0,
                    inkwell: false,
                    willpower: 1,
                    lore: 0,
                    moveCost: 0,
                }),
            },
        ]);
        const p = playerAt(scenarioGame, 1),
            s = playerAt(scenarioGame, 1).play[0];
        const actions = 1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup });
        expect(actions.some((action) => action.type === "Move" && sameCard(cardInAction(action), s.card))).toBe(false);
    });
});
