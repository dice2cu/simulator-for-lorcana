import { describe, expect, it } from "vitest";
import { getCard } from "../../cards";
import { stance } from "../../bot/intent";
import type { Effect } from "../../model/ability";

/** The first choice's effect printed on a card. */
function chosen(fullName: string): Effect {
    let found: Effect | undefined;
    const visit = (value: unknown): void => {
        if (found || !value || typeof value !== "object") return;
        if (Array.isArray(value)) return value.forEach(visit);
        const node = value as Record<string, unknown>;
        if (node.type === "Choose Cards" && node.effect) found = node.effect as Effect;
        else Object.values(node).forEach(visit);
    };
    visit(getCard(fullName));
    if (!found) throw new Error(`No choice on ${fullName}`);
    return found;
}

describe("whether a choice helps or harms the chosen cards", () => {
    it("reads removal and damage as harmful", () => {
        expect(stance(chosen("Dragon Fire"), "Play")).toBe(-1);
        expect(stance(chosen("Let the Storm Rage On"), "Play")).toBe(-1);
    });

    it("reads readying and stat boosts as helpful", () => {
        expect(stance(chosen("Fan the Flames"), "Play")).toBe(1);
        expect(stance(chosen("Vitalisphere"), "Play")).toBe(1);
    });

    it("judges movement by where the chosen cards are", () => {
        // Returning a character in play to hand removes it; returning a card from the discard recovers it.
        expect(stance(chosen("We Don't Talk About Bruno"), "Play")).toBe(-1);
        expect(stance({ type: "Move Card", cards: "Selected Cards", to: "Hand" }, "Discard")).toBe(1);
    });

    it("does not treat cards selected relative to the choice as the chosen cards", () => {
        const others: Effect = { type: "Banish", cards: { zone: "Play", cardType: "Character", exclude: "Selected Cards" } };
        expect(stance(others, "Play")).toBe(0);
    });
});
