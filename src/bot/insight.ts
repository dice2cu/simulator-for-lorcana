import type { Card } from "../model/card";
import type { Cost, Keyword } from "../model/ability";
import type { CardZonePlayerView, GameStateView } from "../model/game-state-view";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { PlayerActionDescription, PlayerAnswer, PlayerRequest } from "../model/player-interaction";
import type { TurnStepView } from "../model/turn-view";

/**
 * Queries a bot may ask about a position it is allowed to know. Implemented by
 * trusted search infrastructure over a hypothetical position built only from a
 * player's view, so bot policy never imports GameState, Resolution or Rules.
 */
export interface Insight {
    readonly view: GameStateView;
    readonly viewer: PlayerNumber;
    players(): readonly PlayerNumber[];
    /** Public numbers and the hand as the viewer sees it, readable without projecting the whole view. */
    lore(player: PlayerNumber): number;
    inkwell(player: PlayerNumber): number;
    hand(player: PlayerNumber): CardZonePlayerView;
    /** Undefined for cards whose identity the viewer cannot see. */
    facts(card: CardIdentifier): CardFacts | undefined;
    /** Characters, items and locations the player controls, with current characteristics. */
    board(player: PlayerNumber): readonly CardFacts[];
    victoryLore(player: PlayerNumber): number;
    /** Whether attacker could challenge defender during its controller's next turn, after readying. */
    threatens(attacker: CardIdentifier, defender: CardIdentifier): boolean;
    /** Damage each side would deal in a challenge, after Challenger and Resist. */
    challenge(attacker: CardIdentifier, defender: CardIdentifier): { toDefender: number; toAttacker: number };
    /**
     * Plays one offered action in this hypothetical world, continues the turn and
     * optionally the next player's reply, and returns the best explored result.
     * Undefined when the action cannot be found or resolved in this world.
     */
    simulate(action: PlayerActionDescription, cost: readonly Cost[], search: SimulationSearch): SimulationResult | undefined;
    /** Whether simulations resume the current turn with its earlier history, rather than without it. */
    readonly replayed: boolean;
}

export interface CardFacts {
    readonly card: CardIdentifier;
    readonly definition: Card;
    readonly controller: PlayerNumber;
    readonly owner: PlayerNumber;
    readonly zone: "Play" | "Hand" | "Deck" | "Discard" | "Inkwell" | "Under" | "Removed";
    readonly strength: number;
    readonly willpower: number;
    readonly lore: number;
    readonly damage: number;
    readonly exerted: boolean;
    readonly drying: boolean;
    /** Current play cost for the card's holder. */
    readonly cost: number;
    readonly inkable: boolean;
    keyword(keyword: Keyword): number;
    /** Abilities currently granted by modifiers, in addition to printed abilities. */
    readonly granted: number;
}

/** Names to try for unidentified hand and deck entries, in order. Missing names become inert placeholders. */
export type WorldFill = Readonly<Partial<Record<PlayerNumber, { readonly hand: readonly string[]; readonly deck: readonly string[] }>>>;

/** A view, possibly with remembered identities added, plus sampled names for what remains hidden. */
export interface WorldSketch {
    readonly view: GameStateView;
    readonly fill?: WorldFill;
}

/** How to build a hypothetical world, using only what the bot knows and believes. */
export interface Hypothesis {
    readonly current: WorldSketch;
    /**
     * The current resolution's start and visible inputs. Search replays them to
     * restore turn-local history, and falls back to the current position alone
     * when the replay does not reproduce the bot's current view.
     */
    readonly turn?: {
        readonly start: WorldSketch;
        readonly steps: readonly TurnStepView[];
        /** Public descriptions of the resolution's intentions, in order, for steps the turn view omits. */
        readonly actions?: readonly PlayerActionDescription[];
    };
}

/** Callbacks used while exploring an action and the play that follows it. */
export interface SimulationSearch {
    /** Ranked candidate answers for any player, including turn actions. The first valid one is played. */
    candidates(insight: Insight, request: PlayerRequest, player: PlayerNumber): readonly PlayerAnswer[];
    /** Score for the searching player. Higher is better. Winners is set when the game ended. */
    evaluate(insight: Insight, timing: Timing, winners?: readonly PlayerNumber[]): number;
    /**
     * Inputs to spend on one action, counted after the current decision point. Alternatives
     * within the action are explored only while less than half is spent. Every rollout still
     * finishes the turn and the reply, so all results are scored at the same point.
     */
    nodes: number;
    /** Maximum alternatives compared at each of the searching player's decisions within the action. */
    width: number;
    /** Continue through the next player's turn before evaluating. */
    reply: boolean;
}

/** Who acts next in an evaluated position, and whether that player's turn is still to start. */
export interface Timing {
    readonly player: PlayerNumber;
    /** At the start of a turn every character readies, dries and can quest. */
    readonly starting: boolean;
}

export interface SimulationResult {
    readonly score: number;
    /** Answers to the searching player's decisions within the action, so live follow-ups can reuse them. */
    readonly line: readonly { readonly request: PlayerRequest; readonly answer: PlayerAnswer }[];
    readonly insight: Insight;
    readonly nodes: number;
}
