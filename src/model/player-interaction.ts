import type { CardIdentifier, PlayerNumber } from "./identity";
import type { GameStateView } from "./game-state-view";
import type { Ability, KeywordAbility, Cost, ContinuousRule, Effect, Replacement, Zone } from "./ability";
import type { EffectSource } from "./game-state";
import type { DecisionPlayer, PlayerAction } from "./turn";
import type { TurnView } from "./turn-view";

/**
 * Shared by a bot or a human UI, with one controller per player per game.
 * The runner delivers filtered observations before requesting an answer.
 * Synchronous controllers return directly. A UI can wait for interaction using
 * a promise. Neither method receives authoritative state or private turn inputs.
 * The first runner routes one-participant groups normally and rejects joint
 * decisions with multiple participants before calling a controller.
 */
export interface PlayerController {
    observe(update: PlayerUpdate): void | Promise<void>;
    /** A retry receives the unchanged request plus a safe, user-facing validation message. */
    decide(state: GameStateView, request: PlayerRequest, error?: string): PlayerAnswer | Promise<PlayerAnswer>;
}

/**
 * Visible cards use their normal identifier. A hidden handle lets a player pick
 * an unidentified card, such as ready ink to exert for a payment. Handles are
 * valid only in the outstanding request, never in GameState or recorded Turns.
 */
export type PlayerCard = CardIdentifier | { readonly hidden: number };

/** Public action details. Granted abilities do not expose engine registry slots. */
export type PlayerActionDescription =
    | Exclude<PlayerAction, { type: "Activate" | "Boost" | "Shift" | "Play" | "Move" }>
    | { type: "Play"; player: PlayerNumber; card: CardIdentifier }
    | { type: "Move"; player: PlayerNumber; card: CardIdentifier; location: CardIdentifier }
    | {
          type: "Activate";
          player: PlayerNumber;
          card: CardIdentifier;
          /** Printed index when applicable. Granted abilities have no printed index. */
          ability?: number;
          definition: Extract<Ability, { type: "Activated" }>;
          free?: boolean;
      }
    | {
          type: "Boost";
          player: PlayerNumber;
          card: CardIdentifier;
          ability?: number;
          definition: Extract<KeywordAbility, { name: "Boost" }>;
          free?: boolean;
      }
    | { type: "Shift"; player: PlayerNumber; card: CardIdentifier; onto: readonly CardIdentifier[]; ability?: number };

/**
 * A question for a human or bot. Option numbers belong only to this request.
 * Only card selections and payments need to support unidentified cards.
 * Rule descriptions must be visible instructions, not private runtime bindings.
 * The runner checks visibility and maps hidden handles before execution.
 */
export type PlayerRequest =
    | {
          type: "Action";
          player: PlayerNumber;
          actions: readonly {
              option: number;
              action: PlayerActionDescription;
              /**
               * Visible payment for this option, including alternate prices. Empty for a free action.
               * Conditional discounts and concrete payments are resolved by later decisions.
               */
              cost: readonly Cost[];
          }[];
      }
    | {
          type: "Choose Cards";
          player: DecisionPlayer;
          cards: readonly PlayerCard[];
          min: number;
          max: number;
          /** A nonempty choice must include one of these. */
          required?: readonly PlayerCard[];
          /** The chosen cards' values may add up to at most max. */
          total?: { max: number; values: readonly { card: PlayerCard; value: number }[] };
          /** What happens to the chosen cards, as printed. Absent for choices made while paying a cost. */
          effect?: Effect;
      }
    | { type: "Order Cards"; player: DecisionPlayer; cards: readonly PlayerCard[] }
    | { type: "Choose Player"; player: DecisionPlayer; players: readonly PlayerNumber[] }
    | { type: "Choose Mode"; player: DecisionPlayer; options: readonly { mode: number; effect: Effect }[] }
    | { type: "Choose Amount"; player: DecisionPlayer; min: number; max: number }
    | {
          type: "Choose Replacement";
          player: PlayerNumber;
          options: readonly { option: number; player: PlayerNumber; source?: EffectSource; replacement: Replacement }[];
      }
    | {
          type: "Pay Cost";
          player: DecisionPlayer;
          cost: readonly Cost[];
          optional: boolean;
          /** Ready ink offered for payment. Each participant sees only authorized identities. */
          ink: readonly { player: PlayerNumber; cards: readonly PlayerCard[]; inkDrops: number }[];
          /**
           * Legal complete payments, each a valid answer as listed. Ink cards inside
           * them can be swapped for other offered ready ink. Not exhaustive when
           * card choices are numerous. Empty when the cost cannot be paid.
           */
          payments: readonly (readonly PlayerPayment[])[];
          /** Candidate cards for editing a payment instead of accepting a suggestion. The engine validates the completed payment. */
          cards?: readonly PlayerCard[];
      }
    | { type: "Optional"; player: DecisionPlayer; effect: Effect }
    | { type: "Optional Cost Rule"; player: PlayerNumber; rule: Extract<ContinuousRule, { type: "Modify Cost" }> }
    | { type: "Choose Trigger"; player: PlayerNumber; options: readonly { option: number; player: PlayerNumber; source?: EffectSource; effect: Effect }[] }
    | { type: "Name Card"; player: DecisionPlayer }
    | { type: "Distribute Damage Removal"; player: DecisionPlayer; cards: readonly { card: CardIdentifier; max: number }[]; max: number };

/** Interpreted only against the outstanding projected request, then mapped to a TurnStep. */
export type PlayerAnswer = { type: "Action"; option: number } | { type: "Decision"; answer: PlayerDecisionAnswer };

/** Answers refer to the outstanding request. The runner validates all choices. */
export type PlayerDecisionAnswer =
    | { type: "Choose Cards" | "Order Cards"; cards: readonly PlayerCard[] }
    | { type: "Choose Player"; player: PlayerNumber }
    | { type: "Choose Mode"; mode: number }
    | { type: "Choose Trigger" | "Choose Replacement"; option: number }
    | { type: "Choose Amount"; amount: number }
    | { type: "Pay Cost"; pay: false }
    | { type: "Pay Cost"; pay: true; payment: readonly PlayerPayment[] }
    | { type: "Optional" | "Optional Cost Rule"; accept: boolean }
    | { type: "Name Card"; name: string }
    | { type: "Distribute Damage Removal"; amounts: readonly { card: CardIdentifier; amount: number }[] };

/** Same payment vocabulary as Turn, with hidden handles allowed for unidentified cards. */
export type PlayerPayment =
    | { type: "Ink"; player: PlayerNumber; cards: readonly PlayerCard[]; inkDrops?: number }
    | { type: "Lose Lore"; player: PlayerNumber; amount: number }
    | { type: "Exert" | "Banish" | "Discard"; player: PlayerNumber; cards: readonly PlayerCard[] }
    | { type: "Deal Damage"; player: PlayerNumber; cards: readonly PlayerCard[]; amount: number }
    | { type: "Move Card"; player: PlayerNumber; cards: readonly PlayerCard[]; to: "Hand" | "Deck Bottom" }
    | { type: "Move Card"; player: PlayerNumber; cards: readonly PlayerCard[]; to: "Under"; under: CardIdentifier };

/** player identifies the containing player's zone, not the notification recipient. */
export interface PlayerCardLocation {
    readonly player: PlayerNumber;
    readonly zone: Zone;
    /** Required for Under. */
    readonly under?: CardIdentifier;
    /**
     * Deck position of cards[0]. Zero is the top or bottom. Card arrays always
     * run top first, including groups placed on the bottom. A bottom group's
     * first card therefore has index cards.length - 1 when the group is appended.
     * Source positions precede a move, destination positions follow it.
     */
    readonly position?: { readonly from: "Top" | "Bottom"; readonly index: number };
}

/**
 * Execution notifications delivered once to each authorized recipient. Recipients
 * are chosen by the runner, not included in the payload. These are not raw engine
 * observations. A private draw can include a count without exposing identities.
 */
export type PlayerObservation =
    | { readonly type: "Look" | "Reveal"; readonly location: PlayerCardLocation; readonly cards: readonly CardIdentifier[] }
    /** Identifies the intention, as distinct from merely putting a card into a zone. */
    | { readonly type: "Action"; readonly action: PlayerActionDescription }
    /** Public selections remain understandable after request-local options expire. */
    | { readonly type: "Choose Trigger"; readonly player: PlayerNumber; readonly source?: EffectSource; readonly effect: Effect }
    | { readonly type: "Choose Replacement"; readonly player: PlayerNumber; readonly source?: EffectSource; readonly replacement: Replacement }
    /**
     * Cards are top first when deck order is visible. The destination
     * position describes placement after the move. Null hides an identity. Never
     * infer order from a movement whose source or destination position is omitted.
     */
    | { readonly type: "Move Cards"; readonly from: PlayerCardLocation; readonly to: PlayerCardLocation; readonly cards: readonly (CardIdentifier | null)[] }
    /** Invalidates known ordering, not knowledge of the deck's composition. */
    | { readonly type: "Shuffle"; readonly player: PlayerNumber };

/** Supplied when constructing either a human controller or a bot. Not game state. */
export interface PlayerSetup {
    readonly player: PlayerNumber;
    readonly deck: readonly DeckListEntry[];
}

/** Deck composition supplied during setup, without physical identifiers or current placement. */
export interface DeckListEntry {
    readonly fullName: string;
    readonly count: number;
}

/** A state/history snapshot plus new notifications. Only observations are incremental. */
export interface PlayerUpdate {
    readonly state: GameStateView;
    /** Current public board stats, calculated by the engine rather than copied from printed cards. */
    readonly characteristics?: readonly { readonly card: CardIdentifier; readonly strength: number; readonly willpower: number; readonly lore: number }[];
    /** Current turn's filtered prefix. Replaces the previous prefix, not appended to it. */
    readonly turn: TurnView;
    readonly observations: readonly PlayerObservation[];
    /**
     * Execution outcome, never attached to GameState. Notify an eliminated
     * controller even if play continues. Winners stays empty until the game ends.
     */
    readonly outcome?: { readonly winners: readonly PlayerNumber[]; readonly eliminated: readonly PlayerNumber[]; readonly reason: "Lore" | "Empty Deck" };
}
