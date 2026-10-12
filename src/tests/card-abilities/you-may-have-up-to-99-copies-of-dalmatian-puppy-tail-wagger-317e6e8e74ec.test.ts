import { testCards } from "../player/fixtures";
import { describe, expect, it } from "vitest";
import { validateDeck } from "../../deck";
// Generated ability ID: 317e6e8e74ec
const abilityText = "You may have up to 99 copies of Dalmatian Puppy - Tail Wagger in your deck.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Dalmatian Puppy - Tail Wagger",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("allows ninety-nine puppies but not a hundred", () => {
        const scenarioCards = testCards();
        const card = scenarioCards.definition(prototypeCardName);
        expect(validateDeck(Array.from({ length: 99 }, () => card)).valid).toBe(true);
        expect(validateDeck(Array.from({ length: 100 }, () => card)).valid).toBe(false);
    });
});
