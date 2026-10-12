import { describe, expect, it } from "vitest";
import { startGame } from "../../engine/engine";
import type { GameState } from "../../model/game-state";
import type { CardIdentifier, PlayerNumber } from "../../model/identity";
import type { DeckListEntry } from "../../model/player-interaction";
import { projectState, sight } from "../../player/projection";
import { projectRequest } from "../../player/requests";
import { playGame, type Seat } from "../../player/runner";
import { createBot } from "../../search/bots";
import { referenceDecks } from "../fixtures/reference-decks";

const chernadog = referenceDecks.find((deck) => deck.name === "Amber-Emerald-Chernadog")!.cards;
const order = (count: number) => Array.from({ length: count }, (_, i) => i);

/** The cards the bot puts back from a given opening seven, with the rest of its list below them. */
function putBack(hand: readonly string[], deck: readonly DeckListEntry[]): string[] {
    let serial = 0;
    const remaining = new Map(deck.map((entry) => [entry.fullName, entry.count]));
    for (const name of hand) remaining.set(name, (remaining.get(name) ?? 0) - 1);
    const cards = (names: readonly string[]): CardIdentifier[] => names.map((fullName) => ({ fullName, i: ++serial }));
    const rest = [...remaining].flatMap(([name, count]) => Array<string>(Math.max(0, count)).fill(name));
    const position = (names: readonly string[]) => ({ lore: 0, turnsTaken: 0, deck: cards(names), hand: [], play: [], discard: [], inkwell: [] });
    const initial: GameState = { turn: { number: 1, player: 1 }, players: { 1: position([...hand, ...rest]), 2: position(rest.slice(0, 40)) } };
    const live = startGame(initial);
    // Keep every deck in its listed order, so the first seven are the chosen hand.
    while (live.request?.type === "Shuffle") live.submit({ type: "Random", outcome: { type: "Shuffle", cards: live.request.cards } });
    const request = live.request!;
    if (request.type !== "Action" || request.player !== 1) throw new Error(`Unexpected ${request.type}`);
    const position1 = live.position!;
    const sees = sight(position1, 1 as PlayerNumber);
    const state = projectState(position1, sees);
    const projected = projectRequest(request, live.rules!, sees, order);
    const bot = createBot({ player: 1, deck, settings: { seed: 1, search: { nodes: 0, samples: 0 } } });
    bot.observe({ state, turn: { steps: [] }, observations: [] });
    const answer = bot.decide(state, projected.request);
    const step = projected.toStep(answer);
    if (step.type !== "Action" || step.action.type !== "Alter Hand") throw new Error("Expected a hand alteration");
    return step.action.cards.map((card) => card.fullName).sort();
}

describe("opening hands", () => {
    it("looks for early bodies instead of keeping a hand full of three-cost answers", () => {
        const deck = referenceDecks.find((entry) => entry.name === "Emerald-Steel-Discard");
        if (!deck) throw new Error("Missing discard deck");
        const hand = [
            "Hypnotize",
            "Hypnotize",
            "Strength of a Raging Fire",
            "Strength of a Raging Fire",
            "Let the Storm Rage On",
            "Beast - Tragic Hero",
            "Beast - Tragic Hero",
        ];
        const back = putBack(hand, deck.cards);
        expect(back.length).toBeGreaterThanOrEqual(4);
        expect(back.filter((name) => name === "Beast - Tragic Hero")).toHaveLength(2);
    });

    it("returns unsupported expensive cards from a hand without early development", () => {
        const hand = [
            "Chernabog - Evildoer",
            "Tramp - Street-Smart Dog",
            "Cri-Kee - Lucky Cricket",
            "Rapunzel - Gifted with Healing",
            "Lady - Decisive Dog",
            "Ursula - Deceiver",
            "Kit Cloudkicker - Tough Guy",
        ];
        const back = putBack(hand, chernadog);
        expect(back).toContain("Chernabog - Evildoer");
        expect(back).toContain("Tramp - Street-Smart Dog");
        expect(back).not.toContain("Lady - Decisive Dog");
        expect(back).not.toContain("Ursula - Deceiver");
    });

    it("keeps a hand with a playable curve", () => {
        const hand = [
            "Lady - Decisive Dog",
            "Nala - Mischievous Cub",
            "Tramp - Enterprising Dog",
            "Go Go Tomago - Darting Dynamo",
            "Lady - Family Dog",
            "Kit Cloudkicker - Tough Guy",
            "Rapunzel - Gifted with Healing",
        ];
        expect(putBack(hand, chernadog)).toEqual([]);
    });

    it("does not reveal a redrawn hand to the opponent", () => {
        const decks = [chernadog, referenceDecks[1].cards];
        const bots = decks.map((deck, i) => createBot({ player: (i + 1) as PlayerNumber, deck, settings: { seed: 2, search: { nodes: 0, samples: 0 } } }));
        const seats: Seat[] = bots.map((controller, i) => ({ player: (i + 1) as PlayerNumber, deck: decks[i], controller }));
        let altered = 0;
        const record = playGame(seats, {
            seed: 11,
            turns: 0,
            trace: (player, update) => {
                for (const observation of update.observations)
                    if (observation.type === "Action" && observation.action.type === "Alter Hand" && observation.action.player !== player) altered++;
            },
        });
        expect(altered).toBe(0);
        const opponent = bots[1].memory.players[1]!;
        expect(opponent.hand).toEqual([]);
        expect(opponent.seenCards).toEqual([]);
        const own = bots[0].memory.players[1]!;
        expect(own.hand.map((card) => card.fullName).sort()).toEqual(record.final.players[1]!.hand.map((card) => card.fullName).sort());
    });
});
