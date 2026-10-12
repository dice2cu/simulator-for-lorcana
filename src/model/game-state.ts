/**
 * Game positions used by the engine.
 */
import type { GrantedAbility, EventPattern, Keyword, SimpleKeyword, NumericKeyword, CardFilter, CardSelection, Condition, ContinuousRule, Effect, CardPermission, PlayerPermission, PlayerSelection, CardRestriction, PlayerRestriction, Stat } from "./ability";
import type { CardIdentifier, Subtype, PlayerNumber } from "./identity";

/**
 * The position, whether between turns or while an action is resolving.
 * Accepted inputs live in turn.ts. Unfinished computation belongs to the engine.
 * Engine-produced positions are deeply frozen. Editable setup objects use the
 * same JSON shape and are copied when first supplied to the engine.
 */
export interface GameState {
    /**
     * The current turn, or the upcoming turn if the state is between turns.
     */
    turn: { number: number; player: PlayerNumber };
    /** Remaining players in seat order. A player who leaves a continuing multiplayer game is removed. */
    players: Partial<Record<PlayerNumber, PlayerPosition>>;
}

export interface PlayerPosition {
    lore: number;
    /** Quest cards can grant ink drops, which can be spent in place of ink. */
    inkDrops?: number;
    /**
     * Number of completed turns, used to identify the player's first turn after loading.
     */
    turnsTaken: number;
    /**
     * Top card first. Outside play, ownership follows the containing player's zone.
     */
    deck: CardIdentifier[];
    hand: CardIdentifier[];
    play: CardState[];
    discard: CardIdentifier[];
    /**
     * Ink cards provide the same resource, but their identities and individual
     * exertion states can matter in rare cases where cards leave the inkwell.
     * One edge case where it matters: Rescue Rangers Submarine's start-of-turn trigger before
     * Pongo - Dear Old Dad to add exerted ink after existing ink readies.
     * Pongo can then play a Puppy from either group.
     * Removing a ready Puppy reduces available ink, while removing an exerted one does not.
     * An exerted count alone loses this distinction.
     */
    inkwell: InkCard[];
    removed?: CardIdentifier[];
    modifiers?: PlayerModifier[];
}

export interface InkCard {
    card: CardIdentifier;
    exerted: boolean;
}

export interface CardState {
    card: CardIdentifier;
    /** Only set when the owner differs from the player controlling this card. */
    owner?: PlayerNumber;
    /**
     * Character/item only.
     */
    exerted?: boolean;
    /**
     * Character/location only.
     */
    damage?: number;
    /**
     * Characters cannot normally exert for turn actions while drying.
     * Items also retain this until turn start for Potato Shift inheritance.
     * Drying does not stop an item's own activated abilities.
     */
    drying?: boolean;
    location?: CardIdentifier;
    /**
     * Immediately below the top card first.
     */
    under?: UnderCard[];
    modifiers?: CardModifier[];
}

export interface UnderCard {
    card: CardIdentifier;
    /** Needed when a shifted stack contains a card owned by another player. */
    owner?: PlayerNumber;
    faceDown: boolean;
}

/**
 * Index into the immutable catalog abilities for this physical card.
 * Suppression and granted abilities never change the printed slots.
 */
export interface AbilityReference {
    card: CardIdentifier;
    i: number;
}

/**
 * The cause of instructions that may resolve after their source leaves play.
 * For example, Gruesome and Grim's delayed banishment retains its action source.
 * This records attribution, not printed card details or an effect identifier.
 */
export interface EffectSource {
    card: CardIdentifier;
    player: PlayerNumber;
    kind: "Ability" | "Action";
}

/**
 * Boundaries are actual turns, not ambiguous "next turn" strings.
 */
export type EffectExpiry =
    | { endOfTurn: number }
    | { startOfNextTurn: PlayerNumber; afterTurn: number }
    | { endOfNextTurn: PlayerNumber; afterTurn: number }
    /**
     * Execution removes this when the current challenge finishes.
     */
    | { endOfChallenge: true }
    | { leavesPlay: CardIdentifier }
    | { anyOf: [EffectExpiry, EffectExpiry, ...EffectExpiry[]] };

/**
 * When a modifier starts taking effect. Without `starts`, it is active immediately.
 * Remove `starts` once the specified boundary passes.
 */
export interface EffectStart {
    startOfNextTurn: PlayerNumber;
    afterTurn: number;
}

/**
 * Resolved changes, not references into a parsed ability.
 * Numeric changes combine regardless of array order. Modifiers with `starts` or
 * `expires` apply only while active. Suppression hides abilities without erasing their grants.
 */
export type CardModifier =
    | { stat: Stat; amount: number; starts?: EffectStart; expires?: EffectExpiry }
    | { gainKeyword: SimpleKeyword; amount?: never; starts?: EffectStart; expires?: EffectExpiry }
    | { gainKeyword: NumericKeyword; amount: number; starts?: EffectStart; expires?: EffectExpiry }
    | { loseKeyword: Exclude<Keyword, "Sing Together">; starts?: EffectStart; expires?: EffectExpiry }
    | { gainClassification: Subtype; starts?: EffectStart; expires?: EffectExpiry }
    | { inkable: boolean; starts?: EffectStart; expires?: EffectExpiry }
    | { restriction: CardRestriction; keyword?: Exclude<Keyword, "Sing Together">; by?: CardFilter; byPlayer?: PlayerSelection; when?: Condition; starts?: EffectStart; expires?: EffectExpiry }
    | { permission: CardPermission; where?: CardFilter; starts?: EffectStart; expires?: EffectExpiry }
    /**
     * Consume at the next applicable damage event, or remove on expiry/zone exit.
     */
    | { preventDamage: "Next"; starts?: EffectStart; expires?: EffectExpiry }
    | { gainAbility: GrantedAbility; starts?: EffectStart; expires?: EffectExpiry }
    | { loseAbility: "All" | { name: string }; starts?: EffectStart; expires?: EffectExpiry }
    | { countsAsName: string; for?: "Shift"; starts?: EffectStart; expires?: EffectExpiry }
    | { minimumStat: Stat; amount: number; starts?: EffectStart; expires?: EffectExpiry }
    /**
     * Created rules are independent of printed/granted abilities.
     * Their source is retained even when they are stored on another player's card.
     */
    | { rule: ContinuousRule; source: EffectSource; uses?: number; starts?: EffectStart; expires?: EffectExpiry }
    | { trigger: EventPattern; effect: Effect; source: EffectSource; uses?: number; starts?: EffectStart; expires?: EffectExpiry };

/**
 * Lasting player changes and independently created rules.
 */
export type PlayerModifier =
    | { skipDrawStep: true; starts?: EffectStart; expires?: EffectExpiry }
    | { restriction: "Can't Play"; where?: CardFilter; starts?: EffectStart; expires?: EffectExpiry }
    | { restriction: Exclude<PlayerRestriction, "Can't Play">; where?: never; starts?: EffectStart; expires?: EffectExpiry }
    | { permission: PlayerPermission; cards?: CardSelection; exerted?: boolean; starts?: EffectStart; expires?: EffectExpiry }
    | { additionalInk: number; starts?: EffectStart; expires?: EffectExpiry }
    | { readyLimit: number; starts?: EffectStart; expires?: EffectExpiry }
    | { inkEntersExerted: true; starts?: EffectStart; expires?: EffectExpiry }
    | { challengeLimit: number; count: "Characters"; players: PlayerSelection; starts?: EffectStart; expires?: EffectExpiry }
    | { victoryLore: number; starts?: EffectStart; expires?: EffectExpiry }
    | { rule: ContinuousRule; source: EffectSource; uses?: number; starts?: EffectStart; expires?: EffectExpiry }
    /**
     * Delay resolves to a one-use turn-boundary trigger, not a separate queue.
     */
    | { trigger: EventPattern; effect: Effect; source: EffectSource; uses?: number; starts?: EffectStart; expires?: EffectExpiry };

/**
 * Combines resolved stat modifiers. The caller supplies only active modifiers,
 * including those from static rules. This function does not evaluate selectors or durations.
 * Adds signed changes before applying minimum values. Negative Strength and Lore read as zero.
 */
export function getModifiedStat(printed: number, stat: Stat, modifiers: readonly CardModifier[]): number {
    let delta = 0;
    let floor: number | undefined;
    for (const modifier of modifiers) {
        if ("stat" in modifier && modifier.stat === stat) {
            delta += modifier.amount;
        } else if ("minimumStat" in modifier && modifier.minimumStat === stat) {
            floor = floor === undefined ? modifier.amount : Math.max(floor, modifier.amount);
        }
    }
    let value = printed + delta;
    if (floor !== undefined) value = Math.max(value, floor);
    return stat === "Strength" || stat === "Lore" ? Math.max(0, value) : value;
}
