// Random games over the whole catalog, to find engine bugs that no card test covers.
// npm run fuzz -- [games] [pool size] [players] [first seed]
// Each deck repeats a small random pool, so the same cards meet often. Random bots
// answer through the real runner and player views. Every turn is checked for
// invariants and replayed exactly. Failures are grouped by message with their seeds.
import { cards } from '../cards.js';
import { applyTurn } from '../engine/resume.js';
import { Rules } from '../engine/rules.js';
import { playGame } from '../player/runner.js';
import { RandomBot } from '../bot/random-bot.js';
import type { GameState } from '../model/game-state.js';
import type { PlayerNumber } from '../model/identity.js';
import type { DeckListEntry } from '../model/player-interaction.js';

const [games = 500, poolSize = 10, seats = 2, firstSeed = 1] = process.argv.slice(2).map(Number);
if (![games, poolSize, seats, firstSeed].every(Number.isSafeInteger) || seats < 2 || seats > 4) throw new Error('Usage: npm run fuzz -- [games] [pool size] [players 2-4] [first seed]');

// Joint opposing decisions belong to Illumineer's Quest. The runner deliberately does not
// let one seat answer for several players, so these cards only play in two-player games.
const joint = new Set(['Hercules - Manipulated Hero', 'Tamatoa - Grabby Crab', 'Fortunate Hit', 'Monumental Scarab - Skittering Statue', 'Destructive Misstep']);
const catalog = [...new Map(cards.map(card => [card.fullName, card])).values()].filter(card => seats === 2 || !joint.has(card.fullName));

function invariants(state: GameState): void {
    const rules = new Rules(state);
    for (const [seat, player] of Object.entries(state.players)) {
        if (!player) continue;
        if (player.lore < 0) throw new Error(`Player ${seat} has negative lore`);
        for (const entry of player.play) {
            const definition = rules.definition(entry.card);
            if (definition.type === 'Action') throw new Error(`Action in play: ${definition.fullName}`);
            const damage = entry.damage ?? 0;
            if (damage < 0) throw new Error(`Negative damage on ${definition.fullName}`);
            if ((definition.type === 'Character' || definition.type === 'Location') && damage > 0 && damage >= rules.characteristic(entry.card, 'Willpower'))
                throw new Error(`Lethal damage left on ${definition.fullName}`);
            if (entry.location && !player.play.some(other => other.card.fullName === entry.location!.fullName && other.card.i === entry.location!.i))
                throw new Error(`${definition.fullName} is at a location its player does not control`);
            for (const modifier of entry.modifiers ?? []) {
                const expires = modifier.expires;
                if (expires && 'endOfTurn' in expires && expires.endOfTurn < state.turn.number) throw new Error(`Stale end-of-turn modifier on ${definition.fullName}`);
                if (expires && 'endOfChallenge' in expires) throw new Error('A challenge modifier outlived its challenge');
            }
        }
    }
}

const failures = new Map<string, string[]>();
for (let seed = firstSeed; seed < firstSeed + games; seed++) {
    let random = seed * 104729 + 3;
    const next = (): number => { random = Math.imul(random, 1664525) + 1013904223 | 0; return random >>> 0; };
    const deck = (): DeckListEntry[] => {
        const pool = Array.from({ length: poolSize }, () => catalog[next() % catalog.length].fullName);
        const counts = new Map<string, number>();
        for (let i = 0; i < 60; i++) {
            const name = pool[next() % pool.length];
            counts.set(name, (counts.get(name) ?? 0) + 1);
        }
        return [...counts].map(([fullName, count]) => ({ fullName, count }));
    };
    const decks = Array.from({ length: seats }, deck);
    let where = 'setup';
    try {
        const record = playGame(
            decks.map((list, i) => ({ player: (i + 1) as PlayerNumber, deck: list, controller: new RandomBot({ deck: list, seed: seed * 4 + i }) })),
            { seed, maxTurns: 300 },
        );
        for (const [i, { start, turn }] of record.turns.entries()) {
            where = `turn ${i + 1}`;
            invariants(start);
            const after = record.turns[i + 1]?.start ?? record.final;
            if (JSON.stringify(applyTurn(start, JSON.parse(JSON.stringify(turn)))) !== JSON.stringify(after)) throw new Error('Turn replay differs');
        }
    } catch (error) {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
        const seeds = failures.get(message) ?? [];
        seeds.push(`seed ${seed} (${where})`);
        failures.set(message, seeds);
    }
}
const failed = [...failures.values()].reduce((sum, seeds) => sum + seeds.length, 0);
console.log(`${games} games, ${seats} players, pools of ${poolSize}: ${failed} failed`);
for (const [message, seeds] of [...failures].sort((a, b) => b[1].length - a[1].length)) console.log(`  ${seeds.length}x ${message}\n     ${seeds.slice(0, 5).join(', ')}`);
if (failed) process.exitCode = 1;
