import type { Cost, ContinuousRule, Effect, Replacement, Zone } from "./ability";
import type { AbilityReference, EffectSource } from "./game-state";
import type { CardIdentifier, PlayerNumber } from "./identity";

/**
 * Accepted actions, decisions and random outcomes in order.
 * An unfinished turn is a prefix of the same record. Applying it to its starting
 * position reconstructs the outstanding request. Live execution belongs to the engine.
 */
export interface Turn {
    steps: TurnStep[];
}

/**
 * Intentions are validated and fully resolved by the engine.
 */
export type PlayerAction =
    | { type: "Ink"; player: PlayerNumber; card: CardIdentifier }
    /**
     * Choose this card's play rule or an Alternate Cost supplied by a source ability.
     */
    | { type: "Play"; player: PlayerNumber; card: CardIdentifier; alternateCost?: { playRule: number } | AbilityReference }
    | { type: "Shift"; player: PlayerNumber; card: CardIdentifier; onto: CardIdentifier[]; ability: number; rule?: never; alternateCost?: AbilityReference }
    | { type: "Shift"; player: PlayerNumber; card: CardIdentifier; onto: CardIdentifier[]; rule: number; ability?: never; alternateCost?: AbilityReference }
    | { type: "Sing"; player: PlayerNumber; song: CardIdentifier; singers: CardIdentifier[] }
    | { type: "Quest"; player: PlayerNumber; card: CardIdentifier }
    | { type: "Challenge"; player: PlayerNumber; attacker: CardIdentifier; defender: CardIdentifier }
    | { type: "Activate"; player: PlayerNumber; ability: AbilityReference; free?: boolean }
    /**
     * rule is an engine rule-registry slot, not a printed ability index.
     * It must contain an active Activated ability belonging to this card.
     */
    | { type: "Activate"; player: PlayerNumber; card: CardIdentifier; rule: number; free?: boolean }
    /**
     * Printed slot or active granted-rule occurrence, never a copied keyword definition.
     * Identical gained Boost abilities have independent once-per-turn limits.
     */
    | { type: "Boost"; player: PlayerNumber; card: CardIdentifier; ability: number; rule?: never; free?: boolean }
    | { type: "Boost"; player: PlayerNumber; card: CardIdentifier; rule: number; ability?: never; free?: boolean }
    | { type: "Move"; player: PlayerNumber; card: CardIdentifier; location: CardIdentifier; alternateCost?: AbilityReference }
    | { type: "End Turn"; player: PlayerNumber }
    | { type: "Alter Hand"; player: PlayerNumber; cards: CardIdentifier[] };

/** The next intention during the main part of a turn. Costs and choices follow separately. */
export interface ActionRequest {
    type: "Action";
    player: PlayerNumber;
    actions: PlayerAction[];
}

export type TurnRequest = ActionRequest | Decision | RandomRequest;

/** Actions, player answers and random outcomes in the order they were accepted. */
export type TurnStep =
    | { type: "Action"; action: PlayerAction }
    | { type: "Decision"; answer: DecisionAnswer }
    | { type: "Random"; outcome: RandomOutcome };

/** Validated against the single outstanding random request. */
export type RandomOutcome =
    | { type: "Shuffle"; cards: CardIdentifier[] }
    | { type: "Random Cards"; cards: CardIdentifier[] };

/** Randomness is supplied externally, not generated while evaluating the position. */
export type RandomRequest =
    | { type: "Shuffle"; cards: CardIdentifier[] }
    | { type: "Random Cards"; cards: CardIdentifier[]; count: number };

/** A rule's append-only engine registry slot and the event that triggered it. */
export interface TriggerReference {
    rule: number;
    event: number;
}

/**
 * Concrete events. EventPattern in ability.ts describes matching, not occurrences.
 */
export type TurnEvent =
    | {
          event: "Quest" | "Leave Play" | "Ready" | "Exert" | "Boost" | "Put Into Inkwell";
          player: PlayerNumber;
          card: CardIdentifier;
      }
    | { event: "Discard"; player: PlayerNumber; card: CardIdentifier; kind: "Cost" | "Effect" }
    | { event: "Put Under"; player: PlayerNumber; card: CardIdentifier; under: CardIdentifier }
    | { event: "Chosen For Support"; player: PlayerNumber; card: CardIdentifier; source: CardIdentifier }
    | { event: "Play"; player: PlayerNumber; card: CardIdentifier; inkPaid: number; method?: never; onto?: never; singers?: never }
    | { event: "Play"; player: PlayerNumber; card: CardIdentifier; inkPaid: number; method: "Sing" | "Sing Together"; singers: CardIdentifier[]; onto?: never }
    | { event: "Play"; player: PlayerNumber; card: CardIdentifier; inkPaid: number; method: "Shift"; onto: CardIdentifier[] }
    | { event: "Shift"; player: PlayerNumber; card: CardIdentifier; onto: CardIdentifier[] }
    | { event: "Chosen"; player: DecisionPlayer; card: CardIdentifier; source?: CardIdentifier; kind: "Ability" | "Action" }
    | {
          event: "Banish";
          player: PlayerNumber;
          card: CardIdentifier;
          source?: CardIdentifier;
          kind?: "Challenge" | "Ability" | "Action";
          attacker?: CardIdentifier;
          defender?: CardIdentifier;
      }
    | { event: "Sing"; player: PlayerNumber; song: CardIdentifier; singers: CardIdentifier[] }
    | { event: "Challenge" | "After Challenge"; player: PlayerNumber; attacker: CardIdentifier; defender: CardIdentifier }
    | {
          event: "Deal Damage" | "Put Damage" | "Remove Damage";
          player: PlayerNumber;
          card: CardIdentifier;
          amount: number;
          source?: CardIdentifier;
          kind?: "Challenge" | "Ability" | "Action";
      }
    | { event: "Draw"; player: PlayerNumber; card: CardIdentifier }
    | { event: "Gain Lore" | "Lose Lore"; player: PlayerNumber; amount: number }
    | { event: "Remove Ink Drop"; player: PlayerNumber; amount: number }
    | { event: "Turn Start" | "Turn End"; player: PlayerNumber }
    | { event: "Move To Location"; player: PlayerNumber; card: CardIdentifier; location: CardIdentifier }
    | { event: "Move Card"; player: PlayerNumber; card: CardIdentifier; from: Zone; to: Zone };

/** A triggered instruction waiting in the bag, not a menu position. */
export interface PendingTrigger {
    reference: TriggerReference;
    player: PlayerNumber;
    source?: EffectSource;
    effect: Effect;
}

/** An applicable replacement and its rule's engine registry slot. */
export interface ReplacementOption {
    reference: number;
    player: PlayerNumber;
    source?: EffectSource;
    replacement: Replacement;
}

/**
 * Payment instructions with choices and quantities already resolved. Array order
 * follows the costs. Repeated contributions to a shared cost stay adjacent.
 * Ink is the listed cards plus inkDrops. Deck Bottom cards are in final order.
 */
export type CostPayment =
    | { type: "Ink"; player: PlayerNumber; cards: CardIdentifier[]; inkDrops?: number }
    | { type: "Lose Lore"; player: PlayerNumber; amount: number }
    | { type: "Exert" | "Banish" | "Discard"; player: PlayerNumber; cards: CardIdentifier[] }
    | { type: "Deal Damage"; player: PlayerNumber; cards: CardIdentifier[]; amount: number }
    | { type: "Move Card"; player: PlayerNumber; cards: CardIdentifier[]; to: "Hand" | "Deck Bottom" }
    | { type: "Move Card"; player: PlayerNumber; cards: CardIdentifier[]; to: "Under"; under: CardIdentifier };

/** A collective choice has one answer, not one independently applied answer per member. */
export type DecisionPlayer = PlayerNumber | { together: [PlayerNumber, ...PlayerNumber[]] };

/**
 * Concrete requests to a player, distinct from board actions. No request IDs.
 */
export type Decision =
    | {
          type: "Choose Cards";
          player: DecisionPlayer;
          cards: CardIdentifier[];
          min: number;
          max: number;
          /** A nonempty choice must include one of these (John Smith - Undaunted Protector must be chosen if able). */
          required?: CardIdentifier[];
          /** The chosen cards' values may add up to at most max (The Leviathan's total Strength). */
          total?: { max: number; values: { card: CardIdentifier; value: number }[] };
          /** What happens to the chosen cards, as printed. Absent for choices made while paying a cost. */
          effect?: Effect;
      }
    | { type: "Order Cards"; player: DecisionPlayer; cards: CardIdentifier[] }
    | { type: "Choose Player"; player: DecisionPlayer; players: PlayerNumber[] }
    /** mode is the original printed option index, even when some modes are unavailable. */
    | { type: "Choose Mode"; player: DecisionPlayer; options: { mode: number; effect: Effect }[] }
    | { type: "Choose Amount"; player: DecisionPlayer; min: number; max: number }
    | { type: "Choose Replacement"; player: PlayerNumber; options: ReplacementOption[] }
    /**
     * Outer card operands are bound to physical cards. Selected Cards inside a
     * Choose Cards cost refers to that cost's choice, not hidden engine context.
     */
    | { type: "Pay Cost"; player: DecisionPlayer; cost: Cost[]; optional: boolean }
    | { type: "Optional"; player: DecisionPlayer; effect: Effect }
    /**
     * Offers a discount for a proposed action. Accepting it does not consume
     * the discount until the action commits. This is not an Optional Effect.
     */
    | { type: "Optional Cost Rule"; player: PlayerNumber; rule: Extract<ContinuousRule, { type: "Modify Cost" }> }
    /**
     * Options are occurrences, even if two contain identical instructions.
     */
    | { type: "Choose Trigger"; player: PlayerNumber; options: PendingTrigger[] }
    | { type: "Name Card"; player: DecisionPlayer }
    | { type: "Distribute Damage Removal"; player: DecisionPlayer; cards: { card: CardIdentifier; max: number }[]; max: number };

/**
 * Checked against the single outstanding Decision, not interpreted on its own.
 */
export type DecisionAnswer =
    | { type: "Choose Cards" | "Order Cards"; cards: CardIdentifier[] }
    | { type: "Choose Player"; player: PlayerNumber }
    | { type: "Choose Mode"; mode: number }
    | { type: "Choose Trigger"; trigger: TriggerReference }
    | { type: "Choose Replacement"; replacement: number }
    | { type: "Choose Amount"; amount: number }
    | { type: "Pay Cost"; pay: false; payment?: never }
    | { type: "Pay Cost"; pay: true; payment: CostPayment[] }
    | { type: "Optional"; accept: boolean }
    | { type: "Optional Cost Rule"; accept: boolean }
    | { type: "Name Card"; name: string }
    | { type: "Distribute Damage Removal"; amounts: { card: CardIdentifier; amount: number }[] };
