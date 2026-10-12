import { describe, expect, it } from "vitest";
import { referenceDecks } from "../../../src/tests/fixtures/reference-decks";
import { checkDeck, deckInks } from "./library";

describe("deck lists in the page", () => {
    it("reports construction errors alongside unreadable lines", () => {
        const check = checkDeck("5 Lady - Family Dog\n4 Tramp - Enterprising Dog\nnonsense");
        expect(check.size).toBe(9);
        expect(check.problems).toEqual([
            'Line 3: cannot read "nonsense"',
            "A constructed deck requires at least 60 cards (has 9)",
            "Lady - Family Dog exceeds its copy limit of 4",
        ]);
    });

    it("accepts every reference deck", () => {
        for (const deck of referenceDecks) {
            const check = checkDeck(deck.cards.map((entry) => `${entry.count} ${entry.fullName}`).join("\n"));
            expect(check.problems, deck.name).toEqual([]);
            expect(check.size).toBeGreaterThanOrEqual(60);
        }
    });

    it("lists a deck's inks", () => {
        expect(deckInks([{ fullName: "Lady - Family Dog", count: 4 }, { fullName: "Go Go Tomago - Darting Dynamo", count: 4 }])).toEqual(["Amber", "Emerald"]);
    });
});
