import type { CardFilter } from "./ability";
import type { GameStateView } from "./game-state-view";
import type { PlayerAnswer, PlayerRequest } from "./player-interaction";

/**
 * A current plan interpreted by the same bot whether supplied or generated.
 * Generated plans are data. Supplied plans may also provide custom decisions.
 * Analysis can update priorities as the board changes. Timing and immediate
 * tactical needs are evaluated from the position, not a fixed game-phase label.
 */
export interface Strategy {
    /**
     * Optional custom logic, called before the normal bot evaluator for each request.
     * Return undefined to let the bot decide using the priorities below.
     * Card-name checks are allowed here, never in automatic strategy generation.
     * Answers follow normal validation and cannot bypass game rules.
     * Treat inputs as read-only and keep this deterministic, without external state
     * or randomness. Only the player's filtered view and request are supplied.
     */
    readonly choose?: (state: GameStateView, request: PlayerRequest) => PlayerAnswer | undefined;
    /** Relative nonnegative weights, not percentages. Several objectives can matter together. */
    readonly priorities: {
        readonly lore: number;
        readonly boardControl: number;
        readonly cards: number;
        readonly ink: number;
        readonly development: number;
    };
    readonly resources: {
        /** A planning target, not a rule to ink blindly or stop inking at this number. */
        readonly targetInk: number;
        readonly preserve: readonly {
            readonly cards: CardFilter;
            readonly importance: number;
            /** Desired copies to retain across hand and play, not copies in the starting deck. */
            readonly copies: number;
        }[];
    };
    /**
     * Enablers are worth more while they can support these payoffs. Filters can
     * describe mechanics-related groups or exact names in a supplied strategy.
     * These are relationships to evaluate, not instructions to execute blindly.
     */
    readonly synergies: readonly {
        readonly enablers: readonly CardFilter[];
        readonly payoffs: readonly CardFilter[];
        readonly importance: number;
    }[];
    /** Between 0 and 1. Zero favors average value. Higher values penalize poor sampled outcomes more. */
    readonly caution: number;
}
