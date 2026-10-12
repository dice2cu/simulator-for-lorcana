import { describe, expect, it } from "vitest";
import { applyTurn } from "../../engine/resume";
import { startGame } from "../../engine/engine";
import { RandomBot } from "../../bot/random-bot";
import type { PlayerAnswer, PlayerController, PlayerRequest, PlayerUpdate } from "../../model/player-interaction";
import type { GameStateView } from "../../model/game-state-view";
import type { GameState } from "../../model/game-state";
import { initialState, playGame, playGameAsync, type GameRecord, type Seat } from "../../player/runner";
import { SeededRandom } from "../../player/random";
import { referenceDecks } from "../fixtures/reference-decks";

const deck = (index: number) => referenceDecks[index % referenceDecks.length].cards;

function replays(record: GameRecord): void {
    const setup = startGame(record.initial);
    for (const step of JSON.parse(JSON.stringify(record.setup)).steps) setup.submit(step);
    expect(setup.result).toEqual(record.turns[0]?.start);
    record.turns.forEach(({ start, turn }, index) => {
        const next = record.turns[index + 1]?.start ?? record.final;
        expect(applyTurn(start, JSON.parse(JSON.stringify(turn)))).toEqual(next);
    });
}

describe("controller runner", () => {
    it("plays reference decks to an outcome with random controllers and reproducible turns", () => {
        for (let game = 0; game < 13; game++) {
            const seats: Seat[] = [1, 2].map((player) => ({
                player: player as 1 | 2,
                deck: deck(game + (player - 1) * 5),
                controller: new RandomBot({ deck: deck(game + (player - 1) * 5), seed: game * 10 + player }),
            }));
            const record = playGame(seats, { seed: game, audit: true });
            expect(record.outcome?.winners.length).toBeGreaterThan(0);
            replays(record);
        }
    }, 120000);

    it("is reproducible with the same seed", () => {
        const run = () =>
            playGame(
                [1, 2].map((player) => ({ player: player as 1 | 2, deck: deck(player), controller: new RandomBot({ deck: deck(player), seed: player }) })),
                { seed: 7 },
            );
        expect(JSON.stringify(run())).toEqual(JSON.stringify(run()));
    });

    it("assigns identifiers independently of deck-list order", () => {
        const seats: Seat[] = [1, 2].map((player) => ({
            player: player as 1 | 2,
            deck: deck(player),
            controller: new RandomBot({ deck: deck(player), seed: player }),
        }));
        const numbers = initialState(seats, 1, new SeededRandom(3)).players[1]!.deck.map((card) => card.i);
        expect(numbers).not.toEqual([...numbers].sort((a, b) => a - b));
        expect(new Set(numbers).size).toBe(numbers.length);
    });
});

describe("asynchronous controllers", () => {
    class Delayed implements PlayerController {
        updates = 0;
        constructor(private readonly inner: RandomBot) {}
        async observe(update: PlayerUpdate): Promise<void> {
            await new Promise((resolve) => setTimeout(resolve, 0));
            this.updates++;
            this.inner.observe(update);
        }
        async decide(state: GameStateView, request: PlayerRequest): Promise<PlayerAnswer> {
            await Promise.resolve();
            return this.inner.decide(state, request);
        }
    }

    it("awaits UI-style controllers and produces the same game as synchronous controllers", async () => {
        const seats = (wrap: boolean): Seat[] =>
            [1, 2].map((player) => {
                const bot = new RandomBot({ deck: deck(player + 2), seed: player });
                return { player: player as 1 | 2, deck: deck(player + 2), controller: wrap ? new Delayed(bot) : bot };
            });
        const direct = playGame(seats(false), { seed: 11 });
        const delayed = seats(true);
        const awaited = await playGameAsync(delayed, { seed: 11 });
        expect(awaited).toEqual(direct);
        for (const seat of delayed) expect((seat.controller as Delayed).updates).toBeGreaterThan(0);
    });

    it("rejects promises in the synchronous runner", () => {
        const bot = new RandomBot({ deck: deck(1), seed: 1 });
        const seats: Seat[] = [
            { player: 1, deck: deck(1), controller: { observe: () => {}, decide: async (state, request) => bot.decide(state, request) } },
            { player: 2, deck: deck(2), controller: new RandomBot({ deck: deck(2), seed: 2 }) },
        ];
        expect(() => playGame(seats, { seed: 1 })).toThrow(/promise/);
    });
});

describe("invalid answers", () => {
    const seats = (controller: PlayerController): Seat[] => [
        { player: 1, deck: deck(1), controller },
        { player: 2, deck: deck(2), controller: new RandomBot({ deck: deck(2), seed: 2 }) },
    ];

    it("fails fast in simulations", () => {
        expect(() => playGame(seats({ observe: () => {}, decide: () => ({ type: "Action", option: 999 }) }), { seed: 1 })).toThrow(/invalid answer/);
    });

    it("asks again with the unchanged request and a safe message when retrying", () => {
        const bot = new RandomBot({ deck: deck(1), seed: 1 });
        const errors: string[] = [];
        let previous: PlayerRequest | undefined,
            wrong = true;
        const controller: PlayerController = {
            observe: (update) => bot.observe(update),
            decide: (state, request, error) => {
                if (error) {
                    errors.push(error);
                    expect(request).toBe(previous);
                }
                previous = request;
                if (wrong && request.type === "Action") {
                    wrong = false;
                    return { type: "Action", option: -1 };
                }
                return bot.decide(state, request);
            },
        };
        playGame(seats(controller), { seed: 1, retry: true, maxTurns: 4 * 50 });
        expect(errors).toEqual(["Unknown action option"]);
    });
});

describe("runner from a saved position", () => {
    it("introduces the position to every seat and stops after the requested turns", () => {
        const decks = [deck(0), deck(1)];
        const first = playGame(
            decks.map((cards, i) => ({ player: (i + 1) as 1 | 2, deck: cards, controller: new RandomBot({ deck: cards, seed: i }) })),
            { seed: 9, turns: 3 },
        );
        expect(first.outcome).toBeUndefined();
        expect(first.turns).toHaveLength(3);
        const updates: PlayerUpdate[][] = [[], []];
        const seats: Seat[] = decks.map((cards, i) => {
            const bot = new RandomBot({ deck: cards, seed: i + 5 });
            return {
                player: (i + 1) as 1 | 2,
                deck: cards,
                controller: {
                    observe: (update: PlayerUpdate) => (updates[i].push(update), bot.observe(update)),
                    decide: (state: GameStateView, request: PlayerRequest) => bot.decide(state, request),
                },
            };
        });
        const resumed = playGame(seats, { seed: 4, from: first.final, turns: 2 });
        expect(resumed.initial).toBe(first.final);
        expect(resumed.setup.steps).toEqual([]);
        expect(resumed.turns).toHaveLength(2);
        expect(resumed.turns[0].start).toBe(first.final);
        for (const [i, received] of updates.entries()) {
            expect(received[0].turn.steps).toEqual([]);
            expect(received[0].observations).toEqual([]);
            expect(received[0].state.turn).toEqual(first.final.turn);
            expect(typeof received[0].state.players[(2 - i) as 1 | 2]!.hand).toBe("number");
        }
        replayed(resumed);
    });
});

/** Every recorded turn reproduces the next start without a setup record. */
function replayed(resumed: GameRecord): void {
    resumed.turns.forEach(({ start, turn }, index) => {
        const next = resumed.turns[index + 1]?.start ?? resumed.final;
        expect(applyTurn(start, JSON.parse(JSON.stringify(turn)))).toEqual(next);
    });
}

describe("three-player games", () => {
    it("plays to a winner and tells an eliminated seat while the others continue", () => {
        const cards = (from: number, names: string[]) => names.map((fullName, i) => ({ fullName, i: from + i }));
        const filler = (from: number) => cards(from, Array<string>(12).fill("Lady - Family Dog"));
        const from: GameState = {
            turn: { number: 4, player: 1 },
            players: {
                // Player 1 starts the turn with one card left, draws it and decks out at the end of the turn.
                1: { lore: 0, turnsTaken: 1, deck: cards(1, ["Lady - Family Dog"]), hand: [], play: [], discard: [], inkwell: [] },
                2: { lore: 0, turnsTaken: 1, deck: filler(100), hand: [], play: [], discard: [], inkwell: [] },
                3: { lore: 0, turnsTaken: 1, deck: filler(200), hand: [], play: [], discard: [], inkwell: [] },
            },
        };
        const outcomes: [number, PlayerUpdate["outcome"]][] = [];
        const seats: Seat[] = ([1, 2, 3] as const).map((player) => {
            const bot = new RandomBot({ deck: deck(player), seed: player });
            return {
                player,
                deck: deck(player),
                controller: {
                    observe: (update: PlayerUpdate) => {
                        if (update.outcome) outcomes.push([player, update.outcome]);
                        bot.observe(update);
                    },
                    decide: (state: GameStateView, request: PlayerRequest) => bot.decide(state, request),
                },
            };
        });
        const record = playGame(seats, { seed: 5, from });
        expect(record.outcome?.winners).toHaveLength(1);
        expect(record.outcome?.eliminated).toContain(1);
        const first = outcomes.find(([player]) => player === 1)!;
        expect(first[1]).toEqual({ winners: [], eliminated: [1], reason: "Empty Deck" });
        // Remaining seats learn the final result only when the game ends.
        expect(outcomes.filter(([player]) => player !== 1).every(([, outcome]) => outcome!.winners.length === 1)).toBe(true);
        expect(record.final.players[1]).toBeUndefined();
    });
});
