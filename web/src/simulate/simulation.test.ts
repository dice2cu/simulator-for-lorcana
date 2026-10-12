import { describe, expect, it, vi } from "vitest";
import { referenceDecks } from "../../../src/tests/fixtures/reference-decks";
import { planMatchups, runGame, type Deck, type GameResult } from "../simulator";
import type { DeckEntry } from "../decks/library";
import { runPool, type JobWorker, type WorkerInput } from "./pool";
import { summarize } from "./report";
import { simulationDecks } from "./setup";

const entry = (name: string, reference: boolean): DeckEntry => {
    const deck = referenceDecks.find((candidate) => candidate.name === name)!;
    return { id: `${reference ? "reference" : "mine"}:${name}`, name, text: deck.cards.map((card) => `${card.count} ${card.fullName}`).join("\n"), reference };
};

/** A worker that plays jobs on this thread, like sim-worker.ts does in the browser. */
function localWorker(): JobWorker {
    let decks: readonly Deck[] = [];
    const worker: JobWorker = {
        onmessage: null,
        onerror: null,
        postMessage: (message: WorkerInput) => {
            if (message.type === "decks") decks = message.decks;
            else queueMicrotask(() => worker.onmessage?.({ data: runGame(decks, message.job) }));
        },
        terminate: () => (worker.onmessage = null),
    };
    return worker;
}

describe("simulations in the page", () => {
    it.each(["create", "decks", "job", "next job", "result", "worker error"])("cleans up and rejects when %s fails", async (stage) => {
        const decks = simulationDecks([entry("Amber-Steel-Aggro", false)], [entry("Ruby-Sapphire-Pawpsicle", true)]);
        const { jobs } = planMatchups(decks, { games: 6, policy: { nodes: 0, samples: 1, randomness: 0 }, seed: 1, lists: "none", maxTurns: 100 });
        const failure = new Error("Worker failed");
        const created: JobWorker[] = [];
        let postedJobs = 0;
        const create = (): JobWorker => {
            if (stage === "create" && created.length === 1) throw failure;
            const worker: JobWorker = {
                onmessage: null,
                onerror: null,
                terminate: vi.fn(),
                postMessage: (message) => {
                    if (message.type === "job") postedJobs++;
                    if (stage === message.type || (stage === "next job" && postedJobs === 3)) throw failure;
                },
            };
            created.push(worker);
            return worker;
        };
        const onResult = vi.fn(() => {
            if (stage === "result") throw failure;
        });
        const run = runPool(decks, jobs, 2, create, onResult);
        const rejected = expect(run.done).rejects.toThrow("Worker failed");
        const worker = created[0];
        if (!worker) throw new Error("No worker created");
        const result: GameResult = {
            id: 0,
            winner: 0,
            reason: "Lore",
            turns: 10,
            lore: [20, 5],
            decisions: 0,
            deciding: 0,
            worlds: 0,
            replayed: 0,
            played: [[], []],
            inked: [[], []],
        };
        if (stage === "worker error") worker.onerror?.({ message: failure.message });
        else if (stage === "next job" || stage === "result") worker.onmessage?.({ data: result });
        await rejected;
        for (const instance of created) expect(instance.terminate).toHaveBeenCalledTimes(1);
        const calls = onResult.mock.calls.length;
        worker.onmessage?.({ data: { ...result, id: 1 } });
        run.cancel();
        expect(onResult).toHaveBeenCalledTimes(calls);
        for (const instance of created) expect(instance.terminate).toHaveBeenCalledTimes(1);
    });

    it("tests chosen decks against the other reference decks, with unique names", () => {
        const decks = simulationDecks(
            [entry("Amber-Steel-Aggro", true), { ...entry("Amber-Steel-Aggro", false), id: "mine:copy" }],
            [entry("Amber-Steel-Aggro", true), entry("Ruby-Sapphire-Pawpsicle", true)],
        );
        expect(decks.map((deck) => [deck.name, deck.reference])).toEqual([
            ["Amber-Steel-Aggro", false],
            ["Amber-Steel-Aggro (2)", false],
            ["Ruby-Sapphire-Pawpsicle", true],
        ]);
    });

    it("plays every job once and gives the same results as playing them directly", async () => {
        const decks = simulationDecks([entry("Amber-Steel-Aggro", false)], [entry("Ruby-Sapphire-Pawpsicle", true), entry("Emerald-Steel-Discard", true)]);
        const plan = planMatchups(decks, { games: 2, policy: { nodes: 0, samples: 1, randomness: 0 }, seed: 3, lists: "none", maxTurns: 100 });
        const seen: number[] = [];
        const results = await runPool(decks, plan.jobs, 3, localWorker, (result) => seen.push(result.id)).done;
        expect([...seen].sort()).toEqual(plan.jobs.map((job) => job.id));
        const direct = plan.jobs.map((job) => runGame(decks, job));
        const strip = ({ deciding: _, ...rest }: GameResult) => rest;
        expect([...results].sort((a, b) => a.id - b.id).map(strip)).toEqual(direct.map(strip));

        for (const result of results) plan.matchups[plan.owner[result.id]].games.push(result);
        const report = summarize(decks, plan.matchups, plan.jobs);
        expect(report.games).toBe(4);
        expect(report.rankings.map((row) => row.name)).toEqual(["Amber-Steel-Aggro"]);
        expect(report.matchups.map((row) => row.record.games + row.undecided)).toEqual([2, 2]);
        expect(report.errors).toEqual([]);
    }, 60000);

    it("stops handing out jobs when cancelled", async () => {
        const decks = simulationDecks([entry("Amber-Steel-Aggro", false)], [entry("Ruby-Sapphire-Pawpsicle", true)]);
        const plan = planMatchups(decks, { games: 6, policy: { nodes: 0, samples: 1, randomness: 0 }, seed: 1, lists: "none", maxTurns: 100 });
        let run: ReturnType<typeof runPool> | undefined = undefined;
        run = runPool(decks, plan.jobs, 1, localWorker, () => run?.cancel());
        expect((await run.done).length).toBe(1);
    }, 60000);
});
