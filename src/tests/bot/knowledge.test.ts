import { describe, expect, it } from "vitest";
import { Knowledge } from "../../bot/knowledge";
import type { GameStateView, PlayerPositionView } from "../../model/game-state-view";
import type { CardIdentifier } from "../../model/identity";
import type { PlayerObservation } from "../../model/player-interaction";

const goat = (i: number): CardIdentifier => ({ fullName: "Merlin - Goat", i });
const rabbit = (i: number): CardIdentifier => ({ fullName: "Merlin - Rabbit", i });
const mim = (i: number): CardIdentifier => ({ fullName: "Madam Mim - Fox", i });

function seat(deck: PlayerPositionView["deck"], hand: PlayerPositionView["hand"] = 0, rest: Partial<PlayerPositionView> = {}): PlayerPositionView {
    return { lore: 0, turnsTaken: 0, deck, hand, play: [], discard: [], inkwell: [], ...rest };
}

function view(one: PlayerPositionView, two: PlayerPositionView): GameStateView {
    return { turn: { number: 1, player: 1 }, players: { 1: one, 2: two } };
}

describe("bot knowledge", () => {
    it("tracks own deck ends until a shuffle without forgetting composition", () => {
        const knowledge = new Knowledge(1, [
            { fullName: "Merlin - Goat", count: 3 },
            { fullName: "Merlin - Rabbit", count: 3 },
        ]);
        knowledge.update({ state: view(seat(6), seat(6)), turn: { steps: [] }, observations: [] });
        const look: PlayerObservation = { type: "Look", location: { player: 1, zone: "Deck", position: { from: "Top", index: 0 } }, cards: [goat(1), rabbit(2)] };
        knowledge.update({ state: view(seat([goat(1), rabbit(2), null, null, null, null]), seat(6)), turn: { steps: [] }, observations: [look] });
        expect(knowledge.snapshot(1).deckTop).toEqual([goat(1), rabbit(2)]);

        const draw: PlayerObservation = {
            type: "Move Cards",
            from: { player: 1, zone: "Deck", position: { from: "Top", index: 0 } },
            to: { player: 1, zone: "Hand" },
            cards: [goat(1)],
        };
        knowledge.update({ state: view(seat(5, [goat(1)]), seat(6)), turn: { steps: [] }, observations: [draw] });
        const after = knowledge.snapshot(1);
        expect(after.deckTop).toEqual([rabbit(2)]);
        expect(after.hand).toEqual([goat(1)]);
        expect(after.remainingDeck).toContainEqual({ fullName: "Merlin - Goat", min: 2, max: 2 });

        knowledge.update({ state: view(seat(5, [goat(1)]), seat(6)), turn: { steps: [] }, observations: [{ type: "Shuffle", player: 1 }] });
        const shuffled = knowledge.snapshot(1);
        expect(shuffled.deckTop).toEqual([]);
        expect(shuffled.remainingDeck).toContainEqual({ fullName: "Merlin - Goat", min: 2, max: 2 });
        expect(shuffled.remainingDeck).toContainEqual({ fullName: "Merlin - Rabbit", min: 3, max: 3 });
    });

    it("keeps a bottom group top first and recognizes the remembered card when it leaves hidden", () => {
        const knowledge = new Knowledge(1, [{ fullName: "Merlin - Goat", count: 4 }]);
        knowledge.update({ state: view(seat(4), seat(4)), turn: { steps: [] }, observations: [] });
        const placed: PlayerObservation = {
            type: "Move Cards",
            from: { player: 1, zone: "Hand" },
            to: { player: 1, zone: "Deck", position: { from: "Bottom", index: 1 } },
            cards: [goat(7), goat(8)],
        };
        knowledge.update({ state: view(seat(6), seat(4)), turn: { steps: [] }, observations: [placed] });
        expect(knowledge.snapshot(1).deckBottom).toEqual([goat(7), goat(8)]);
        const taken: PlayerObservation = {
            type: "Move Cards",
            from: { player: 1, zone: "Deck", position: { from: "Bottom", index: 0 } },
            to: { player: 1, zone: "Discard" },
            cards: [null],
        };
        knowledge.update({ state: view(seat(5), seat(4)), turn: { steps: [] }, observations: [taken] });
        const after = knowledge.snapshot(1);
        expect(after.deckBottom).toEqual([goat(7)]);
        expect(after.seenCards).toContainEqual(goat(8));
    });

    it("treats a scouted list as a belief that observations extend", () => {
        const knowledge = new Knowledge(1, [{ fullName: "Merlin - Goat", count: 4 }], {
            2: { type: "Scouted", cards: [{ fullName: "Merlin - Rabbit", count: 4 }], confidence: 0.7 },
        });
        knowledge.update({ state: view(seat(10), seat(10)), turn: { steps: [] }, observations: [] });
        const start = knowledge.snapshot(2);
        expect(start.remainingDeck).toEqual([{ fullName: "Merlin - Rabbit", min: 0, max: 4 }]);
        expect(start.unlistedDeck).toEqual({ min: 6, max: 10 });

        const played: PlayerObservation = { type: "Action", action: { type: "Play", player: 2, card: mim(30) } };
        knowledge.update({
            state: view(seat(10), seat(9, 0, { play: [{ card: mim(30) }] })),
            turn: { steps: [] },
            observations: [played, { type: "Move Cards", from: { player: 2, zone: "Hand" }, to: { player: 2, zone: "Play" }, cards: [mim(30)] }],
        });
        const after = knowledge.snapshot(2);
        expect(after.seenCards).toEqual([mim(30)]);
        expect(after.observedColors).toContain("Amethyst");
        expect(after.remainingDeck.map((entry) => entry.fullName)).toContain("Madam Mim - Fox");
        const total = after.remainingDeck.reduce((sum, entry) => sum + entry.min, 0) + after.unlistedDeck.min;
        expect(total).toBeLessThanOrEqual(9);
    });

    it("widens named bounds when an unknown card leaves the deck", () => {
        const knowledge = new Knowledge(1, [{ fullName: "Merlin - Goat", count: 4 }], {
            2: {
                type: "Confirmed",
                cards: [
                    { fullName: "Merlin - Rabbit", count: 2 },
                    { fullName: "Merlin - Goat", count: 2 },
                ],
            },
        });
        knowledge.update({ state: view(seat(4), seat(4)), turn: { steps: [] }, observations: [] });
        const facedown: PlayerObservation = {
            type: "Move Cards",
            from: { player: 2, zone: "Deck", position: { from: "Top", index: 0 } },
            to: { player: 2, zone: "Inkwell" },
            cards: [null],
        };
        knowledge.update({ state: view(seat(4), seat(3, 0, { inkwell: [{ exerted: false }] })), turn: { steps: [] }, observations: [facedown] });
        const after = knowledge.snapshot(2);
        expect(after.remainingDeck).toContainEqual({ fullName: "Merlin - Rabbit", min: 1, max: 2 });
        expect(after.remainingDeck).toContainEqual({ fullName: "Merlin - Goat", min: 1, max: 2 });
    });

    it("remembers visibly inked cards without knowing which ink is exerted", () => {
        const knowledge = new Knowledge(1, [{ fullName: "Merlin - Goat", count: 4 }]);
        knowledge.update({ state: view(seat(4), seat(4)), turn: { steps: [] }, observations: [] });
        knowledge.update({
            state: view(seat(4), seat(4, 0, { inkwell: [{ exerted: false }] })),
            turn: { steps: [] },
            observations: [
                { type: "Action", action: { type: "Ink", player: 2, card: rabbit(40) } },
                { type: "Move Cards", from: { player: 2, zone: "Hand" }, to: { player: 2, zone: "Inkwell" }, cards: [rabbit(40)] },
            ],
        });
        expect(knowledge.snapshot(2).inkwell).toEqual([rabbit(40)]);
    });
});
