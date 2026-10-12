import { testCards } from "../player/fixtures";
import { describe, expect, it } from "vitest";
import { validateDeck } from "../../deck";
// Generated ability ID: e8e57c4cab83
const abilityText = "You may have any number of cards named Microbots in your deck.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Microbots",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("allows sixty Microbots in a constructed deck", () => {
        const scenarioCards = testCards();
        const card = scenarioCards.definition(prototypeCardName);
        expect(validateDeck(Array.from({ length: 60 }, () => card)).valid).toBe(true);
    });
});
