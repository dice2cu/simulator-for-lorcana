import { describe, expect, it } from "vitest";
import { createBot } from "../../search/bots";
import type { HeuristicBot } from "../../bot/heuristic-bot";
import type { GameState } from "../../model/game-state";
import type { CardIdentifier, PlayerNumber } from "../../model/identity";
import { playGame, type Seat } from "../../player/runner";
import { referenceDecks } from "../fixtures/reference-decks";

const key = (card: CardIdentifier): string => `${card.fullName}#${card.i}`;

/** Everything memory treats as a fact must hold in the authoritative position. */
function verify(bot: HeuristicBot, position: GameState, failures: string[], label: string): void {
    for (const [seat, knowledge] of Object.entries(bot.memory.players)) {
        const actual = position.players[Number(seat) as PlayerNumber];
        if (!knowledge || !actual) continue;
        const where = `${label}, seat ${seat}`;
        knowledge.deckTop.forEach((card, index) => {
            if (!actual.deck[index] || key(actual.deck[index]) !== key(card)) failures.push(`${where}: deckTop[${index}] ${key(card)} is wrong`);
        });
        const offset = actual.deck.length - knowledge.deckBottom.length;
        knowledge.deckBottom.forEach((card, index) => {
            const real = actual.deck[offset + index];
            if (!real || key(real) !== key(card)) failures.push(`${where}: deckBottom[${index}] ${key(card)} is wrong`);
        });
        const hand = new Set(actual.hand.map(key));
        for (const card of knowledge.hand) if (!hand.has(key(card))) failures.push(`${where}: ${key(card)} is not in hand`);
        const inkwell = new Set(actual.inkwell.map((ink) => key(ink.card)));
        for (const card of knowledge.inkwell) if (!inkwell.has(key(card))) failures.push(`${where}: ${key(card)} is not in the inkwell`);
        if (knowledge.deck?.type === "Confirmed") {
            const counts = new Map<string, number>();
            for (const card of actual.deck) counts.set(card.fullName, (counts.get(card.fullName) ?? 0) + 1);
            for (const bounds of knowledge.remainingDeck) {
                const count = counts.get(bounds.fullName) ?? 0;
                if (count < bounds.min || count > bounds.max) failures.push(`${where}: ${bounds.fullName} has ${count}, outside ${bounds.min}-${bounds.max}`);
            }
        }
    }
}

describe("bot knowledge soundness", () => {
    it("never remembers a false fact during complete games", () => {
        const failures: string[] = [];
        let checks = 0;
        for (let game = 0; game < 13; game++) {
            const decks = [referenceDecks[(game * 3) % referenceDecks.length].cards, referenceDecks[(game * 3 + 2) % referenceDecks.length].cards];
            const bots = decks.map((deck, i) =>
                createBot({
                    player: (i + 1) as PlayerNumber,
                    deck,
                    opponents: { [(2 - i) as PlayerNumber]: { type: "Confirmed", cards: decks[1 - i] } },
                    settings: { seed: game + i, search: { nodes: 8, samples: 1 } },
                }),
            );
            const seats: Seat[] = bots.map((controller, i) => ({ player: (i + 1) as PlayerNumber, deck: decks[i], controller }));
            playGame(seats, {
                seed: game + 20,
                trace: (player, _update, position) => {
                    checks++;
                    verify(bots[player - 1], position, failures, `game ${game}, turn ${position.turn.number}, viewer ${player}`);
                },
            });
        }
        expect(checks).toBeGreaterThan(100);
        expect(failures.slice(0, 10)).toEqual([]);
    }, 300000);
});
