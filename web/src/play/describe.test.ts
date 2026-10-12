import { describe, expect, it } from "vitest";
import { getCard, type Effect } from "../simulator";
import { actionText, costText, effectText, observationText } from "./describe";

const lady = { fullName: "Lady - Family Dog", i: 3 };
const pete = { fullName: "Pete - Games Referee", i: 8 };

describe("plain-English labels", () => {
    it("describes printed effects", () => {
        const dragonFire = getCard("Dragon Fire");
        expect(dragonFire?.type === "Action" && effectText(dragonFire.effect)).toBe("choose 1 of characters: banish the chosen cards");
        const someoneToCareFor = getCard("Lady - Family Dog")?.abilities?.[0];
        expect(someoneToCareFor?.type === "Triggered" && effectText(someoneToCareFor.effect)).toBe("you may choose 1 of matching your characters in hand: play the chosen cards for free");
        const draw: Effect = { type: "Draw", player: "You", amount: 2 };
        expect(effectText(draw)).toBe("you draw 2 cards");
        expect(effectText({ type: "Gain Lore", player: "Opponents", amount: 1 })).toBe("each opponent gains 1 lore");
    });

    it("labels actions and costs", () => {
        expect(actionText({ type: "Challenge", player: 1, attacker: pete, defender: lady })).toBe("Challenge Lady - Family Dog with Pete - Games Referee");
        expect(actionText({ type: "Alter Hand", player: 1, cards: [] })).toBe("Keep hand");
        expect(costText([{ type: "Ink", amount: 3 }])).toBe("3 ink");
        expect(costText([])).toBe("free");
    });

    it("writes log lines from the viewer's side", () => {
        expect(observationText({ type: "Action", action: { type: "Quest", player: 2, card: lady } }, 1)).toBe("Player 2: quest with Lady - Family Dog");
        expect(observationText({ type: "Action", action: { type: "Quest", player: 1, card: lady } }, 1)).toBe("You: quest with Lady - Family Dog");
        expect(observationText({ type: "Move Cards", from: { player: 2, zone: "Deck" }, to: { player: 2, zone: "Hand" }, cards: [null] }, 1)).toBe("Player 2 drew 1 card");
        expect(observationText({ type: "Move Cards", from: { player: 1, zone: "Play" }, to: { player: 1, zone: "Discard" }, cards: [lady] }, 1)).toBe("Lady - Family Dog was banished");
    });
});
