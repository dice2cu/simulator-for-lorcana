import { testCards } from "../player/fixtures";
import { describe, expect, it } from "vitest";
import { validateDeck } from "../../deck";
// Generated ability ID: 52e789e99093
const abilityText = "You can have other Hunny characters in your deck regardless of ink type.";
const cardsWithEffect = [
    // BEGIN GENERATED CARD LIST
    "Christopher Robin - Hunny Sage",
    // END GENERATED CARD LIST
];
const prototypeCardName = cardsWithEffect[0];
describe(abilityText, () => {
    it("allows other Hunny characters outside the deck inks, but not unrelated characters", () => {
        const scenarioCards = testCards();
        const source = scenarioCards.definition(prototypeCardName);
        const filler = scenarioCards.definition("Dinglehopper");
        const fillers = Array.from({ length: 59 }, (_, index) => ({
            ...filler,
            fullName: "Filler " + index,
            names: ["Filler " + index] as const,
            colors: source.colors,
        }));
        const hunny = scenarioCards.fixture({
            fullName: "Off-color Hunny",
            names: ["Off-color Hunny"],
            type: "Character",
            colors: ["Amber"],
            subtypes: ["Hunny"],
            cost: 0,
            inkwell: false,
            strength: 1,
            willpower: 5,
            lore: 0,
        });
        const result = validateDeck([source, ...fillers, hunny]);
        expect(result.errors.some((error) => error.includes("ink colors"))).toBe(false);
        expect(result.valid).toBe(true);
        expect(validateDeck([source, ...fillers, { ...hunny, subtypes: [] }]).valid).toBe(false);
    });
});
