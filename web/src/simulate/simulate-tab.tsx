import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Inks } from "../cards/card-view";
import type { Decks } from "../decks/use-decks";
import { DeckInput } from "../decks/deck-input";
import { summarizeDeck } from "../decks/library";
import { percent, planMatchups, type Deck, type GameResult, type Job, type Matchup } from "../simulator";
import { runPool, type JobWorker, type PoolRun } from "./pool";
import { reportMarkdown, summarize, type Rate, type Report } from "./report";
import { CopyButton } from "../copy-button";
import { defaultWorkers, simulationDecks } from "./setup";

interface Run {
    readonly decks: Deck[];
    readonly jobs: Job[];
    readonly matchups: Matchup[];
    readonly owner: number[];
    readonly started: number;
    readonly finished?: number;
    readonly cancelled?: boolean;
    readonly done: number;
}

const createWorker = (): JobWorker => new Worker(new URL("./sim-worker.js", import.meta.url), { type: "module" }) as unknown as JobWorker;

export function SimulateTab({ decks }: { decks: Decks }) {
    const botInputId = useId();
    // Undefined follows the first saved deck, including when browser storage loads.
    // An explicit choice or typed list is never replaced by a later storage refresh.
    const [source, setSource] = useState<string>();
    const [edited, setEdited] = useState<string>();
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
    const [againstReference, setAgainstReference] = useState(true);
    const [games, setGames] = useState(20);
    const [search, setSearch] = useState(true);
    const [workers, setWorkers] = useState(defaultWorkers);
    const [seed, setSeed] = useState(1);
    const [run, setRun] = useState<Run>();
    const [error, setError] = useState<string>();
    const pool = useRef<PoolRun>(undefined);
    const progressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const clearProgress = (): void => {
        clearTimeout(progressTimer.current);
        progressTimer.current = undefined;
    };
    useEffect(
        () => () => {
            clearProgress();
            pool.current?.cancel();
            pool.current = undefined;
        },
        [],
    );

    const usable = useMemo(() => new Set(decks.all.filter((deck) => deck.check.problems.length === 0).map((deck) => deck.id)), [decks.all]);
    const chosen = source === undefined ? decks.saved[0] : decks.all.find((deck) => deck.id === source);
    const primary = useMemo(
        () => summarizeDeck({ id: chosen?.id ?? "entered-deck", name: chosen?.name ?? "Entered deck", text: edited ?? chosen?.text ?? "", reference: false }),
        [chosen, edited],
    );
    const tested = useMemo(
        () => [
            ...(primary.text.trim() !== "" && primary.check.problems.length === 0 ? [primary] : []),
            ...decks.all.filter((deck) => deck.id !== primary.id && selected.has(deck.id) && usable.has(deck.id)),
        ],
        [primary, decks.all, selected, usable],
    );
    const plan = useMemo(() => {
        const list = simulationDecks(tested, againstReference ? decks.reference : []);
        return {
            decks: list,
            ...planMatchups(list, { games, policy: { nodes: search ? 200 : 0, samples: 1, randomness: 0 }, seed, lists: "none", maxTurns: 100 }),
        };
    }, [tested, againstReference, games, search, seed, decks.reference]);
    const running = run !== undefined && run.finished === undefined;

    const toggle = (id: string): void => {
        const next = new Set(selected);
        if (!next.delete(id)) next.add(id);
        setSelected(next);
    };
    const start = (): void => {
        const matchups = plan.matchups.map((matchup) => ({ ...matchup, games: [] as GameResult[] }));
        let done = 0;
        const started = performance.now();
        setError(undefined);
        setRun({ ...plan, matchups, started, done });
        const activePool = runPool(plan.decks, plan.jobs, workers, createWorker, (result) => {
            matchups[plan.owner[result.id]].games.push(result);
            done++;
            // Keep every result, but refresh the report at most four times a second.
            if (progressTimer.current === undefined) {
                progressTimer.current = setTimeout(() => {
                    progressTimer.current = undefined;
                    setRun((current) => current && { ...current, done });
                }, 250);
            }
        });
        pool.current = activePool;
        const finish = (): void => {
            clearProgress();
            setRun((current) => current && { ...current, done, finished: performance.now() });
        };
        activePool.done.then(
            () => {
                if (pool.current === activePool) finish();
            },
            (cause: unknown) => {
                if (pool.current !== activePool) return;
                setError(String(cause));
                finish();
            },
        );
    };
    const cancel = (): void => {
        pool.current?.cancel();
        setRun((current) => current && { ...current, cancelled: true });
    };

    const report = useMemo(() => (run && run.done > 0 ? summarize(run.decks, run.matchups, run.jobs) : undefined), [run]);
    const elapsed = run ? ((run.finished ?? performance.now()) - run.started) / 1000 : 0;
    return (
        <div>
            <h2 className="section-title">Simulate a deck</h2>
            <p className="text-body-secondary">Enter a deck list or choose a saved deck, then compare it against the reference decks.</p>
            <div className="card card-body mb-3">
                <label className="form-label" htmlFor="simulation-deck">
                    Choose a deck
                </label>
                <select
                    id="simulation-deck"
                    className="form-select mb-3"
                    value={chosen?.id ?? ""}
                    disabled={running}
                    onChange={(event) => {
                        setSource(event.target.value);
                        setEdited(undefined);
                    }}
                >
                    <option value="">Enter a new deck</option>
                    <optgroup label="Saved decks">
                        {decks.saved.map((deck) => (
                            <option key={deck.id} value={deck.id}>
                                {deck.name}
                            </option>
                        ))}
                    </optgroup>
                    <optgroup label="Reference decks">
                        {decks.reference.map((deck) => (
                            <option key={deck.id} value={deck.id}>
                                {deck.name}
                            </option>
                        ))}
                    </optgroup>
                </select>
                <DeckInput
                    text={primary.text}
                    check={primary.check}
                    disabled={running}
                    onChange={(text) => {
                        if (source === undefined) setSource(chosen?.id ?? "");
                        setEdited(text);
                    }}
                />
                {edited !== undefined && chosen && (
                    <p className="small text-body-secondary mb-0">Changes apply to this simulation only. The original deck is unchanged.</p>
                )}
                {decks.error && <div className="alert alert-warning small mb-0">{decks.error} You can still enter a deck above.</div>}
            </div>
            <details className="mb-3">
                <summary>Compare additional decks</summary>
                <div className="list-group scroll-list mt-2">
                    {decks.all
                        .filter((deck) => deck.id !== primary.id)
                        .map((deck) => (
                            <label
                                key={deck.id}
                                className={`list-group-item list-group-item-action deck-row ${usable.has(deck.id) ? "" : "text-body-secondary"}`}
                            >
                                <input
                                    className="form-check-input m-0"
                                    type="checkbox"
                                    checked={selected.has(deck.id)}
                                    disabled={!usable.has(deck.id) || running}
                                    onChange={() => toggle(deck.id)}
                                />
                                <Inks inks={deck.inks} />
                                <span className="name">{deck.name}</span>
                                {deck.reference && <span className="chip">Reference</span>}
                                {!usable.has(deck.id) && <span className="chip bad">Problems</span>}
                            </label>
                        ))}
                </div>
            </details>
            <div className="card card-body mb-3">
                <div className="form-check form-switch mb-1">
                    <input
                        id="against-reference"
                        className="form-check-input"
                        type="checkbox"
                        checked={againstReference}
                        disabled={running}
                        onChange={(event) => setAgainstReference(event.target.checked)}
                    />
                    <label htmlFor="against-reference" className="form-check-label">
                        Play against the reference decks
                    </label>
                </div>
                <p className="small text-body-secondary">Tested decks also play each other. Reference decks never play each other.</p>
                <div className="row g-2 mb-3">
                    <Field label="Games per matchup" value={games} min={1} disabled={running} onChange={setGames} />
                    <div className="col-6">
                        <label className="form-label" htmlFor={botInputId}>
                            Bots
                        </label>
                        <select
                            id={botInputId}
                            className="form-select"
                            value={search ? "search" : "fast"}
                            disabled={running}
                            onChange={(event) => setSearch(event.target.value === "search")}
                        >
                            <option value="search">Search (stronger)</option>
                            <option value="fast">No search (about 10× faster)</option>
                        </select>
                    </div>
                </div>
                <details className="mb-3">
                    <summary>Advanced settings</summary>
                    <div className="row g-2 mt-1">
                        <Field label="Workers" value={workers} min={1} disabled={running} onChange={setWorkers} />
                        <Field label="Seed" value={seed} min={0} disabled={running} onChange={setSeed} />
                    </div>
                </details>
                {running ? (
                    <button className="btn btn-outline-danger btn-lg w-100" onClick={cancel}>
                        Cancel
                    </button>
                ) : (
                    <button
                        className="btn btn-primary btn-lg w-100"
                        onClick={start}
                        disabled={!tested.length || !plan.jobs.length || (primary.text.trim() !== "" && primary.check.problems.length > 0)}
                    >
                        Run {plan.jobs.length} games
                    </button>
                )}
                <div className="small text-body-secondary text-center mt-2">
                    {plan.matchups.length} matchups × {games} games
                </div>
            </div>
            <div>
                {error && <div className="alert alert-danger">{error}</div>}
                {run && (
                    <>
                        <div className="progress mb-2" role="progressbar" aria-valuenow={run.done} aria-valuemax={run.jobs.length}>
                            <div className="progress-bar" style={{ width: `${(100 * run.done) / run.jobs.length}%` }} />
                        </div>
                        <div className="small text-body-secondary mb-3">
                            {run.done}/{run.jobs.length} games · {(run.done / Math.max(elapsed, 0.001)).toFixed(1)} games/s
                            {run.cancelled && " · cancelled"}
                        </div>
                    </>
                )}
                {report && (
                    <>
                        {!running && (
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h2 className="section-title mb-0">Simulation report{run?.cancelled ? " (cancelled)" : error ? " (incomplete)" : ""}</h2>
                                <CopyButton
                                    text={`${run?.cancelled ? "Simulation cancelled. Partial results follow.\n\n" : error ? "Simulation failed. Partial results follow.\n\n" : ""}${reportMarkdown(report)}`}
                                    label="Copy simulation report"
                                />
                            </div>
                        )}
                        <ReportView report={report} />
                    </>
                )}
                {!run && <p className="small text-body-secondary">Each matchup alternates who goes first. Your deck list stays in this browser.</p>}
            </div>
        </div>
    );
}

function Field(props: { label: string; value: number; min: number; disabled: boolean; onChange(value: number): void }) {
    const id = useId();
    return (
        <div className="col-6">
            <label className="form-label" htmlFor={id}>
                {props.label}
            </label>
            <input
                id={id}
                className="form-control"
                type="number"
                min={props.min}
                value={props.value}
                disabled={props.disabled}
                onChange={(event) => {
                    const value = Math.floor(Number(event.target.value));
                    if (Number.isFinite(value) && value >= props.min) props.onChange(value);
                }}
            />
        </div>
    );
}

const interval = (r: Rate | undefined): string => (r && r.games ? `${percent(r.rate)} [${percent(r.low)}–${percent(r.high)}]` : "–");

/** Win rates from red through gold to green, so a table reads at a glance. */
const rateColor = (r: Rate): string | undefined => (r.games ? `hsl(${Math.round(Math.max(0, Math.min(1, r.rate)) * 130)} 70% 65%)` : undefined);

/** A win rate on a 0–100% track: the band is the 95% interval, the line the rate, the tick 50%. */
function Meter({ rate }: { rate: Rate }) {
    return (
        <div className="meter" title={interval(rate)}>
            <div className="half" />
            <div className="range" style={{ left: `${100 * rate.low}%`, width: `${100 * (rate.high - rate.low)}%` }} />
            <div className="mark" style={{ left: `${100 * rate.rate}%` }} />
        </div>
    );
}

function RankStat({ label, rate }: { label: string; rate?: Rate }) {
    if (!rate || !rate.games) return null;
    return (
        <div className="stat">
            <span>{label}</span>
            <Meter rate={rate} />
            <span className="num" style={{ color: rateColor(rate) }}>
                {percent(rate.rate)}
            </span>
        </div>
    );
}

function ReportView({ report }: { report: Report }) {
    return (
        <>
            <div className="section-title">Deck rankings</div>
            <div className="list-group mb-3">
                {report.rankings.map((row, index) => (
                    <div key={row.name} className="list-group-item rank-row">
                        <span className="place">{index + 1}</span>
                        <span className="fw-semibold">{row.name}</span>
                        <RankStat label="vs reference" rate={row.vsReference} />
                        <RankStat label="vs tested" rate={row.vsOthers} />
                    </div>
                ))}
            </div>
            <div className="section-title">Matchups</div>
            <div className="card mb-3">
                <div className="table-responsive">
                    <table className="table table-sm small">
                        <thead>
                            <tr>
                                <th className="ps-3">Deck</th>
                                <th>Opponent</th>
                                <th>Won–lost</th>
                                <th>Win rate (95%)</th>
                                <th>On the play</th>
                                <th className="pe-3">On the draw</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.matchups.map((row) => (
                                <tr key={`${row.first}|${row.second}`}>
                                    <td className="ps-3">{row.first}</td>
                                    <td>{row.second}</td>
                                    <td>
                                        {row.record.wins}–{row.record.games - row.record.wins}
                                        {row.undecided > 0 && ` (${row.undecided} undecided)`}
                                    </td>
                                    <td className="rate-cell" style={{ color: rateColor(row.record) }}>
                                        {interval(row.record)}
                                    </td>
                                    <td>{row.play.games ? percent(row.play.rate) : "–"}</td>
                                    <td className="pe-3">{row.draw.games ? percent(row.draw.rate) : "–"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {report.references.length > 0 && (
                <>
                    <div className="section-title">Reference decks against the tested decks</div>
                    <div className="list-group mb-3">
                        {report.references.map((row) => (
                            <div key={row.name} className="list-group-item rank-row">
                                <span className="place">◆</span>
                                <span className="fw-semibold">{row.name}</span>
                                <RankStat label="win rate" rate={row.record} />
                            </div>
                        ))}
                    </div>
                </>
            )}
            <p className="small text-body-secondary">
                {report.games} games
                {report.unfinished > 0 && `, ${report.unfinished} stopped at 100 turns`}
                {report.errors.length > 0 && `, ${report.errors.reduce((sum, error) => sum + error.count, 0)} failed`}.
            </p>
            {report.errors.length > 0 && (
                <ul className="small text-danger">
                    {report.errors.map((error) => (
                        <li key={error.message}>
                            {error.count}× {error.message}
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}
