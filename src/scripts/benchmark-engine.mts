import { performance } from 'node:perf_hooks';
import { startTurn } from '../engine/engine.js';
import { referenceDecks } from '../tests/fixtures/reference-decks.js';
import { completeCatalogResolution } from '../tests/engine/catalog-driver.js';
import type { GameState, PlayerPosition } from '../model/game-state.js';

// Use the same decks and decision policy before and after an optimization.
// No replay, JSON roundtrip or conservation assertions are timed.
const rounds = Number(process.argv[2] ?? 2);
if (!Number.isSafeInteger(rounds) || rounds < 1) throw new Error('Expected a positive number of rounds');
let actions = 0, turns = 0;
const elapsed: number[] = [];
for (let round = 0; round < rounds; round++) for (const [index, deck] of referenceDecks.entries()) {
    let random = index + 100 + round * 1000;
    const next = (): number => { random = Math.imul(random, 1664525) + 1013904223 | 0; return random >>> 0; };
    const player = (fixture: typeof deck, offset: number): PlayerPosition => {
        const cards = fixture.cards.flatMap(entry => Array.from({ length: entry.count }, () => ({ fullName: entry.fullName, i: offset++ })));
        for (let i = cards.length - 1; i > 0; i--) { const j = next() % (i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
        return { lore: 0, turnsTaken: 0, hand: cards.slice(0, 7), deck: cards.slice(7), discard: [], play: [], inkwell: [] };
    };
    let state: GameState = { turn: { number: 1, player: 1 }, players: {
        1: player(deck, 100), 2: player(referenceDecks[(index + 5) % referenceDecks.length], 1000),
    } };
    const started = performance.now();
    let ended = false;
    for (let turn = 0; turn < 160; turn++) {
        const live = startTurn(state), used = new Set<string>();
        completeCatalogResolution(live, { card: { fullName: deck.cards[0].fullName, i: 0 }, player: state.turn.player, kind: 'Ability' }, {}, state, candidates => {
            actions++;
            const eligible = candidates.filter(action => !used.has(JSON.stringify(action)));
            const priority = ['Shift', 'Ink', 'Sing', 'Play', ...(next() % 2 ? ['Quest', 'Challenge'] : ['Challenge', 'Quest']), 'Activate', 'Boost', 'Move', 'End Turn'];
            let chosen = eligible[0];
            for (const type of priority) {
                const matching = eligible.filter(action => action.type === type);
                if (matching.length) { chosen = matching[next() % matching.length]; break; }
            }
            if (!chosen) throw new Error('No legal action');
            used.add(JSON.stringify(chosen));
            return chosen;
        }, false);
        if (!live.result) throw new Error('Missing finished turn');
        state = live.result;
        turns++;
        if (live.outcome) { ended = true; break; }
    }
    if (!ended) throw new Error(`${deck.name}: game did not finish`);
    elapsed.push(performance.now() - started);
}
const milliseconds = elapsed.reduce((sum, time) => sum + time, 0);
elapsed.sort((a, b) => a - b);
console.log(`${elapsed.length} games, ${turns} turns, ${actions} action decisions`);
console.log(`${(elapsed.length * 1000 / milliseconds).toFixed(2)} games/second, ${(milliseconds / elapsed.length).toFixed(1)} ms/game, ${(milliseconds / actions).toFixed(2)} ms/action decision`);
console.log(`Median ${elapsed[Math.floor(elapsed.length / 2)].toFixed(1)} ms, p95 ${elapsed[Math.floor(elapsed.length * 0.95)].toFixed(1)} ms`);
