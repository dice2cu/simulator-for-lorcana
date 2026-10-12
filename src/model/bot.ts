import type { CardBase } from "./card";
import type { CardIdentifier, PlayerNumber } from "./identity";
import type { DeckListEntry, PlayerController, PlayerSetup } from "./player-interaction";
import type { Strategy } from "./strategy";

/**
 * Bot-specific state on the same interaction contract used by a human UI.
 * Strategy, beliefs and search settings never become controller requirements.
 */
export interface Bot extends PlayerController {
    readonly memory: BotMemory;
}

export interface BotSetup extends PlayerSetup {
    /** Omitted seats receive no opponent list. */
    readonly opponents?: Readonly<Partial<Record<PlayerNumber, DeckKnowledge>>>;
    /**
     * Omit to generate a strategy from the deck and permitted opponent knowledge.
     * Supplied custom decision logic is retained when analysis updates priorities.
     */
    readonly strategy?: Strategy;
    readonly settings: {
        /** Bot difficulty choices and hypothetical sampling only, not actual game randomness. */
        readonly seed: number;
        /** Deterministic limits per decision. Zero nodes disables search. */
        readonly search: { readonly nodes: number; readonly samples: number };
        /**
         * Chance from 0 to 1 of choosing a lower-ranked candidate instead of the best.
         * Omitted or zero always chooses the highest evaluated candidate, with stable
         * tie-breaking. Otherwise sample uniformly from lower-ranked candidates.
         * Has no effect when no weaker candidate exists. Uses the bot's seed.
         * Applies to normal evaluation, not an explicit Strategy.choose answer.
         */
        readonly randomness?: number;
    };
}

/**
 * Derived per-game knowledge, not an observation log to replay on every decision.
 * Stable instances can be recognized when visible again. Hidden placement is not
 * supplied by the runner. Knowledge and strategy change as evidence arrives.
 */
export interface BotMemory {
    readonly players: Readonly<Partial<Record<PlayerNumber, PlayerKnowledge>>>;
    readonly strategy: Strategy;
}

/** Facts and composition bounds for one player, including the bot itself. */
export interface PlayerKnowledge {
    readonly deck?: DeckKnowledge;
    readonly observedColors: CardBase["colors"];
    /** Unique physical cards seen at least once. Reappearances do not count as new copies. */
    readonly seenCards: readonly CardIdentifier[];
    /** Cards known to remain in hand, not guesses about private draws. */
    readonly hand: readonly CardIdentifier[];
    /** Known inkwell membership, not hidden positions or guesses about exertion. */
    readonly inkwell: readonly CardIdentifier[];
    /** Top first. A shuffle clears both lists without erasing composition knowledge. */
    readonly deckTop: readonly CardIdentifier[];
    /** Top first within the known bottom group. The last entry is the bottom card. */
    readonly deckBottom: readonly CardIdentifier[];
    /** Bounds, not perfect counting. Unknown face-down movements can widen them. */
    readonly remainingDeck: readonly { readonly fullName: string; readonly min: number; readonly max: number }[];
    /** Bounds for cards with names not represented in remainingDeck, not extra copies of listed names. */
    readonly unlistedDeck: { readonly min: number; readonly max: number };
}

/** Neither variant is filled automatically from the runner's actual opponent deck. */
export type DeckKnowledge =
    | { readonly type: "Confirmed"; readonly cards: readonly DeckListEntry[] }
    /** Observations override this list. Confidence is between 0 and 1. */
    | { readonly type: "Scouted"; readonly cards: readonly DeckListEntry[]; readonly confidence: number };
