import type { GameState, PlayerPosition } from "../model/game-state";
import type { GameStateView } from "../model/game-state-view";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { DeckListEntry, PlayerAnswer, PlayerController, PlayerObservation, PlayerRequest, PlayerUpdate } from "../model/player-interaction";
import type { RandomOutcome, Turn, TurnStep } from "../model/turn";
import type { TurnStepView } from "../model/turn-view";
import { startGame, startTurn } from "../engine/engine";
import { InvalidInput } from "../engine/invalid-input";
import type { Resolution } from "../engine/resolution";
import type { EngineOptions } from "../engine/rules";
import { Rules } from "../engine/rules";
import { cardKey, placements, samePlacement } from "./locations";
import { observe, viewStep, type StepRecord } from "./observations";
import { projectCharacteristics, projectState, sight, type Glimpse, type Sight } from "./projection";
import { SeededRandom } from "./random";
import { describeAction, hiddenIdentities, projectRequest } from "./requests";

/** One controller per seat per game, constructed by the caller from PlayerSetup. */
export interface Seat {
    readonly player: PlayerNumber;
    readonly deck: readonly DeckListEntry[];
    readonly controller: PlayerController;
}

export interface RunnerOptions {
    /** Actual game randomness: identifiers, shuffles and random selections. */
    readonly seed: number;
    /** Takes the first turn. Defaults to the first seat. */
    readonly first?: PlayerNumber;
    /** Fails rather than continuing forever. Defaults to 200 turns. */
    readonly maxTurns?: number;
    /**
     * Starts from this position at the beginning of its current turn instead of
     * setting up a new game, such as a saved game or a test scenario. Every
     * controller first receives its view of the position. seed then only affects
     * random outcomes and request handles.
     */
    readonly from?: GameState;
    /** Stops after this many turns and returns a record without an outcome, unless the game ends first. */
    readonly turns?: number;
    /** Ask again after an invalid answer, as an interactive UI needs. Simulations fail fast by default. */
    readonly retry?: boolean;
    readonly engine?: EngineOptions;
    /** Fails if a projected request contains an identity its recipient cannot see. For tests. */
    readonly audit?: boolean;
    /** Include effective public board stats in updates for a UI. Simulations can omit this work. */
    readonly characteristics?: boolean;
    /**
     * Called after each update is delivered, with the authoritative position. For
     * tests and reports only. Never forward that position to a controller.
     */
    readonly trace?: (player: PlayerNumber, update: PlayerUpdate, position: GameState) => void;
}

export interface GameOutcomeRecord {
    readonly winners: readonly PlayerNumber[];
    readonly eliminated: readonly PlayerNumber[];
    readonly reason: "Lore" | "Empty Deck";
}

/** Authoritative history for reports and replay. Never given to controllers. */
export interface GameRecord {
    readonly initial: GameState;
    readonly setup: Turn;
    readonly turns: readonly { readonly start: GameState; readonly turn: Turn }[];
    readonly final: GameState;
    readonly outcome?: GameOutcomeRecord;
}

/** Raised when an engine decision needs more than one controller to agree. */
export class UnsupportedInteraction extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UnsupportedInteraction";
    }
}

type Call =
    { type: "observe"; seat: Seat; update: PlayerUpdate } | { type: "decide"; seat: Seat; state: GameStateView; request: PlayerRequest; error?: string };

/** Runs a complete game with synchronous controllers, without promise overhead. */
export function playGame(seats: readonly Seat[], options: RunnerOptions): GameRecord {
    const run = game(seats, options);
    let input: unknown;
    for (;;) {
        const next = run.next(input);
        if (next.done) return next.value;
        const call = next.value;
        input = call.type === "observe" ? call.seat.controller.observe(call.update) : call.seat.controller.decide(call.state, call.request, call.error);
        if (input && typeof (input as Promise<unknown>).then === "function")
            throw new Error(`Player ${call.seat.player} returned a promise to the synchronous runner`);
    }
}

/** Runs a complete game, awaiting controllers that answer asynchronously. */
export async function playGameAsync(seats: readonly Seat[], options: RunnerOptions): Promise<GameRecord> {
    const run = game(seats, options);
    let input: unknown;
    for (;;) {
        const next = run.next(input);
        if (next.done) return next.value;
        const call = next.value;
        input = await (call.type === "observe" ? call.seat.controller.observe(call.update) : call.seat.controller.decide(call.state, call.request, call.error));
    }
}

/**
 * Assigns physical identifiers from a shuffled pool, so numbers are independent of
 * names and deck-list order. Decks start in list order and setup shuffles them.
 */
export function initialState(seats: readonly Seat[], first: PlayerNumber, random: SeededRandom): GameState {
    const total = seats.reduce((sum, seat) => sum + seat.deck.reduce((count, entry) => count + entry.count, 0), 0);
    const pool = random.shuffle(Array.from({ length: total }, (_, i) => i + 1));
    let next = 0;
    const players: GameState["players"] = {};
    for (const seat of seats) {
        if (players[seat.player]) throw new Error(`Seat ${seat.player} appears twice`);
        const deck: CardIdentifier[] = seat.deck.flatMap((entry) => Array.from({ length: entry.count }, () => ({ fullName: entry.fullName, i: pool[next++] })));
        const position: PlayerPosition = { lore: 0, turnsTaken: 0, deck, hand: [], play: [], discard: [], inkwell: [] };
        players[seat.player] = position;
    }
    return { turn: { number: 1, player: first }, players };
}

function* game(seats: readonly Seat[], options: RunnerOptions): Generator<Call, GameRecord, unknown> {
    if (!seats.length) throw new Error("A game needs at least one seat");
    const random = new SeededRandom(options.seed);
    const identities = random.fork(),
        outcomes = random.fork(),
        handles = random.fork();
    const initial = options.from ?? initialState(seats, options.first ?? seats[0].player, identities);
    const session = new Session(seats, options, outcomes, handles);
    let setup: Turn = { steps: [] },
        state = initial;
    if (options.from) yield* session.introduce(initial);
    else {
        const live = startGame(initial, options.engine);
        yield* session.resolve(live, initial);
        setup = live.turn;
        state = result(live);
    }
    const turns: { start: GameState; turn: Turn }[] = [];
    const limit = options.maxTurns ?? 200;
    const eliminated: PlayerNumber[] = [];
    for (let count = 0; count < limit; count++) {
        if (options.turns !== undefined && count >= options.turns) return { initial, setup, turns, final: state };
        const live = startTurn(state, options.engine);
        yield* session.resolve(live, state);
        turns.push({ start: state, turn: live.turn });
        const next = result(live);
        const departed = (Object.keys(state.players).map(Number) as PlayerNumber[]).filter((player) => !next.players[player]);
        state = next;
        if (live.outcome) {
            const outcome: GameOutcomeRecord = { winners: live.outcome.winners, eliminated: [...eliminated, ...departed], reason: live.outcome.reason };
            yield* session.finish(state, seats, outcome);
            return { initial, setup, turns, final: state, outcome };
        }
        if (departed.length) {
            eliminated.push(...departed);
            const leaving = seats.filter((seat) => departed.includes(seat.player));
            yield* session.finish(state, leaving, { winners: [], eliminated: [...eliminated], reason: "Empty Deck" });
        }
    }
    throw new Error(`Game did not finish within ${limit} turns`);
}

/** The public instructions of a chosen trigger or replacement. Engine slots stay private. */
function selected(request: Resolution["request"], step: TurnStep): StepRecord["choice"] {
    if (step.type !== "Decision" || !request) return undefined;
    const answer = step.answer;
    if (request.type === "Choose Trigger" && answer.type === "Choose Trigger") {
        const option = request.options.find((entry) => entry.reference.rule === answer.trigger.rule && entry.reference.event === answer.trigger.event);
        return option && { type: "Choose Trigger", player: option.player, ...(option.source ? { source: option.source } : {}), effect: option.effect };
    }
    if (request.type === "Choose Replacement" && answer.type === "Choose Replacement") {
        const option = request.options.find((entry) => entry.reference === answer.replacement);
        return (
            option && {
                type: "Choose Replacement",
                player: option.player,
                ...(option.source ? { source: option.source } : {}),
                replacement: option.replacement,
            }
        );
    }
    return undefined;
}

function result(live: Resolution): GameState {
    if (!live.result) throw new Error("Resolution did not finish");
    return live.result;
}

/** Live routing, projection and notification state shared by the resolutions of one game. */
class Session {
    private glimpses: Glimpse[] = [];
    private views = new Map<PlayerNumber, TurnStepView[]>();
    private pending = new Map<PlayerNumber, PlayerObservation[]>();
    private stale = new Set<PlayerNumber>();

    constructor(
        private readonly seats: readonly Seat[],
        private readonly options: RunnerOptions,
        private readonly outcomes: SeededRandom,
        private readonly handles: SeededRandom,
    ) {}

    *resolve(live: Resolution, start: GameState): Generator<Call, void, unknown> {
        this.glimpses = [];
        this.views = new Map(this.seats.map((seat) => [seat.player, []]));
        let seen = 0;
        const opened = live.position ?? live.result;
        if (opened) {
            // Start processing, such as readying and drawing, runs before the first request.
            seen = live.observations.length;
            this.track(undefined, opened, live.observations);
            this.notify({ before: start, after: opened, seen: live.observations }, [], [], live.rules?.revealedCards() ?? []);
        }
        const submit = (step: TurnStep): void => {
            const before = live.position,
                rules = live.rules;
            if (!before || !rules) throw new Error("Resolution has no live position");
            const action = step.type === "Action" ? describeAction(step.action, rules) : undefined;
            const choice = selected(live.request, step);
            const glimpsesBefore = this.glimpses,
                revealedBefore = rules.revealedCards();
            live.submit(step);
            const after = live.position ?? live.result;
            if (!after) throw new Error("Resolution lost its position");
            const all = live.observations,
                fresh = all.slice(seen);
            seen = all.length;
            this.track(step, after, fresh);
            const revealedAfter = live.rules?.revealedCards() ?? [];
            this.notify({ step, before, after, seen: fresh, action, ...(choice ? { choice } : {}) }, glimpsesBefore, revealedBefore, revealedAfter);
        };
        for (let request = live.request; request; request = live.request) {
            if (request.type === "Shuffle" || request.type === "Random Cards") {
                submit({ type: "Random", outcome: this.random(request) });
                continue;
            }
            const player = typeof request.player === "number" ? request.player : request.player.together.length === 1 ? request.player.together[0] : undefined;
            if (player === undefined) throw new UnsupportedInteraction(`${request.type} requires a joint answer from several players`);
            const seat = this.seats.find((seat) => seat.player === player);
            if (!seat) throw new Error(`No controller for player ${player}`);
            const position = live.position,
                rules = live.rules;
            if (!position || !rules) throw new Error("Resolution has no live position");
            yield* this.flush(position, live);
            const sees = sight(position, player, this.glimpses, rules.revealedCards());
            const projected = projectRequest(request, rules, sees, (count) => this.handles.shuffle(Array.from({ length: count }, (_, i) => i)));
            const state = projectState(position, sees);
            if (this.options.audit) {
                const leaked = hiddenIdentities(projected.request, sees);
                if (leaked.length) throw new Error(`${request.type} request discloses hidden cards to player ${player}: ${JSON.stringify(leaked)}`);
            }
            let error: string | undefined;
            for (;;) {
                const answer = (yield { type: "decide", seat, state, request: projected.request, ...(error ? { error } : {}) }) as PlayerAnswer;
                try {
                    submit(projected.toStep(answer));
                    break;
                } catch (failure) {
                    if (!(failure instanceof InvalidInput)) throw failure;
                    if (!this.options.retry) throw new Error(`Player ${player} gave an invalid answer: ${failure.message}`, { cause: failure });
                    error = failure.message;
                }
            }
        }
        const final = live.result;
        if (final) yield* this.flush(final, live);
    }

    /** Queues each seat's notifications and turn-view entry for one record. */
    private notify(
        record: StepRecord,
        glimpsesBefore: readonly Glimpse[],
        revealedBefore: readonly CardIdentifier[],
        revealedAfter: readonly CardIdentifier[],
    ): void {
        for (const seat of this.seats) {
            const was = sight(record.before, seat.player, glimpsesBefore, revealedBefore),
                now = sight(record.after, seat.player, this.glimpses, revealedAfter);
            if (record.step) this.views.get(seat.player)?.push(viewStep({ ...record, step: record.step }, was, now));
            const notes = observe(record, seat.player, was, now);
            if (notes.length) this.pending.set(seat.player, [...(this.pending.get(seat.player) ?? []), ...notes]);
            this.stale.add(seat.player);
        }
    }

    /** Sends updates to every seat with new history, including players not being asked. */
    private *flush(position: GameState, live: Resolution): Generator<Call, void, unknown> {
        const revealed = live.rules?.revealedCards() ?? [];
        for (const seat of this.seats) {
            if (!this.stale.has(seat.player)) continue;
            this.stale.delete(seat.player);
            const observations = this.pending.get(seat.player) ?? [];
            this.pending.delete(seat.player);
            const sees = sight(position, seat.player, this.glimpses, revealed);
            const update: PlayerUpdate = {
                state: projectState(position, sees),
                ...this.display(position, live.rules),
                turn: { steps: [...(this.views.get(seat.player) ?? [])] },
                observations,
            };
            yield { type: "observe", seat, update };
            this.options.trace?.(seat.player, update, position);
        }
    }

    /** Gives every controller its view of a starting position that did not come from setup. */
    *introduce(position: GameState): Generator<Call, void, unknown> {
        for (const seat of this.seats) {
            const update: PlayerUpdate = {
                state: projectState(position, sight(position, seat.player)),
                ...this.display(position),
                turn: { steps: [] },
                observations: [],
            };
            yield { type: "observe", seat, update };
            this.options.trace?.(seat.player, update, position);
        }
    }

    *finish(position: GameState, seats: readonly Seat[], outcome: GameOutcomeRecord): Generator<Call, void, unknown> {
        for (const seat of seats) {
            const sees: Sight = sight(position, seat.player);
            const observations = this.pending.get(seat.player) ?? [];
            this.pending.delete(seat.player);
            this.stale.delete(seat.player);
            yield {
                type: "observe",
                seat,
                update: {
                    state: projectState(position, sees),
                    ...this.display(position),
                    turn: { steps: [...(this.views.get(seat.player) ?? [])] },
                    observations,
                    outcome: { winners: outcome.winners, eliminated: outcome.eliminated, reason: outcome.reason },
                },
            };
        }
    }

    private display(position: GameState, rules?: Rules): Pick<PlayerUpdate, "characteristics"> {
        return this.options.characteristics ? { characteristics: projectCharacteristics(rules ?? new Rules(position, this.options.engine?.card)) } : {};
    }

    /** Glimpses last for the current intention while their cards stay where they were seen. */
    private track(
        step: TurnStep | undefined,
        after: GameState,
        fresh: readonly { type: "Look" | "Reveal"; cards: readonly CardIdentifier[]; players?: readonly PlayerNumber[] }[],
    ): void {
        if (step?.type === "Action") this.glimpses = [];
        if (step?.type === "Random" && step.outcome.type === "Shuffle") {
            const shuffled = new Set(step.outcome.cards.map(cardKey));
            this.glimpses = this.glimpses.filter((glimpse) => !shuffled.has(cardKey(glimpse.card)));
        }
        const where = placements(after);
        this.glimpses = this.glimpses.filter((glimpse) => samePlacement(where.get(cardKey(glimpse.card)), glimpse.place));
        for (const observation of fresh)
            for (const card of observation.cards) {
                const place = where.get(cardKey(card));
                if (place) this.glimpses.push({ card, place, ...(observation.players ? { players: observation.players } : {}) });
            }
    }

    private random(request: { type: "Shuffle"; cards: CardIdentifier[] } | { type: "Random Cards"; cards: CardIdentifier[]; count: number }): RandomOutcome {
        if (request.type === "Shuffle") return { type: "Shuffle", cards: this.outcomes.shuffle(request.cards) };
        return { type: "Random Cards", cards: this.outcomes.shuffle(request.cards).slice(0, request.count) };
    }
}
