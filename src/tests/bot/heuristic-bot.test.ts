import { describe, expect, it } from "vitest";
import { RandomBot } from "../../bot/random-bot";
import { createBot } from "../../search/bots";
import type { PlayerNumber } from "../../model/identity";
import { playGame, type Seat } from "../../player/runner";
import { referenceDecks } from "../fixtures/reference-decks";

describe("heuristic bot", () => {
    it("completes games against a random controller and wins most of them", () => {
        let wins = 0;
        const games = 6;
        const started = performance.now();
        for (let game = 0; game < games; game++) {
            const deck = referenceDecks[game % referenceDecks.length].cards;
            const other = referenceDecks[(game + 3) % referenceDecks.length].cards;
            const botSeat = ((game % 2) + 1) as PlayerNumber;
            const seats: Seat[] = [1, 2].map((player) =>
                player === botSeat
                    ? { player: player as PlayerNumber, deck, controller: createBot({ player: player as PlayerNumber, deck, settings: { seed: game, search: { nodes: 40, samples: 1 } } }) }
                    : { player: player as PlayerNumber, deck: other, controller: new RandomBot({ deck: other, seed: game }) },
            );
            const record = playGame(seats, { seed: game, audit: true });
            if (record.outcome?.winners.includes(botSeat)) wins++;
        }
        console.log(`heuristic vs random: ${wins}/${games} in ${Math.round(performance.now() - started)} ms`);
        expect(wins).toBeGreaterThanOrEqual(5);
    }, 300000);
});
