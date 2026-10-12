import type { GameState as ScenarioState } from "../../model/game-state";
import { testCards, emptyPlayer, playerAt, cardIds, cardStates } from "../player/fixtures";
import { getLegalActions, cardInAction } from "../../engine/actions";
// Converted from reference/card-abilities/all-cards-in-your-hand-count-as-having-d169021771b1.test.ts
import { describe, expect, it } from "vitest";
import { sameCard } from "../../engine/identity";
// Generated ability ID: d169021771b1
const abilityText = "All cards in your hand count as having ◉.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Hidden Inkcaster",
    "Madam Mim - Hummingbird",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("behaves correctly", async () => {
        const scenarioCards = testCards();
        let scenarioGame: ScenarioState = { turn: { number: 1, player: 1 }, players: { 1: emptyPlayer(), 2: emptyPlayer() } };
        playerAt(scenarioGame, 1).play = cardStates(scenarioCards, [prototypeCardName]);
        playerAt(scenarioGame, 1).hand = cardIds(scenarioCards, [
            scenarioCards.fixture({
                fullName: "Uninkable",
                names: ["Uninkable"],
                type: "Character",
                colors: ["Amber"],
                subtypes: [],
                cost: 1,
                inkwell: false,
                strength: 0,
                willpower: 1,
                lore: 0,
            }),
        ]);
        const player = playerAt(scenarioGame, 1);
        const handCard = playerAt(scenarioGame, 1).hand[0];
        const inkActions = (1 !== scenarioGame.turn.player ? [] : getLegalActions(scenarioGame, { card: scenarioCards.lookup })).filter(
            (action) => action.type === "Ink",
        );
        expect(inkActions.some((action) => sameCard(cardInAction(action), handCard))).toBe(true);
    });
});
