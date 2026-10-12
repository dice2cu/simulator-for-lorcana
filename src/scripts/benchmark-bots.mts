// Times the player and search layers separately on positions from real bot games.
// npm run benchmark:bots -- --games 3
import { createBot } from "../search/bots.js";
import { HypotheticalInsight, hypothesize, replayTurn } from "../search/insight.js";
import { augment, rewind, TurnHistory } from "../bot/history.js";
import { Knowledge } from "../bot/knowledge.js";
import { sampleFill } from "../bot/sampling.js";
import { evaluate } from "../bot/evaluate.js";
import { analyzeDeck } from "../bot/analysis.js";
import { SeededRandom } from "../player/random.js";
import { projectState, sight } from "../player/projection.js";
import { playGame, type Seat } from "../player/runner.js";
import type { GameState } from "../model/game-state.js";
import type { GameStateView } from "../model/game-state-view.js";
import type { PlayerNumber } from "../model/identity.js";
import type { PlayerRequest, PlayerUpdate } from "../model/player-interaction.js";
import { referenceDecks } from "../tests/fixtures/reference-decks.js";

const gamesAt = process.argv.indexOf("--games");
const games = gamesAt >= 0 ? Number(process.argv[gamesAt + 1]) : 3;

interface Sample {
    position: GameState;
    viewer: PlayerNumber;
}
interface Decision {
    viewer: PlayerNumber;
    state: GameStateView;
    request: Extract<PlayerRequest, { type: "Action" }>;
    record: NonNullable<TurnHistory["turn"]>;
    memory: ReturnType<Knowledge["all"]>;
    deck: (typeof referenceDecks)[number]["cards"];
}

const positions: Sample[] = [];
const updates: PlayerUpdate[] = [];
const decisions: Decision[] = [];
for (let game = 0; game < games; game++) {
    const decks = [referenceDecks[game % referenceDecks.length].cards, referenceDecks[(game + 5) % referenceDecks.length].cards];
    const followers = decks.map((deck, i) => ({ knowledge: new Knowledge((i + 1) as PlayerNumber, deck), history: new TurnHistory() }));
    const seats: Seat[] = decks.map((deck, i) => {
        const bot = createBot({ player: (i + 1) as PlayerNumber, deck, settings: { seed: game, search: { nodes: 0, samples: 0 } } });
        return {
            player: (i + 1) as PlayerNumber,
            deck,
            controller: {
                observe: (update) => {
                    bot.observe(update);
                    followers[i].knowledge.update(update);
                    followers[i].history.record(update, followers[i].knowledge.all());
                },
                decide: (state, request) => {
                    const record = followers[i].history.turn;
                    if (request.type === "Action" && state.turn.player === i + 1 && record && !request.actions.some((entry) => entry.action.type === "Alter Hand"))
                        decisions.push({ viewer: (i + 1) as PlayerNumber, state, request, record, memory: followers[i].knowledge.all(), deck });
                    return bot.decide(state, request);
                },
            },
        };
    });
    playGame(seats, {
        seed: game + 100,
        trace: (player, update, position) => {
            positions.push({ position, viewer: player });
            updates.push(update);
        },
    });
}

function time(label: string, count: number, run: () => void): void {
    const started = performance.now();
    run();
    const elapsed = performance.now() - started;
    console.log(`${label.padEnd(44)} ${(elapsed / Math.max(1, count)).toFixed(3).padStart(9)} ms each  (${count})`);
}

console.log(`${games} games, ${positions.length} delivered updates, ${decisions.length} own-turn action decisions.\n`);
time("projectState (full view snapshot)", positions.length, () => {
    for (const sample of positions) projectState(sample.position, sight(sample.position, sample.viewer));
});
time("Knowledge.update (incremental observations)", updates.length, () => {
    const knowledge = new Knowledge(1, referenceDecks[0].cards);
    for (const update of updates) knowledge.update(update);
});
time("rewind (rebuild the turn's start view)", decisions.length, () => {
    for (const decision of decisions) rewind(decision.record);
});
let replayed = 0;
time("replayTurn (verified turn reconstruction)", decisions.length, () => {
    for (const decision of decisions) {
        const start = rewind(decision.record);
        const actions = decision.record.observations.flatMap((observation) => (observation.type === "Action" ? [observation.action] : []));
        if (start && replayTurn(hypothesize(start), decision.record.steps, decision.viewer, decision.state, actions)) replayed++;
    }
});
console.log(`  ${replayed}/${decisions.length} replays reproduced the view`);
const random = new SeededRandom(1);
time("sampleFill + hypothesize (one sampled world)", decisions.length, () => {
    for (const decision of decisions) {
        const view = augment(decision.state, decision.memory) ?? decision.state;
        hypothesize(view, sampleFill(view, decision.memory, random));
    }
});
const limited = decisions.slice(0, 60);
for (const nodes of [20, 80]) {
    let explored = 0,
        branches = 0;
    time(`simulate one candidate, ${nodes} nodes, with reply`, limited.length, () => {
        for (const decision of limited) {
            const strategy = analyzeDeck(decision.deck);
            const hypothesis = { current: { view: decision.state }, turn: { start: { view: rewind(decision.record) ?? decision.state }, steps: decision.record.steps } };
            const insight = HypotheticalInsight.fromView(decision.state, decision.viewer, hypothesis);
            const option = decision.request.actions.find((entry) => entry.action.type !== "End Turn") ?? decision.request.actions[0];
            const policy = createBot({ player: decision.viewer, deck: decision.deck, settings: { seed: 1, search: { nodes: 0, samples: 0 } } });
            const result = insight.simulate(option.action, option.cost, {
                candidates: (here, request, player) => policy.candidates(here, request, player),
                evaluate: (here) => evaluate(here, decision.viewer, strategy),
                nodes,
                width: 1,
                reply: true,
            });
            if (result) {
                explored += result.nodes;
                branches++;
            }
        }
    });
    console.log(`  ${branches} resolved, ${(explored / Math.max(1, branches)).toFixed(1)} inputs explored on average`);
}
