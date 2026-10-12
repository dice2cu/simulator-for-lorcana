// Reproducible bot-versus-bot games and their summaries, shared by the command line and the browser.
import type { HeuristicBot } from "./bot/heuristic-bot";
import { defaultTuning, type Tuning } from "./bot/evaluate";
import type { PlayerNumber } from "./model/identity";
import type { DeckListEntry, PlayerActionDescription, PlayerController } from "./model/player-interaction";
import { playGame, type Seat } from "./player/runner";
import { createBot } from "./search/bots";

export interface Deck {
    readonly name: string;
    readonly cards: readonly DeckListEntry[];
    readonly reference: boolean;
}

/** Bot settings for one seat. Opponent lists are never filled from the real deck unless requested. */
export interface Policy {
    readonly nodes: number;
    readonly samples: number;
    readonly randomness: number;
    /** Evaluation weight experiments, for bot comparisons only. */
    readonly tuning?: Partial<Tuning>;
}

/** One game: decks in seat order, so index 0 goes first. Fully determined by these fields. */
export interface Job {
    readonly id: number;
    readonly decks: readonly [number, number];
    readonly policies: readonly [Policy, Policy];
    readonly seed: number;
    readonly lists: "none" | "confirmed";
    readonly maxTurns: number;
}

export interface GameResult {
    readonly id: number;
    /** Seat index of the winner, or undefined without a result. */
    readonly winner?: 0 | 1;
    readonly reason: "Lore" | "Empty Deck" | "Turn Limit" | "Error";
    readonly error?: string;
    readonly turns: number;
    readonly lore: readonly [number, number];
    readonly decisions: number;
    readonly deciding: number;
    readonly worlds: number;
    readonly replayed: number;
    /** Names of cards each seat played or inked at least once. */
    readonly played: readonly [string[], string[]];
    readonly inked: readonly [string[], string[]];
}

/** Two decks by index into the deck list, with their finished games. */
export interface Matchup {
    readonly a: number;
    readonly b: number;
    readonly games: GameResult[];
}

/** Plays one game. Engine or bot failures are results, so a simulation keeps going. */
export function runGame(decks: readonly Deck[], job: Job, trace?: (line: string) => void, explain = false): GameResult {
    const pair = job.decks.map((index) => decks[index]) as [Deck, Deck];
    const bots: HeuristicBot[] = [];
    let decisions = 0,
        deciding = 0;
    const played: [Set<string>, Set<string>] = [new Set(), new Set()];
    const inked: [Set<string>, Set<string>] = [new Set(), new Set()];
    const seats: Seat[] = pair.map((deck, seat) => {
        const player = (seat + 1) as PlayerNumber;
        const policy = job.policies[seat];
        const bot = createBot({
            player,
            deck: deck.cards,
            ...(job.lists === "confirmed" ? { opponents: { [3 - player]: { type: "Confirmed" as const, cards: pair[1 - seat].cards } } } : {}),
            settings: { seed: job.seed * 31 + seat, search: { nodes: policy.nodes, samples: policy.samples }, randomness: policy.randomness },
        });
        bots.push(bot);
        if (policy.tuning) bot.tuning = { ...defaultTuning, ...policy.tuning };
        if (trace && explain)
            bot.explain = (candidates) => {
                trace(`    P${player} considered:`);
                for (const entry of [...candidates].sort((x, y) => y.score - x.score))
                    trace(`      ${entry.chosen ? "*" : " "} ${entry.score.toFixed(0).padStart(8)}  ${describe(entry.action)}`);
            };
        const controller: PlayerController = {
            observe: (update) => bot.observe(update),
            decide: (state, request) => {
                const started = performance.now();
                const answer = bot.decide(state, request);
                deciding += performance.now() - started;
                decisions++;
                return answer;
            },
        };
        return { player, deck: deck.cards, controller };
    });
    const summary = (fields: Pick<GameResult, "reason" | "turns" | "lore"> & Partial<GameResult>): GameResult => ({
        id: job.id,
        decisions,
        deciding,
        worlds: bots.reduce((sum, bot) => sum + bot.stats.worlds, 0),
        replayed: bots.reduce((sum, bot) => sum + bot.stats.replayed, 0),
        played: [[...played[0]], [...played[1]]],
        inked: [[...inked[0]], [...inked[1]]],
        ...fields,
    });
    let turns = 0;
    try {
        const record = playGame(seats, {
            seed: job.seed,
            maxTurns: job.maxTurns,
            trace: (player, update, position) => {
                if (player !== 1) return;
                turns = position.turn.number;
                for (const observation of update.observations) {
                    if (observation.type !== "Action") continue;
                    const action = observation.action;
                    const seat = action.player - 1;
                    if (action.type === "Play" || action.type === "Shift") played[seat]?.add(action.card.fullName);
                    if (action.type === "Sing") played[seat]?.add(action.song.fullName);
                    if (action.type === "Ink") inked[seat]?.add(action.card.fullName);
                    if (trace && action.type !== "End Turn") trace(`turn ${position.turn.number} P${action.player}: ${describe(action)}`);
                    if (trace && action.type === "End Turn") trace(`  lore ${position.players[1]?.lore ?? 0} - ${position.players[2]?.lore ?? 0}`);
                }
            },
        });
        const lore: [number, number] = [record.final.players[1]?.lore ?? 0, record.final.players[2]?.lore ?? 0];
        const winners = record.outcome?.winners ?? [];
        return summary({
            reason: record.outcome?.reason ?? "Turn Limit",
            turns: record.turns.length,
            lore,
            ...(winners.length === 1 ? { winner: (winners[0] - 1) as 0 | 1 } : {}),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("did not finish")) return summary({ reason: "Turn Limit", turns: job.maxTurns, lore: [0, 0] });
        return summary({ reason: "Error", error: message.split("\n")[0], turns, lore: [0, 0] });
    }
}

/** A short readable action, for traces. */
export function describe(action: PlayerActionDescription): string {
    switch (action.type) {
        case "Challenge":
            return `${action.attacker.fullName} challenges ${action.defender.fullName}`;
        case "Sing":
            return `${action.singers.map((card) => card.fullName).join(" + ")} sing ${action.song.fullName}`;
        case "Move":
            return `move ${action.card.fullName} to ${action.location.fullName}`;
        case "Alter Hand":
            return `put back ${action.cards.length} card${action.cards.length === 1 ? "" : "s"}`;
        case "End Turn":
            return "end turn";
        default:
            return `${action.type.toLowerCase()} ${action.card.fullName}`;
    }
}

/**
 * Every pair of decks except two reference decks, each played `games` times with
 * seats alternating. `owner[job.id]` is the job's matchup index.
 */
export function planMatchups(
    decks: readonly Deck[],
    options: { games: number; policy: Policy; seed: number; lists: Job["lists"]; maxTurns: number },
): { matchups: Matchup[]; jobs: Job[]; owner: number[] } {
    const matchups: Matchup[] = [];
    for (let a = 0; a < decks.length; a++)
        for (let b = a + 1; b < decks.length; b++) if (!(decks[a].reference && decks[b].reference)) matchups.push({ a, b, games: [] });
    const jobs: Job[] = [];
    const owner: number[] = [];
    const { policy } = options;
    matchups.forEach((matchup, index) => {
        for (let game = 0; game < options.games; game++) {
            const order: [number, number] = game % 2 ? [matchup.b, matchup.a] : [matchup.a, matchup.b];
            jobs.push({ id: jobs.length, decks: order, policies: [policy, policy], seed: options.seed * 1_000_003 + index * 10_007 + game, lists: options.lists, maxTurns: options.maxTurns });
            owner.push(index);
        }
    });
    return { matchups, jobs, owner };
}

/** Wins for deck index `deck` in a matchup, over games with a winner. */
export function matchupRecord(matchup: Matchup, jobs: readonly Job[], deck: number) {
    let wins = 0,
        decided = 0;
    const play = { wins: 0, games: 0 },
        draw = { wins: 0, games: 0 };
    for (const game of matchup.games) {
        if (game.winner === undefined) continue;
        decided++;
        const seat = jobs[game.id].decks[0] === deck ? 0 : 1;
        const won = game.winner === seat;
        if (won) wins++;
        const side = seat === 0 ? play : draw;
        side.games++;
        if (won) side.wins++;
    }
    return { wins, decided, play, draw };
}

/** A deck's average win rate over the opponents `against` accepts. Each opponent counts equally, so one long matchup does not dominate. */
export function averageRecord(
    decks: readonly Deck[],
    matchups: readonly Matchup[],
    jobs: readonly Job[],
    deck: number,
    against: (other: Deck) => boolean,
): { rate: number; wins: number; games: number } {
    const rates: number[] = [];
    let wins = 0,
        games = 0;
    for (const matchup of matchups) {
        if (matchup.a !== deck && matchup.b !== deck) continue;
        const other = decks[matchup.a === deck ? matchup.b : matchup.a];
        if (!against(other)) continue;
        const r = matchupRecord(matchup, jobs, deck);
        if (!r.decided) continue;
        rates.push(r.wins / r.decided);
        wins += r.wins;
        games += r.decided;
    }
    return { rate: rates.length ? rates.reduce((sum, value) => sum + value, 0) / rates.length : NaN, wins, games };
}

/** Wilson score interval for a win rate, which behaves at small samples and extreme rates. */
export function wilson(wins: number, games: number): [number, number] {
    if (!games) return [0, 1];
    const z = 1.96,
        p = wins / games;
    const denominator = 1 + (z * z) / games;
    const centre = (p + (z * z) / (2 * games)) / denominator;
    const half = (z * Math.sqrt((p * (1 - p)) / games + (z * z) / (4 * games * games))) / denominator;
    return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export const percent = (value: number, digits = 0): string => (Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "-");
