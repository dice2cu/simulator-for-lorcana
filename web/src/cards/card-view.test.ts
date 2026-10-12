import { describe, expect, it } from "vitest";
import { getCard } from "../simulator";
import { cardParagraphs } from "./card-view";

describe("card text", () => {
    it("joins printed line breaks into one paragraph per ability", () => {
        expect(cardParagraphs(getCard("Lady - Family Dog")!.fullText!)).toEqual(["SOMEONE TO CARE FOR When you play this character, you may play a character with cost 2 or less for free."]);
        expect(cardParagraphs(getCard("Pawpsicle")!.fullText!)).toEqual([
            "JUMBO POP When you play this item, you may draw a card.",
            "THAT'S REDWOOD Banish this item — Remove up to 2 damage from chosen character.",
        ]);
        expect(cardParagraphs("LOOK AT THIS! Whenever this character quests, choose one:\n• Gain 1 lore.\n• Draw a card.")).toEqual([
            "LOOK AT THIS! Whenever this character quests, choose one:",
            "• Gain 1 lore.",
            "• Draw a card.",
        ]);
        expect(cardParagraphs("")).toEqual([]);
    });
});
