// Node edge for simulations: deck files, reproducible games and a worker-thread pool.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { availableParallelism } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { parseDeckList } from "../../deck.js";
import { runGame, type Deck, type GameResult, type Job } from "../../simulation.js";

export * from "../../simulation.js";

const EXTENSIONS = new Set([".deck", ".txt"]);

/** Deck files from files or folders. Folders are read one level deep, in name order. */
export function deckFiles(inputs: readonly string[]): string[] {
    return inputs.flatMap((input) => {
        if (!existsSync(input)) throw new Error(`Not found: ${input}`);
        if (!statSync(input).isDirectory()) return [input];
        return readdirSync(input)
            .filter((name) => EXTENSIONS.has(extname(name).toLowerCase()))
            .sort()
            .map((name) => join(input, name));
    });
}

/** Reads a deck file. Unreadable lines, unknown cards or a short list make the deck unusable, reported as a warning. */
export function loadDeck(file: string, reference: boolean): Deck | { file: string; problem: string } {
    const { cards, problems } = parseDeckList(readFileSync(file, "utf8"));
    if (problems.length) return { file, problem: problems.join("; ") };
    const size = cards.reduce((sum, entry) => sum + entry.count, 0);
    if (size < 60) return { file, problem: `only ${size} cards` };
    return { name: basename(file, extname(file)), cards, reference };
}

// Hyperthreads add little to search-bound games, so default to one worker per physical core.
export const defaultWorkers = (): number => Math.max(1, Math.floor(availableParallelism() / 2));

/**
 * Runs jobs on worker threads that load this same bundle. Results arrive in
 * completion order. With one worker or fewer jobs, games run on this thread.
 */
export async function runJobs(script: string, decks: readonly Deck[], jobs: readonly Job[], workers: number, progress: (result: GameResult) => void): Promise<GameResult[]> {
    const results: GameResult[] = [];
    if (workers <= 1 || jobs.length <= 1) {
        for (const job of jobs) {
            const result = runGame(decks, job);
            results.push(result);
            progress(result);
        }
        return results;
    }
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.min(workers, jobs.length) }, () =>
            new Promise<void>((done, fail) => {
                const worker = new Worker(resolve(script), { workerData: { decks } });
                const dispatch = (): void => {
                    if (next >= jobs.length) {
                        void worker.terminate().then(() => done());
                        return;
                    }
                    worker.postMessage(jobs[next++]);
                };
                worker.on("message", (result: GameResult) => {
                    results.push(result);
                    progress(result);
                    dispatch();
                });
                worker.on("error", fail);
                dispatch();
            }),
        ),
    );
    return results;
}

/** Draws a progress line on stderr, so reports on stdout stay clean. */
export function progressBar(total: number): (result: GameResult) => void {
    let done = 0;
    const started = performance.now();
    return () => {
        done++;
        if (!process.stderr.isTTY && done !== total) return;
        const width = 30,
            filled = Math.round((width * done) / total);
        const rate = done / Math.max(0.001, (performance.now() - started) / 1000);
        process.stderr.write(`\r  [${"#".repeat(filled)}${".".repeat(width - filled)}] ${done}/${total} games  ${rate.toFixed(1)} games/s  `);
        if (done === total) process.stderr.write("\n");
    };
}

/** Worker-thread side of runJobs: plays each posted job and replies with its result. */
export async function serveJobs(): Promise<void> {
    const { parentPort, workerData } = await import("node:worker_threads");
    const decks = (workerData as { decks: Deck[] }).decks;
    parentPort!.on("message", (job: Job) => parentPort!.postMessage(runGame(decks, job)));
}
