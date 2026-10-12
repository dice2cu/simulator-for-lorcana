/**
 * Bot comparison in same-deck games, to judge decision quality separately from
 * deck strength. Each deck plays itself with settings A in one seat and settings
 * B in the other, alternating who goes first.
 *
 *   npm run compare-bots -- --a nodes=200,samples=1 --b nodes=0 --games 20
 *   npm run compare-bots -- decks/a.deck --a nodes=400,samples=2 --b nodes=200,samples=1
 *
 * Options:
 *   --a SETTINGS, --b SETTINGS   nodes=N,samples=N,randomness=R and evaluation tuning such as exposure=0.5
 *                                (defaults nodes=200,samples=1 against nodes=0)
 *   --games N                    games per deck (default 20, rounded up to an even number)
 *   --workers N                  worker threads (default: half the logical CPUs)
 *   --lists MODE                 none (default) or confirmed
 *   --max-turns N                turns before a game counts as unfinished (default 100)
 *   --seed N                     base seed (default 1)
 * Decks default to reference-decks.
 */
import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";
import { defaultTuning } from "../bot/evaluate.js";
import { deckFiles, defaultWorkers, loadDeck, percent, progressBar, runJobs, serveJobs, wilson, type Deck, type Job, type Policy } from "./simulation/games.mjs";

function policy(text: string): Policy {
    const values = new Map(text.split(",").map((part) => part.split("=") as [string, string]));
    const tuning: Record<string, number> = {};
    for (const [key, value] of values) {
        if (key in defaultTuning) tuning[key] = Number(value);
        else if (!["nodes", "samples", "randomness"].includes(key)) throw new Error(`Unknown setting ${key}`);
    }
    return {
        nodes: Number(values.get("nodes") ?? 200),
        samples: Number(values.get("samples") ?? 1),
        randomness: Number(values.get("randomness") ?? 0),
        ...(Object.keys(tuning).length ? { tuning } : {}),
    };
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    const inputs: string[] = [];
    let a = policy("nodes=200,samples=1"),
        b = policy("nodes=0"),
        games = 20,
        workers = defaultWorkers(),
        maxTurns = 100,
        seed = 1,
        lists: "none" | "confirmed" = "none";
    for (let i = 0; i < argv.length; i++) {
        const value = () => argv[++i] ?? "";
        switch (argv[i]) {
            case "--a": a = policy(value()); break;
            case "--b": b = policy(value()); break;
            case "--games": games = Math.ceil(Number(value()) / 2) * 2; break;
            case "--workers": workers = Math.max(1, Number(value())); break;
            case "--max-turns": maxTurns = Number(value()); break;
            case "--seed": seed = Number(value()); break;
            case "--lists": lists = value() === "confirmed" ? "confirmed" : "none"; break;
            default:
                if (argv[i].startsWith("--")) throw new Error(`Unknown option ${argv[i]}`);
                inputs.push(argv[i]);
        }
    }
    const decks: Deck[] = deckFiles(inputs.length ? inputs : ["reference-decks"]).flatMap((file) => {
        const loaded = loadDeck(file, false);
        if ("problem" in loaded) {
            console.warn(`Skipping ${file}: ${loaded.problem}`);
            return [];
        }
        return [loaded];
    });
    const jobs: Job[] = [];
    decks.forEach((_, deck) => {
        for (let game = 0; game < games; game++) {
            // Pairs of games share a seed, so A and B each get the same shuffles from both seats.
            const policies: [Policy, Policy] = game % 2 ? [b, a] : [a, b];
            jobs.push({ id: jobs.length, decks: [deck, deck], policies, seed: seed * 1_000_003 + deck * 10_007 + Math.floor(game / 2), lists, maxTurns });
        }
    });
    console.log(`A: ${JSON.stringify(a)}  B: ${JSON.stringify(b)}  ${decks.length} decks x ${games} games, opponent lists: ${lists}.`);
    const started = performance.now();
    const results = await runJobs(fileURLToPath(import.meta.url), decks, jobs, workers, progressBar(jobs.length));
    const elapsed = performance.now() - started;
    let wins = 0,
        decided = 0;
    const width = Math.max(...decks.map((deck) => deck.name.length));
    for (const [index, deck] of decks.entries()) {
        let deckWins = 0,
            deckDecided = 0;
        for (const result of results) {
            if (jobs[result.id].decks[0] !== index || result.winner === undefined) continue;
            const seatOfA = jobs[result.id].policies[0] === a ? 0 : 1;
            deckDecided++;
            if (result.winner === seatOfA) deckWins++;
        }
        wins += deckWins;
        decided += deckDecided;
        const [low, high] = wilson(deckWins, deckDecided);
        console.log(`  ${deck.name.padEnd(width)}  A wins ${String(deckWins).padStart(3)}/${String(deckDecided).padEnd(3)} ${percent(deckWins / deckDecided).padStart(4)} [${percent(low)}-${percent(high)}]`);
    }
    // Both seats decide in every game, so decision time covers both settings together.
    const deciding = results.reduce((sum, result) => sum + result.deciding, 0);
    const decisions = results.reduce((sum, result) => sum + result.decisions, 0);
    const [low, high] = wilson(wins, decided);
    const errors = results.filter((result) => result.error);
    console.log(`\nA wins ${wins}/${decided} = ${percent(wins / decided, 1)} [95% ${percent(low, 1)}-${percent(high, 1)}], ${results.length - decided} games without a winner, ${errors.length} errors.`);
    for (const error of errors.slice(0, 5)) console.log(`  error: ${error.error}`);
    console.log(`${(elapsed / 1000).toFixed(1)} s, ${((results.length * 1000) / elapsed).toFixed(2)} games/s, ${(deciding / Math.max(1, decisions)).toFixed(2)} ms per decision.`);
    if (errors.length) process.exitCode = 1;
}

if (isMainThread)
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
else void serveJobs();
