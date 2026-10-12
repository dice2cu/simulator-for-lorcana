import { expect, it } from "vitest";
import { cards, getCard } from "../../cards";
import { startTurn } from "../../engine/engine";
import { applyTurn } from "../../engine/resume";
import { completeCatalogResolution } from "./catalog-driver";
import type { GameState, PlayerPosition } from "../../model/game-state";
import { referenceDecks } from "../fixtures/reference-decks";

// Mechanic-rich fixtures, not recommendations or tournament deck lists.
const pools = [
    [
        "Merlin - Goat",
        "Merlin - Rabbit",
        "Madam Mim - Snake",
        "Madam Mim - Fox",
        "Friends on the Other Side",
        "The Queen's Castle - Mirror Chamber",
        "Maleficent - Sorceress",
    ],
    [
        "Hercules - True Hero",
        "Hercules - Divine Hero",
        "Mickey Mouse - True Friend",
        "Dinglehopper",
        "Be Prepared",
        "Grab Your Sword",
        "Maui - Hero to All",
        "Powhatan's Staff",
    ],
];

it("finishes mixed-catalog games with conservation and deterministic whole-turn reproduction", () => {
    const catalog = [...new Map(cards.map((card) => [card.fullName, card])).values()];
    const failures: string[] = [];
    for (let seed = 1; seed <= 256; seed++) {
        let random = seed * 7919;
        const next = (): number => {
            random = (Math.imul(random, 1664525) + 1013904223) | 0;
            return random >>> 0;
        };
        const player = (offset: number): PlayerPosition => {
            const deck = Array.from({ length: 60 }, (_, i) => ({ fullName: catalog[next() % catalog.length].fullName, i: offset + i }));
            return { lore: 0, turnsTaken: 0, hand: deck.slice(0, 7), deck: deck.slice(7), discard: [], play: [], inkwell: [] };
        };
        let state: GameState = { turn: { number: 1, player: 1 }, players: { 1: player(100), 2: player(200) } };
        try {
            let ended = false;
            for (let turn = 0; turn < 150; turn++) {
                const before = state,
                    live = startTurn(state),
                    used = new Set<string>();
                completeCatalogResolution(
                    live,
                    { card: { fullName: catalog[0].fullName, i: 0 }, player: state.turn.player, kind: "Ability" },
                    {},
                    state,
                    (actions) => {
                        const available = actions.filter((action) => !used.has(JSON.stringify(action)));
                        const active = available.filter((action) => action.type !== "End Turn" && action.type !== "Alter Hand");
                        const action = active.length ? active[next() % active.length] : actions.find((action) => action.type === "End Turn");
                        if (!action) throw new Error("Missing End Turn");
                        used.add(JSON.stringify(action));
                        return action;
                    },
                );
                if (!live.result) throw new Error("Missing completed turn");
                state = live.result;
                expect(applyTurn(before, JSON.parse(JSON.stringify(live.turn)))).toEqual(state);
                if (live.outcome) {
                    ended = true;
                    break;
                }
            }
            expect(ended, `Seed ${seed} did not finish`).toBe(true);
        } catch (error) {
            failures.push(`Seed ${seed}, turn ${state.turn.number}: ${error instanceof Error ? error.stack : String(error)}`);
        }
    }
    expect(failures, failures.join("\n")).toEqual([]);
}, 120000);

it("finishes mechanic-rich catalog games with conservation and exact turn reconstruction", () => {
    for (const pool of pools) for (const name of pool) if (!getCard(name)) throw new Error(`Missing fixture card: ${name}`);
    for (let seed = 1; seed <= 30; seed++) {
        let random = seed;
        const next = (): number => {
            random = (Math.imul(random, 1664525) + 1013904223) | 0;
            return random >>> 0;
        };
        const player = (number: number): PlayerPosition => {
            const pool = pools[(seed + number) % pools.length];
            const deck = Array.from({ length: 40 }, (_, i) => ({ fullName: pool[next() % pool.length], i: number * 100 + i }));
            return { lore: 0, turnsTaken: 0, hand: deck.slice(0, 7), deck: deck.slice(7), discard: [], play: [], inkwell: [] };
        };
        let state: GameState = { turn: { number: 1, player: 1 }, players: { 1: player(1), 2: player(2) } };
        let ended = false;
        for (let turn = 0; turn < 100; turn++) {
            const before = state,
                live = startTurn(state);
            const used = new Set<string>();
            completeCatalogResolution(live, { card: { fullName: pools[0][0], i: 0 }, player: state.turn.player, kind: "Ability" }, {}, state, (actions) => {
                const candidate =
                    actions.find((action) => action.type === "Shift") ??
                    actions.find((action) => action.type === "Quest") ??
                    actions.find((action) => action.type === "Ink") ??
                    actions.find((action) => action.type === "Sing" || action.type === "Play") ??
                    actions.find(
                        (action) => (action.type === "Boost" || action.type === "Activate" || action.type === "Move") && !used.has(JSON.stringify(action)),
                    ) ??
                    actions.find((action) => action.type === "Challenge") ??
                    actions.find((action) => action.type === "End Turn");
                if (!candidate) throw new Error("No legal action");
                used.add(JSON.stringify(candidate));
                return candidate;
            });
            if (!live.result) throw new Error("Missing finished turn");
            state = live.result;
            expect(applyTurn(before, JSON.parse(JSON.stringify(live.turn)))).toEqual(state);
            if (live.outcome) {
                ended = true;
                break;
            }
        }
        expect(ended, `Seed ${seed} did not finish`).toBe(true);
    }
}, 120000);

it("plays all thirteen reference decks through complete games and reconstructs their turns", () => {
    const failures: string[] = [];
    for (const [index, deck] of referenceDecks.entries()) {
        let random = index + 100;
        const next = (): number => {
            random = (Math.imul(random, 1664525) + 1013904223) | 0;
            return random >>> 0;
        };
        const player = (fixture: typeof deck, offset: number): PlayerPosition => {
            const cards = fixture.cards.flatMap((entry) => {
                if (!getCard(entry.fullName)) throw new Error(`Missing fixture: ${entry.fullName}`);
                return Array.from({ length: entry.count }, () => ({ fullName: entry.fullName, i: offset++ }));
            });
            for (let i = cards.length - 1; i > 0; i--) {
                const j = next() % (i + 1);
                [cards[i], cards[j]] = [cards[j], cards[i]];
            }
            return { lore: 0, turnsTaken: 0, hand: cards.slice(0, 7), deck: cards.slice(7), discard: [], play: [], inkwell: [] };
        };
        try {
            let state: GameState = {
                turn: { number: 1, player: 1 },
                players: {
                    1: player(deck, 100),
                    2: player(referenceDecks[(index + 5) % referenceDecks.length], 1000),
                },
            };
            let ended = false;
            for (let turn = 0; turn < 160; turn++) {
                const before = state,
                    live = startTurn(state),
                    used = new Set<string>();
                completeCatalogResolution(
                    live,
                    { card: { fullName: deck.cards[0].fullName, i: 0 }, player: state.turn.player, kind: "Ability" },
                    {},
                    state,
                    (actions) => {
                        const candidates = actions.filter((action) => !used.has(JSON.stringify(action)));
                        const priority = [
                            "Shift",
                            "Ink",
                            "Sing",
                            "Play",
                            ...(next() % 2 ? ["Quest", "Challenge"] : ["Challenge", "Quest"]),
                            "Activate",
                            "Boost",
                            "Move",
                            "End Turn",
                        ];
                        let chosen = candidates[0];
                        for (const type of priority) {
                            const matching = candidates.filter((action) => action.type === type);
                            if (matching.length) {
                                chosen = matching[next() % matching.length];
                                break;
                            }
                        }
                        if (!chosen) throw new Error("No legal action");
                        used.add(JSON.stringify(chosen));
                        return chosen;
                    },
                );
                if (!live.result) throw new Error("Missing finished turn");
                state = live.result;
                expect(applyTurn(before, JSON.parse(JSON.stringify(live.turn)))).toEqual(state);
                if (live.outcome) {
                    ended = true;
                    break;
                }
            }
            if (!ended) throw new Error("Game did not finish");
        } catch (error) {
            failures.push(`${deck.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    expect(failures).toEqual([]);
}, 120000);
