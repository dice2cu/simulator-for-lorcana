import { describe, expect, it } from "vitest";
import { analyzeDeck, mechanics } from "../../bot/analysis";
import { revise } from "../../bot/revise";
import { getCard } from "../../cards";
import type { GameStateView, PlayerPositionView } from "../../model/game-state-view";
import type { Strategy } from "../../model/strategy";
import { playGame, type Seat } from "../../player/runner";
import { createBot } from "../../search/bots";
import { HypotheticalInsight } from "../../search/insight";
import { referenceDecks } from "../fixtures/reference-decks";

const deck = (name: string) => referenceDecks.find((entry) => entry.name === name)!.cards;

function seat(lore: number, ink: number, rest: Partial<PlayerPositionView> = {}): PlayerPositionView {
    return { lore, turnsTaken: 4, deck: 30, hand: 4, play: [], discard: [], inkwell: Array.from({ length: ink }, () => ({ exerted: false })), ...rest };
}

const view = (one: PlayerPositionView, two: PlayerPositionView): GameStateView => ({ turn: { number: 9, player: 1 }, players: { 1: one, 2: two } });

describe("strategy revision", () => {
    const base = analyzeDeck(deck("Amber-Steel-Aggro"));

    it("raises board control when an opponent nears victory and keeps the base plan otherwise", () => {
        const calm = revise(base, HypotheticalInsight.fromView(view(seat(5, 3, { hand: [] }), seat(4, 3)), 1), 1, {});
        const urgent = revise(base, HypotheticalInsight.fromView(view(seat(5, 3, { hand: [] }), seat(17, 3)), 1), 1, {});
        expect(urgent.priorities.boardControl).toBeGreaterThan(calm.priorities.boardControl);
        expect(urgent.priorities.development).toBeLessThan(calm.priorities.development);
        expect(calm.resources).toBe(base.resources);
        expect(calm.synergies).toBe(base.synergies);
    });

    it("moves from ink toward lore once the ink target is reached", () => {
        const early = revise(base, HypotheticalInsight.fromView(view(seat(2, 1, { hand: [] }), seat(2, 1)), 1), 1, {});
        const developed = revise(base, HypotheticalInsight.fromView(view(seat(2, base.resources.targetInk, { hand: [] }), seat(2, 1)), 1), 1, {});
        expect(developed.priorities.ink).toBeLessThan(early.priorities.ink);
        expect(developed.priorities.lore).toBeGreaterThan(early.priorities.lore);
    });

    it("becomes more cautious after seeing opposing removal", () => {
        const seen = { 2: { observedColors: [], seenCards: [{ fullName: "Dragon Fire", i: 70 }, { fullName: "Brawl", i: 71 }], hand: [], inkwell: [], deckTop: [], deckBottom: [], remainingDeck: [], unlistedDeck: { min: 0, max: 0 } } };
        const insight = HypotheticalInsight.fromView(view(seat(2, 2), seat(2, 2)), 1);
        expect(revise(base, insight, 1, seen).caution).toBeGreaterThan(revise(base, insight, 1, {}).caution);
    });

    it("revises a supplied plan during play while keeping its custom callback", () => {
        const choose: Strategy["choose"] = () => undefined;
        const supplied: Strategy = { ...analyzeDeck(deck("Amber-Steel-Aggro")), choose };
        const bot = createBot({ player: 1, deck: deck("Amber-Steel-Aggro"), strategy: supplied, settings: { seed: 1, search: { nodes: 0, samples: 0 } } });
        const other = createBot({ player: 2, deck: deck("Amethyst-Ruby-Evasive"), settings: { seed: 1, search: { nodes: 0, samples: 0 } } });
        const seen = new Set<string>();
        const seats: Seat[] = [
            { player: 1, deck: deck("Amber-Steel-Aggro"), controller: bot },
            { player: 2, deck: deck("Amethyst-Ruby-Evasive"), controller: other },
        ];
        playGame(seats, {
            seed: 4,
            trace: (player) => {
                if (player !== 1) return;
                seen.add(JSON.stringify(bot.memory.strategy.priorities));
                expect(bot.memory.strategy.choose).toBe(choose);
            },
        });
        expect(seen.size).toBeGreaterThan(2);
    }, 60000);
});

describe("generated strategies", () => {
    it("recognizes mechanics from parsed rules, not card names", () => {
        for (const name of ["Friends on the Other Side", "Dragon Fire", "Lady - Family Dog", "Sail the Azurite Sea", "Tramp - Dapper Rascal"]) {
            const card = getCard(name)!;
            const renamed = { ...card, fullName: "Unfamiliar - Renamed", names: ["Unfamiliar"] as [string] };
            expect(mechanics(renamed)).toEqual(mechanics(card));
        }
        expect(mechanics(getCard("Dragon Fire")!).removal).toBe(true);
        expect(mechanics(getCard("Friends on the Other Side")!).draw).toBe(true);
    });

    it("discovers each deck's relationships", () => {
        const steelsong = analyzeDeck(deck("Amber-Steel-Steelsong"));
        expect(steelsong.synergies.some((synergy) => synergy.enablers.some((filter) => filter.keyword === "Singer") && synergy.payoffs.some((filter) => filter.song))).toBe(true);
        const chernadog = analyzeDeck(deck("Amber-Emerald-Chernadog"));
        expect(chernadog.resources.preserve.map((entry) => entry.cards.name)).toContain("Tramp");
        // Expensive decks plan for more ink than cheap aggressive ones.
        expect(analyzeDeck(deck("Amethyst-Sapphire-Ramp")).resources.targetInk).toBeGreaterThan(analyzeDeck(deck("Amber-Steel-Aggro")).resources.targetInk);
    });

    it("adjusts caution for a permitted opponent list with removal", () => {
        const own = deck("Amber-Steel-Aggro");
        const against = analyzeDeck(own, { 2: { type: "Confirmed", cards: deck("Ruby-Sapphire-Pawpsicle") } });
        expect(against.caution).toBeGreaterThan(analyzeDeck(own).caution);
    });
});
