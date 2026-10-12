import { createBot, playGameAsync, type PlayerAnswer, type PlayerNumber, type Seat } from "../simulator";
import type { GameMessage, GameSetup } from "./protocol";

const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Runs one game. Human seats send their updates and requests out and wait for
 * `answer`. Bots play in place and never see more than their own view.
 */
export async function hostGame(setup: GameSetup, send: (message: GameMessage) => void, answer: () => Promise<PlayerAnswer>, pause = wait): Promise<void> {
    const seats: Seat[] = setup.seats.map((seat, index): Seat => {
        const player = (index + 1) as PlayerNumber;
        if (seat.controller === "Human")
            return {
                player,
                deck: seat.deck,
                controller: {
                    observe: (update) => send({ type: "update", player, update }),
                    decide: (state, request, error) => {
                        send({ type: "request", player, state, request, ...(error ? { error } : {}) });
                        return answer();
                    },
                },
            };
        const bot = createBot({ player, deck: seat.deck, settings: { seed: setup.seed * 31 + index, search: { nodes: setup.nodes, samples: 1 } } });
        return {
            player,
            deck: seat.deck,
            controller: {
                observe: (update) => bot.observe(update),
                decide: async (state, request) => {
                    if (setup.botDelay > 0 && request.type === "Action") await pause(setup.botDelay);
                    return bot.decide(state, request);
                },
            },
        };
    });
    try {
        const record = await playGameAsync(seats, { seed: setup.seed, first: setup.first, retry: true, characteristics: true });
        send({ type: "end", ...(record.outcome ? { outcome: record.outcome } : {}) });
    } catch (error) {
        send({ type: "end", error: error instanceof Error ? error.message : String(error) });
    }
}
