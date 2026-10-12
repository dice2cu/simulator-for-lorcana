import type { Deck, GameResult, Job } from "../simulator";

/** Messages to a simulation worker: the decks once, then one job at a time. */
export type WorkerInput = { type: "decks"; decks: readonly Deck[] } | { type: "job"; job: Job };

/** The part of a Web Worker the pool uses, so tests can supply their own. */
export interface JobWorker {
    postMessage(message: WorkerInput): void;
    onmessage: ((event: { data: GameResult }) => void) | null;
    onerror: ((event: { message?: string }) => void) | null;
    terminate(): void;
}

export interface PoolRun {
    /** All results in completion order, or the finished ones after cancel. */
    readonly done: Promise<GameResult[]>;
    cancel(): void;
}

/** Plays jobs on up to `workers` workers, handing each idle worker the next job. */
export function runPool(
    decks: readonly Deck[],
    jobs: readonly Job[],
    workers: number,
    create: () => JobWorker,
    onResult: (result: GameResult) => void,
): PoolRun {
    const results: GameResult[] = [];
    const running: JobWorker[] = [];
    let next = 0;
    let stopped = false;
    let finish!: (results: GameResult[]) => void;
    let fail!: (error: Error) => void;
    const done = new Promise<GameResult[]>((resolve, reject) => {
        finish = resolve;
        fail = reject;
    });
    const stop = (): void => {
        stopped = true;
        for (const worker of running.splice(0)) worker.terminate();
    };
    const reject = (cause: unknown): void => {
        if (stopped) return;
        stop();
        fail(cause instanceof Error ? cause : new Error(String(cause)));
    };
    const dispatch = (worker: JobWorker): void => {
        if (!stopped && next < jobs.length) worker.postMessage({ type: "job", job: jobs[next++] });
    };
    if (!jobs.length) finish([]);
    try {
        for (let i = 0; !stopped && i < Math.min(Math.max(1, workers), jobs.length); i++) {
            const worker = create();
            running.push(worker);
            worker.onmessage = ({ data }) => {
                if (stopped) return;
                try {
                    results.push(data);
                    onResult(data);
                    if (results.length === jobs.length) {
                        stop();
                        finish(results);
                    } else dispatch(worker);
                } catch (cause) {
                    reject(cause);
                }
            };
            worker.onerror = (event) => {
                reject(new Error(event.message ?? "A simulation worker failed"));
            };
            worker.postMessage({ type: "decks", decks });
            dispatch(worker);
        }
    } catch (cause) {
        reject(cause);
    }
    return {
        done,
        cancel: () => {
            stop();
            finish(results);
        },
    };
}
