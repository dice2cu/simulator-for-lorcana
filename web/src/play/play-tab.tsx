import { useEffect, useRef, useState } from "react";
import { Inks } from "../cards/card-view";
import type { DeckSummary } from "../decks/library";
import type { Decks } from "../decks/use-decks";
import {
    getCard,
    type CardIdentifier,
    type GameOutcomeRecord,
    type GameStateView,
    type PlayerAnswer,
    type PlayerNumber,
    type PlayerRequest,
    type PlayerUpdate,
} from "../simulator";
import { Board } from "./board";
import { InstanceCard } from "./card-instance";
import { Decision } from "./decision";
import { observationText } from "./describe";
import type { GameCommand, GameMessage, GameSetup } from "./protocol";

interface Options {
    readonly you?: string;
    readonly opponent?: string;
    readonly mode: "Bot" | "Both";
    readonly first: "You" | "Opponent" | "Random";
    readonly search: boolean;
    readonly botDelay: number;
}

interface Game {
    readonly setup: GameSetup;
    /** Each human seat's latest view and log. */
    readonly views: Partial<Record<PlayerNumber, GameStateView>>;
    readonly logs: Partial<Record<PlayerNumber, string[]>>;
    readonly characteristics: Partial<Record<PlayerNumber, PlayerUpdate["characteristics"]>>;
    readonly request?: { player: PlayerNumber; state: GameStateView; request: PlayerRequest; error?: string };
    /** The seat shown when no request is waiting. */
    readonly viewer: PlayerNumber;
    readonly outcome?: GameOutcomeRecord;
    readonly error?: string;
    readonly ended: boolean;
}

export function PlayTab({ decks }: { decks: Decks }) {
    const usable = decks.all.filter((deck) => deck.check.problems.length === 0);
    const [options, setOptions] = useState<Options>({ mode: "Bot", first: "Random", search: true, botDelay: 500 });
    const [game, setGame] = useState<Game>();
    const [focus, setFocus] = useState<CardIdentifier>();
    const worker = useRef<Worker>(undefined);
    useEffect(() => () => worker.current?.terminate(), []);

    const you = usable.find((deck) => deck.id === options.you) ?? usable[0];
    const opponent = usable.find((deck) => deck.id === options.opponent) ?? usable[1] ?? usable[0];

    const start = (): void => {
        if (!you || !opponent) return;
        const seed = Math.floor(Math.random() * 1_000_000_000);
        const first: PlayerNumber = options.first === "You" ? 1 : options.first === "Opponent" ? 2 : seed % 2 ? 1 : 2;
        const seat = (deck: DeckSummary, controller: "Human" | "Bot") => ({ name: deck.name, deck: deck.check.cards, controller });
        const setup: GameSetup = {
            seats: [seat(you, "Human"), seat(opponent, options.mode === "Bot" ? "Bot" : "Human")],
            first,
            seed,
            nodes: options.search ? 200 : 0,
            botDelay: options.botDelay,
        };
        worker.current?.terminate();
        const created = new Worker(new URL("./game-worker.js", import.meta.url), { type: "module" });
        worker.current = created;
        setFocus(undefined);
        setGame({ setup, views: {}, logs: {}, characteristics: {}, viewer: 1, ended: false });
        created.onmessage = ({ data }: MessageEvent<GameMessage>) => setGame((current) => current && receive(current, data));
        created.onerror = (event) => setGame((current) => current && { ...current, ended: true, error: event.message || "The game stopped unexpectedly" });
        created.postMessage({ type: "start", setup } satisfies GameCommand);
    };
    const answer = (value: PlayerAnswer): void => {
        worker.current?.postMessage({ type: "answer", answer: value } satisfies GameCommand);
        setFocus(undefined);
        setGame((current) => current && { ...current, request: undefined });
    };
    const quit = (): void => {
        if (game && !game.ended && !confirm("Abandon this game?")) return;
        worker.current?.terminate();
        worker.current = undefined;
        setGame(undefined);
    };

    if (!game)
        return (
            <div className="card card-body">
                <h2 className="section-title">Play a game</h2>
                <p className="text-body-secondary">Choose your deck and opponent. During the game, select a card to inspect it or use the action buttons.</p>
                <div className="versus mb-3">
                    <DeckSelect label="Your deck" decks={usable} value={you?.id} onChange={(id) => setOptions({ ...options, you: id })} />
                    <span className="vs">vs</span>
                    <DeckSelect label="Opponent" decks={usable} value={opponent?.id} onChange={(id) => setOptions({ ...options, opponent: id })} />
                </div>
                <div className="row g-2 mb-3">
                    <div className="col-6">
                        <label className="form-label">Opponent plays</label>
                        <select
                            className="form-select"
                            value={options.mode}
                            onChange={(event) => setOptions({ ...options, mode: event.target.value as Options["mode"] })}
                        >
                            <option value="Bot">As a bot</option>
                            <option value="Both">I play both</option>
                        </select>
                    </div>
                    <div className="col-6">
                        <label className="form-label">Goes first</label>
                        <select
                            className="form-select"
                            value={options.first}
                            onChange={(event) => setOptions({ ...options, first: event.target.value as Options["first"] })}
                        >
                            <option value="Random">Random</option>
                            <option value="You">You</option>
                            <option value="Opponent">Opponent</option>
                        </select>
                    </div>
                    {options.mode === "Bot" && (
                        <>
                            <div className="col-6">
                                <label className="form-label">Bot strength</label>
                                <select
                                    className="form-select"
                                    value={options.search ? "search" : "fast"}
                                    onChange={(event) => setOptions({ ...options, search: event.target.value === "search" })}
                                >
                                    <option value="search">Stronger</option>
                                    <option value="fast">Weaker</option>
                                </select>
                            </div>
                            <div className="col-6">
                                <label className="form-label">Bot speed</label>
                                <select
                                    className="form-select"
                                    value={options.botDelay}
                                    onChange={(event) => setOptions({ ...options, botDelay: Number(event.target.value) })}
                                >
                                    <option value={0}>Instant</option>
                                    <option value={500}>Normal</option>
                                    <option value={1500}>Slow</option>
                                </select>
                            </div>
                        </>
                    )}
                </div>
                <button className="btn btn-primary btn-lg w-100" disabled={!you || !opponent} onClick={start}>
                    Start game
                </button>
                {usable.length === 0 && <p className="small text-danger mt-2 mb-0">No playable decks.</p>}
            </div>
        );

    const viewer = game.request?.player ?? game.viewer;
    const view = game.request?.state ?? game.views[viewer];
    const names = { 1: game.setup.seats[0].name, 2: game.setup.seats[1].name };
    const log = game.logs[viewer] ?? [];
    const shown = focus && getCard(focus.fullName);
    const cardActions = game.request?.request.type === "Action" && !game.request.request.actions.every((option) => option.action.type === "Alter Hand");
    return (
        <>
            <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                <span className="small text-body-secondary text-truncate">
                    {names[1]} <span className="text-warning-emphasis fst-italic">vs</span> {names[2]} · seed {game.setup.seed}
                </span>
                <button className="btn btn-sm btn-outline-secondary" onClick={quit}>
                    {game.ended ? "New game" : "Quit"}
                </button>
            </div>
            {view ? (
                <>
                    <p className="small text-body-secondary mb-2">Select a card for its full rules and available actions.</p>
                    <Board
                        view={view}
                        characteristics={game.characteristics[viewer]}
                        viewer={viewer}
                        names={names}
                        focus={focus}
                        onFocus={(card) => setFocus(focus && focus.fullName === card.fullName && focus.i === card.i ? undefined : card)}
                    />
                </>
            ) : null}
            <div className="decision-panel">
                {game.ended ? (
                    <Ending game={game} />
                ) : game.request ? (
                    <>
                        {game.setup.seats.every((seat) => seat.controller === "Human") && (
                            <div className="chip gold mb-2">{game.setup.seats[game.request.player - 1]?.name} decides</div>
                        )}
                        {game.request.error && <div className="alert alert-danger py-1 small">{game.request.error}</div>}
                        <Decision request={game.request.request} view={view} characteristics={game.characteristics[viewer]} onAnswer={answer} />
                    </>
                ) : (
                    <div className="thinking">
                        <span className="spinner-grow" aria-hidden />
                        {view ? "The opponent is thinking…" : "Shuffling up…"}
                    </div>
                )}
            </div>
            <details className="zone-details">
                <summary>Game log</summary>
                <div className="card card-body game-log">
                    {log.length === 0 && <span className="text-body-secondary small">Nothing has happened yet.</span>}
                    {log.map((line, index) => (
                        <div key={index} className={line.startsWith("— ") ? "turn" : / wins by /.test(line) ? "win" : undefined}>
                            {line.startsWith("— ") ? line.slice(2, -2) : line}
                        </div>
                    ))}
                </div>
            </details>
            {focus && shown && (
                <div className="card-sheet-backdrop" onClick={() => setFocus(undefined)}>
                    <div className="card-sheet" onClick={(event) => event.stopPropagation()}>
                        <InstanceCard card={focus} view={view} characteristics={game.characteristics[viewer]} full />
                        {cardActions && game.request && (
                            <div className="mt-3">
                                <Decision
                                    request={game.request.request}
                                    view={view}
                                    characteristics={game.characteristics[viewer]}
                                    focus={focus}
                                    onAnswer={answer}
                                />
                            </div>
                        )}
                        <button className="btn btn-outline-secondary w-100 mt-3" onClick={() => setFocus(undefined)}>
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

/** Applies one worker message to the page's copy of the game. */
function receive(game: Game, message: GameMessage): Game {
    switch (message.type) {
        case "update": {
            const lines = message.update.observations.flatMap((observation) => observationText(observation, message.player) ?? []);
            const turn = game.views[message.player]?.turn;
            const next = message.update.state.turn;
            const heading =
                turn && (turn.number !== next.number || turn.player !== next.player)
                    ? [`— Turn ${next.number} · ${game.setup.seats[next.player - 1].name} —`]
                    : [];
            const ending = message.update.outcome?.winners.length
                ? [`Player ${message.update.outcome.winners.join(" and ")} wins by ${message.update.outcome.reason.toLowerCase()}`]
                : [];
            return {
                ...game,
                views: { ...game.views, [message.player]: message.update.state },
                characteristics: { ...game.characteristics, [message.player]: message.update.characteristics },
                logs: { ...game.logs, [message.player]: [...(game.logs[message.player] ?? []), ...lines, ...heading, ...ending].slice(-500) },
            };
        }
        case "request":
            return {
                ...game,
                request: { player: message.player, state: message.state, request: message.request, ...(message.error ? { error: message.error } : {}) },
                viewer: message.player,
            };
        case "end":
            return {
                ...game,
                ended: true,
                request: undefined,
                ...(message.outcome ? { outcome: message.outcome } : {}),
                ...(message.error ? { error: message.error } : {}),
            };
    }
}

function Ending({ game }: { game: Game }) {
    if (game.error) return <div className="text-danger">The game stopped: {game.error}</div>;
    const winners = game.outcome?.winners ?? [];
    if (!winners.length)
        return (
            <div className="result-banner lost">
                <div className="headline">Draw</div>
                <div className="small text-body-secondary">The game ended without a winner.</div>
            </div>
        );
    const name = (player: PlayerNumber): string => game.setup.seats[player - 1].name;
    // Against a bot, the result is told from the human's side.
    const bot = game.setup.seats[1].controller === "Bot";
    const won = !bot || winners.includes(1);
    return (
        <div className={`result-banner ${won ? "" : "lost"}`}>
            <div className="headline">{bot ? (won ? "Victory" : "Defeat") : `${winners.map(name).join(" and ")} wins`}</div>
            <div className="small text-body-secondary">
                {winners.map(name).join(" and ")} won by {game.outcome!.reason === "Lore" ? "reaching 20 lore" : "the opponent running out of cards"}.
            </div>
        </div>
    );
}

function DeckSelect(props: { label: string; decks: readonly DeckSummary[]; value?: string; onChange(id: string): void }) {
    const chosen = props.decks.find((deck) => deck.id === props.value);
    return (
        <div className="seat">
            <label className="form-label">{props.label}</label>
            <select className="form-select" value={props.value} onChange={(event) => props.onChange(event.target.value)}>
                {props.decks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                        {deck.name}
                        {deck.reference ? " (reference)" : ""}
                    </option>
                ))}
            </select>
            {chosen && <Inks inks={chosen.inks} />}
        </div>
    );
}
