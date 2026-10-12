import type { GameState } from '../model/game-state';
import type { Decision, DecisionAnswer, TurnRequest, Turn, TurnStep } from '../model/turn';
import { assertRequestedInput } from './turn-input';
import { freeze, immutable } from './immutable';
import { InvalidInput } from './invalid-input';
import type { PlayerNumber } from '../model/identity';
import type { Rules } from './rules';
import type { CardIdentifier } from '../model/identity';

export type AnswerFor<D extends Decision, A = DecisionAnswer> = A extends DecisionAnswer
    ? D['type'] extends A['type'] ? A & { type: D['type'] } : never
    : never;

/** Information revealed by an instruction, without changing the physical cards. */
export interface CardObservation {
    type: 'Look' | 'Reveal';
    cards: readonly CardIdentifier[];
    /** Only these players may see a private look. Omitted for a public reveal. */
    players?: readonly PlayerNumber[];
}

/** Derived at a game-state check. Empty decks cause loss only at turn end. */
export interface GameOutcome {
    winners: PlayerNumber[];
    reason: 'Lore' | 'Empty Deck';
}

/** Extra legality checks run before resuming, not inside the suspended generator. */
export interface InputRequest {
    request: TurnRequest;
    validate?: (answer: DecisionAnswer) => void;
    validateAction?: (action: Extract<TurnStep, { type: 'Action' }>['action']) => void;
}

/**
 * Drives a synchronous resolver. Requests and accepted inputs are returned as
 * immutable values. Invalid input leaves the generator at the same request.
 * This live object is not part of the serializable Turn.
 */
export class Resolution {
    private waiting?: InputRequest;
    private output?: GameState;
    private failed = false;
    private readonly accepted: TurnStep[];

    constructor(private readonly iterator: Generator<InputRequest, GameState, TurnStep>, initial: TurnStep[] = [],
        private readonly current?: () => GameState, private readonly ending?: () => GameOutcome | undefined,
        private readonly queries?: () => Rules, private readonly information?: () => readonly CardObservation[],
        private readonly branching?: () => Resolution | undefined) {
        this.accepted = [...immutable(initial)];
        this.advance();
    }

    get request(): TurnRequest | undefined {
        return this.waiting?.request;
    }

    get result(): GameState | undefined {
        return this.output;
    }

    get outcome(): GameOutcome | undefined { return this.failed ? undefined : this.ending ? immutable(this.ending()) : undefined; }

    get turn(): Turn { return freeze({ steps: [...this.accepted] }); }

    /** A working snapshot, not a complete mid-action state. Unavailable after failure. */
    get position(): GameState | undefined { return this.failed ? undefined : this.current?.() ?? this.output; }

    /** Queries include the live turn's history, challenge and ability-use limits. */
    get rules(): Rules | undefined { return this.failed ? undefined : this.queries?.(); }

    // The engine's observation list grows, so callers get a frozen copy of the list, not of each entry.
    get observations(): readonly CardObservation[] { return this.failed ? [] : freeze([...(this.information?.() ?? [])]); }

    /**
     * While waiting for the turn player's next intention, an independent resolution
     * continuing the same turn with its history and usage limits. Its Turn records
     * only inputs submitted to it. Undefined at any other request.
     */
    branch(): Resolution | undefined {
        return this.failed || this.waiting?.request.type !== 'Action' ? undefined : this.branching?.();
    }

    submit(input: TurnStep): void {
        if (this.failed) throw new Error('Resolution has failed');
        if (!this.waiting) throw new Error('Resolution is already complete');
        let step: TurnStep;
        try {
            step = immutable(input);
            assertRequestedInput(this.waiting.request, step);
            if (step.type === 'Decision') this.waiting.validate?.(step.answer);
            if (step.type === 'Action') this.waiting.validateAction?.(step.action);
        } catch (error) {
            if (!(error instanceof InvalidInput)) {
                this.failed = true;
                this.waiting = undefined;
            }
            throw error;
        }
        this.advance(step);
        this.accepted.push(step);
    }

    private advance(step?: TurnStep): void {
        try {
            const next = step === undefined ? this.iterator.next() : this.iterator.next(step);
            if (next.done) {
                this.output = freeze(next.value);
                this.waiting = undefined;
            // Requests are built fresh by the engine, so freezing them in place is enough.
            } else this.waiting = { ...next.value, request: freeze(next.value.request) };
        } catch (error) {
            this.failed = true;
            this.waiting = undefined;
            if (step !== undefined && error instanceof InvalidInput) {
                throw new Error('Resolution failed after accepting input', { cause: error });
            }
            throw error;
        }
    }
}
