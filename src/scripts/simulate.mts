// Deck simulator. Usage below, also printed by --help.

import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isMainThread } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import {
    averageRecord,
    deckFiles,
    defaultWorkers,
    loadDeck,
    matchupRecord as record,
    percent,
    planMatchups,
    progressBar,
    runGame,
    runJobs,
    serveJobs,
    wilson,
    type Deck,
    type Job,
    type Matchup,
    type Policy,
} from "./simulation/games.mjs";

const usage = `Deck simulator: every deck against every other deck and every reference deck.
Reference decks are known-strong lists and never play each other.

  npm run simulate                                    decks in decks against reference-decks
  npm run simulate -- decks/a.deck decks/b.deck        chosen decks
  npm run simulate -- reference-decks --no-reference  reference decks against each other
  npm run simulate -- --trace "First deck|Second deck|seed"   one game, action by action

Options:
  --reference DIR   reference decks (default reference-decks)
  --no-reference    play only the given decks against each other
  --games N         games per matchup, alternating who goes first (default 20)
  --workers N       worker threads (default: half the logical CPUs)
  --nodes N         bot search inputs per decision (default 200; 0 disables search)
  --samples N       sampled hidden worlds per decision (default 1)
  --randomness R    chance of a deliberately weaker choice (default 0)
  --lists MODE      none (default) or confirmed: give each bot its opponent's real list
  --max-turns N     turns before a game counts as unfinished (default 100)
  --seed N          base seed (default 1)
  --cards           per-card statistics for each non-reference deck
  --json FILE       also write the full results as JSON
  --explain         with --trace, list each searched action's candidates and scores`;

function parse(argv: readonly string[]) {
    const options = {
        inputs: [] as string[],
        reference: "reference-decks",
        games: 20,
        workers: defaultWorkers(),
        nodes: 200,
        samples: 1,
        randomness: 0,
        lists: "none" as "none" | "confirmed",
        maxTurns: 100,
        seed: 1,
        cards: false,
        json: "",
        trace: "",
        explain: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const name = argv[i];
        const value = (): string => {
            const next = argv[++i];
            if (next === undefined) throw new Error(`Missing value for ${name}`);
            return next;
        };
        const number = (): number => {
            const parsed = Number(value());
            if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} needs a nonnegative number`);
            return parsed;
        };
        switch (name) {
            case "--reference": options.reference = value(); break;
            case "--no-reference": options.reference = ""; break;
            case "--games": options.games = number(); break;
            case "--workers": options.workers = Math.max(1, number()); break;
            case "--nodes": options.nodes = Math.floor(number()); break;
            case "--samples": options.samples = Math.floor(number()); break;
            case "--randomness": options.randomness = number(); break;
            case "--max-turns": options.maxTurns = Math.floor(number()); break;
            case "--seed": options.seed = Math.floor(number()); break;
            case "--cards": options.cards = true; break;
            case "--json": options.json = value(); break;
            case "--trace": options.trace = value(); break;
            case "--explain": options.explain = true; break;
            case "--lists": {
                const mode = value();
                if (mode !== "none" && mode !== "confirmed") throw new Error("--lists must be none or confirmed");
                options.lists = mode;
                break;
            }
            case "-h":
            case "--help":
                console.log(usage);
                process.exit(0);
            default:
                if (name.startsWith("--")) throw new Error(`Unknown option ${name}`);
                options.inputs.push(name);
        }
    }
    // The decks folder holds personal decks and is not part of the project.
    if (!options.inputs.length && existsSync("decks")) options.inputs.push("decks");
    return options;
}

async function main(): Promise<void> {
    const options = parse(process.argv.slice(2));
    const referenceFolder = options.reference && resolve(options.reference);
    const load = (files: string[], reference: boolean): Deck[] =>
        files.flatMap((file) => {
            const loaded = loadDeck(file, reference);
            if ("problem" in loaded) {
                console.warn(`Skipping ${file}: ${loaded.problem}`);
                return [];
            }
            return [loaded];
        });
    const own = load(
        deckFiles(options.inputs).filter((file) => !referenceFolder || dirname(resolve(file)) !== referenceFolder),
        false,
    );
    const references = referenceFolder ? load(deckFiles([referenceFolder]), true) : [];
    const decks = [...own, ...references];
    const duplicate = decks.find((deck, i) => decks.findIndex((other) => other.name === deck.name) !== i);
    if (duplicate) throw new Error(`Two decks are named "${duplicate.name}"`);
    const policy: Policy = { nodes: options.nodes, samples: options.samples, randomness: options.randomness };

    if (options.trace) {
        const [first, second, seed] = options.trace.split("|");
        const find = (name: string): number => {
            const index = decks.findIndex((deck) => deck.name === name);
            if (index < 0) throw new Error(`Unknown deck ${name}`);
            return index;
        };
        const job: Job = { id: 0, decks: [find(first), find(second)], policies: [policy, policy], seed: Number(seed), lists: options.lists, maxTurns: options.maxTurns };
        const result = runGame(decks, job, (line) => console.log(line), options.explain);
        const outcome = result.winner === undefined ? `no winner (${result.error ?? result.reason})` : `${decks[job.decks[result.winner]].name} wins by ${result.reason}`;
        console.log(`\n${outcome} after ${result.turns} turns, lore ${result.lore[0]} - ${result.lore[1]}`);
        return;
    }

    if (!own.length || decks.length < 2) {
        throw new Error(`Need at least one deck and an opponent (found ${own.length} decks and ${references.length} reference decks). Put deck files in decks/ or name them.`);
    }
    const { matchups, jobs, owner } = planMatchups(decks, { games: options.games, policy, seed: options.seed, lists: options.lists, maxTurns: options.maxTurns });

    console.log(`Decks: ${own.map((deck) => deck.name).join(", ")}`);
    if (references.length) console.log(`Reference decks: ${references.map((deck) => deck.name).join(", ")}`);
    console.log(
        `${matchups.length} matchups x ${options.games} games = ${jobs.length} games on ${Math.min(options.workers, jobs.length)} workers. ` +
            `Bots: ${options.nodes} search nodes, ${options.samples} sampled worlds, randomness ${options.randomness}. ` +
            `Opponent lists: ${options.lists === "confirmed" ? "each bot knows its opponent's list" : "none"}.`,
    );
    const started = performance.now();
    const results = await runJobs(fileURLToPath(import.meta.url), decks, jobs, options.workers, progressBar(jobs.length));
    const elapsed = performance.now() - started;
    for (const result of results) matchups[owner[result.id]].games.push(result);
    for (const matchup of matchups) matchup.games.sort((x, y) => x.id - y.id);
    report(decks, matchups, jobs, options, elapsed);
    if (options.json) {
        writeFileSync(options.json, JSON.stringify({ options, decks: decks.map(({ name, reference }) => ({ name, reference })), matchups, jobs }, null, 1));
        console.log(`\nResults written to ${resolve(options.json)}`);
    }
}

function report(decks: readonly Deck[], matchups: readonly Matchup[], jobs: readonly Job[], options: ReturnType<typeof parse>, elapsed: number): void {
    const width = Math.max(...decks.map((deck) => deck.name.length));
    const lines: string[] = [];
    const rate = (wins: number, games: number): string => {
        const [low, high] = wilson(wins, games);
        return `${percent(wins / games).padStart(4)} [${percent(low)}-${percent(high)}]`.padEnd(16);
    };
    const line = (matchup: Matchup): string => {
        const r = record(matchup, jobs, matchup.a);
        return (
            `  ${decks[matchup.a].name.padEnd(width)}  vs  ${decks[matchup.b].name.padEnd(width)}  ${String(r.wins).padStart(3)}-${String(r.decided - r.wins).padEnd(3)} ${rate(r.wins, r.decided)}` +
            `  on the play ${percent(r.play.wins / r.play.games).padStart(4)}, on the draw ${percent(r.draw.wins / r.draw.games).padStart(4)}` +
            (r.decided < matchup.games.length ? `  (${matchup.games.length - r.decided} without a winner)` : "")
        );
    };
    const average = (deck: number, against: (other: Deck) => boolean) => averageRecord(decks, matchups, jobs, deck, against);
    const own = decks.map((deck, index) => ({ deck, index })).filter(({ deck }) => !deck.reference);
    const references = decks.map((deck, index) => ({ deck, index })).filter(({ deck }) => deck.reference);
    const ranked = own
        .map((entry) => ({ ...entry, reference: average(entry.index, (other) => other.reference), others: average(entry.index, (other) => !other.reference) }))
        .sort((x, y) => (references.length ? y.reference.rate - x.reference.rate : y.others.rate - x.others.rate) || x.deck.name.localeCompare(y.deck.name));
    lines.push("", references.length ? "DECK RANKINGS (average win rate against reference decks, then against your other decks)" : "DECK RANKINGS (average win rate against the other decks)");
    ranked.forEach((entry, i) => {
        const parts = [
            ...(references.length ? [`vs reference ${percent(entry.reference.rate).padStart(4)} [${percent(wilson(entry.reference.wins, entry.reference.games)[0])}-${percent(wilson(entry.reference.wins, entry.reference.games)[1])}]`] : []),
            ...(own.length > 1 ? [`vs yours ${percent(entry.others.rate).padStart(4)}`] : []),
        ];
        lines.push(`  ${String(i + 1).padStart(2)}. ${entry.deck.name.padEnd(width)}  ${parts.join("   ")}`);
    });
    if (references.length) {
        lines.push("", "REFERENCE DECKS (average win rate against your decks)");
        for (const entry of references) {
            const a = average(entry.index, (other) => !other.reference);
            lines.push(`      ${entry.deck.name.padEnd(width)}  ${percent(a.rate).padStart(4)}  (${a.wins}-${a.games - a.wins})`);
        }
    }
    const between = matchups.filter((matchup) => !decks[matchup.b].reference);
    const against = matchups.filter((matchup) => decks[matchup.b].reference);
    if (between.length) lines.push("", "MATCHUPS (wins-losses for the first deck, 95% interval)", ...between.map(line));
    if (against.length) lines.push("", "MATCHUPS AGAINST REFERENCE DECKS", ...against.map(line));

    const suspicious = against.filter((matchup) => {
        const r = record(matchup, jobs, matchup.a);
        return r.decided > 0 && r.wins / r.decided > 0.5;
    });
    if (suspicious.length && options.lists === "none") {
        lines.push(
            "",
            `CHECK: ${suspicious.length} matchup${suspicious.length === 1 ? "" : "s"} where a deck beats a reference deck. Reference decks are known to be strong,`,
            "so trace these games for engine or bot mistakes before trusting the result:",
        );
        for (const matchup of suspicious) {
            lines.push(line(matchup));
            const won = matchup.games.find((game) => game.winner !== undefined && jobs[game.id].decks[game.winner] === matchup.a);
            if (won) {
                const job = jobs[won.id];
                lines.push(`      npm run simulate -- --trace "${decks[job.decks[0]].name}|${decks[job.decks[1]].name}|${job.seed}" --nodes ${options.nodes} --samples ${options.samples}${options.reference ? "" : " --no-reference"}`);
            }
        }
    }

    if (options.cards)
        for (const { deck, index } of own) {
            lines.push("", `CARDS: ${deck.name} (games where the card was played or inked, and win rates with and without playing it)`);
            const games = matchups.flatMap((matchup) => (matchup.a === index || matchup.b === index ? matchup.games : [])).filter((game) => game.winner !== undefined);
            for (const entry of deck.cards) {
                let played = 0,
                    playedWins = 0,
                    inkedGames = 0,
                    wins = 0;
                for (const game of games) {
                    const seat = jobs[game.id].decks[0] === index ? 0 : 1;
                    const won = game.winner === seat;
                    if (won) wins++;
                    if (game.played[seat].includes(entry.fullName)) {
                        played++;
                        if (won) playedWins++;
                    }
                    if (game.inked[seat].includes(entry.fullName)) inkedGames++;
                }
                lines.push(
                    `  ${entry.count}x ${entry.fullName.padEnd(44)} played ${percent(played / games.length).padStart(4)}  inked ${percent(inkedGames / games.length).padStart(4)}` +
                        `  win rate ${percent(playedWins / played).padStart(4)} when played, ${percent((wins - playedWins) / (games.length - played)).padStart(4)} otherwise`,
                );
            }
        }

    const all = matchups.flatMap((matchup) => matchup.games);
    const errors = new Map<string, number>();
    for (const game of all) if (game.error) errors.set(game.error, (errors.get(game.error) ?? 0) + 1);
    const unfinished = all.filter((game) => game.reason === "Turn Limit").length;
    const decisions = all.reduce((sum, game) => sum + game.decisions, 0);
    const deciding = all.reduce((sum, game) => sum + game.deciding, 0);
    const worlds = all.reduce((sum, game) => sum + game.worlds, 0);
    const replayed = all.reduce((sum, game) => sum + game.replayed, 0);
    lines.push(
        "",
        `HEALTH: ${all.length} games, ${[...errors.values()].reduce((sum, count) => sum + count, 0)} errors, ${unfinished} reached ${options.maxTurns} turns, ` +
            `${(all.reduce((sum, game) => sum + game.turns, 0) / Math.max(1, all.length)).toFixed(1)} turns per game`,
    );
    for (const [error, count] of [...errors].sort((x, y) => y[1] - x[1]).slice(0, 10)) lines.push(`  ${count} x ${error}`);
    lines.push(
        `SPEED: ${(elapsed / 1000).toFixed(1)} s, ${((all.length * 1000) / elapsed).toFixed(2)} games/s, ${(deciding / Math.max(1, decisions)).toFixed(2)} ms per bot decision` +
            (worlds ? `, ${percent(replayed / worlds)} of searched worlds resumed the turn with its history` : ""),
    );
    console.log(lines.join("\n"));
    if (errors.size) process.exitCode = 1;
}

if (isMainThread)
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
else void serveJobs();
