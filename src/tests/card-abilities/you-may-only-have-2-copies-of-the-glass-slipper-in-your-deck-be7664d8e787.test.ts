import { testCards } from "../player/fixtures";
import { describe, expect, it } from "vitest";
import { validateDeck } from "../../deck";
// Generated ability ID: be7664d8e787
const abilityText = "You may only have 2 copies of The Glass Slipper in your deck.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "The Glass Slipper",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("allows two Glass Slippers but not three", () => {
        const scenarioCards = testCards();
        const card = scenarioCards.definition(prototypeCardName);
        const filler = scenarioCards.definition("Dinglehopper");
        const fillers = Array.from({ length: 58 }, (_, index) => ({ ...filler, fullName: "Filler " + index, names: ["Filler " + index] as const }));
        expect(validateDeck([card, card, ...fillers]).valid).toBe(true);
        expect(validateDeck([card, card, card, ...fillers.slice(0, 57)]).valid).toBe(false);
    });
});
