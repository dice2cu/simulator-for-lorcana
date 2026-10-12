import { describe, expect, it } from "vitest";
import { resumeTurn } from "../../engine/resume";
import type { GameState } from "../../model/game-state";
import type { PlayerNumber } from "../../model/identity";
import type { Rules } from "../../engine/rules";
import { playGame, type Seat } from "../../player/runner";
import { createBot } from "../../search/bots";
import { referenceDecks } from "../fixtures/reference-decks";

/** Lore the turn player can quest for with ready, dry characters. */
function reachable(state: GameState, rules: Rules): number {
    let lore = 0;
    for (const entry of state.players[state.turn.player]!.play) {
        if (rules.definition(entry.card).type !== "Character" || entry.exerted || entry.drying) continue;
        if (rules.keyword(entry.card, "Reckless") || rules.restricted(entry.card, "Can't Quest")) continue;
        lore += rules.characteristic(entry.card, "Lore");
    }
    return lore;
}

describe("full-game decision audit", () => {
    it("never ends a turn short of victory when its first intention could quest to victory", () => {
        const missed: string[] = [];
        let turns = 0;
        for (let game = 0; game < 8; game++) {
            const decks = [referenceDecks[game % 13], referenceDecks[(game * 5 + 3) % 13]];
            const seats: Seat[] = decks.map((deck, i) => ({
                player: (i + 1) as PlayerNumber,
                deck: deck.cards,
                controller: createBot({ player: (i + 1) as PlayerNumber, deck: deck.cards, settings: { seed: game, search: { nodes: 100, samples: 1 } } }),
            }));
            const record = playGame(seats, { seed: game + 500 });
            record.turns.forEach(({ start, turn }, index) => {
                const first = turn.steps.findIndex((step) => step.type === "Action");
                if (first < 0) return;
                const live = resumeTurn(start, turn.steps.slice(0, first));
                const position = live.position!,
                    player = position.turn.player;
                const victory = live.rules!.victoryLore(player);
                const end = record.turns[index + 1]?.start ?? record.final;
                turns++;
                if (position.players[player]!.lore + reachable(position, live.rules!) >= victory && (end.players[player]?.lore ?? 0) < victory)
                    missed.push(`game ${game}, turn ${position.turn.number}, ${decks[player - 1].name}`);
            });
        }
        expect(turns).toBeGreaterThan(100);
        expect(missed).toEqual([]);
    }, 300000);
});
