import type { CardIdentifier, Subtype, PlayerNumber } from "./identity";

/**
 * Keywords whose printed shorthand does not take a parameter.
 */
export type SimpleKeyword = "Adventurous" | "Alert" | "Bodyguard" | "Evasive" | "Reckless" | "Rush" | "Support" | "Vanish" | "Ward";

/**
 * Keywords whose printed shorthand takes a number, such as Resist +2.
 */
export type NumericKeyword = "Challenger" | "Resist" | "Singer";

export type Keyword = SimpleKeyword | NumericKeyword | "Boost" | "Shift" | "Sing Together";

/**
 * Uses counts committed actions or resolutions. Occurrences counts matching
 * events even when declined, as with Seven Dwarfs' Mine's "the first time".
 * These counters reset each turn, unlike a created rule's lifetime uses.
 */
export type AbilityLimit = UsesLimit | OccurrencesLimit;

export interface UsesLimit {
    perTurn: number;
    count: "Uses";
}

export interface OccurrencesLimit {
    perTurn: number;
    count: "Occurrences";
}

/**
 * A printed ability or rule, including instructions used during deck construction.
 * `name` is the printed ability title, not an alias. Game abilities normally work
 * while their card is in play. `from` lists other zones where they can work,
 * as with Lilo - Escape Artist's ability in the discard pile. Deck Construction
 * is used by deck validators and ignored during gameplay.
 */
export type Ability =
    /**
     * Printed keyword shorthand, such as Rush or Resist +2.
     */
    | { type: "Keyword"; keyword: KeywordAbility }
    /**
     * An ability the player chooses to use by paying its cost, such as Lucky Dime.
     * If `from` is omitted, it can only be used while its card is in play.
     */
    | {
          type: "Activated"; cost: Cost[]; effect: Effect; when?: Condition; limit?: UsesLimit; name?: string; from?: Zone[];
          /**
           * Players who may use it. Defaults to its controller. Illumineer's Quest
           * cards let the opposing players together pay to banish them (Hercules - Manipulated Hero).
           */
          by?: PlayerSelection;
      }
    /**
     * Queued in the bag after a matching event, e.g. Rapunzel's healing.
     * Any `when` condition in `trigger` is checked when the event occurs,
     * not when the queued effect resolves.
     */
    | {
          type: "Triggered";
          trigger: EventPattern;
          effect: Effect;
          name?: string;
          limit?: AbilityLimit;
          /**
           * Zones where this ability can trigger. If omitted, it works while its
           * card is in play, including when that card enters or leaves play.
           */
          from?: Zone[];
      }
    /**
     * Continuously changes rules while available rather than resolving once.
     * Limited discounts count committed actions, not price queries (e.g. Raksha).
     */
    | { type: "Static"; rule: ContinuousRule; limit?: UsesLimit; name?: string; from?: Zone[] }
    /**
     * Changes or prevents a proposed event before it occurs, e.g. Beast - Selfless Protector.
     */
    | { type: "Replacement"; replacement: Replacement; name?: string; from?: Zone[] }
    /**
     * Overrides this card's deck-copy limit, not a rule active during play.
     * Dalmatian Puppy allows 99 copies, Microbots allows unlimited copies,
     * and The Glass Slipper allows only two.
     */
    | { type: "Deck Construction"; maxCopies: number | "Unlimited"; name?: string }
    /**
     * Matching cards may be included regardless of the deck's inks
     * (Christopher Robin - Hunny Sage). The filter does not include this card itself.
     */
    | { type: "Deck Construction"; anyInk: CardFilter; name?: string };

/**
 * Parameters belong only to the keywords that use them.
 */
export type KeywordAbility =
    | { name: SimpleKeyword }
    | { name: NumericKeyword; amount: number }
    | { name: "Boost"; cost: Cost[] }
    | {
          name: "Shift";
          cost: Cost[];
          /**
           * Eligible cards to shift onto. Posey - Vampire Potato shifts onto an item named Potato.
           * If omitted, use your characters
           * whose names match `names`, or this card's printed name if `names` is absent.
           */
          onto?: CardSelection;
          /**
           * Number of characters to shift onto. Defaults to one. Sulley & Boo's
           * Combo Shift uses One Or Two. Mickey Mouse & Minnie Mouse's Duo Shift requires two.
           */
          count?: 1 | 2 | "One Or Two";
          /**
           * One base per printed name, in any order. Each base fills exactly one
           * slot. Can Shift Onto may substitute for a name, but cannot bypass `count` or `when`.
           */
          names?: string[];
          /**
           * Requirements for the selected group that Can Shift Onto cannot bypass.
           */
          when?: Condition;
          /**
           * Instructions after shifting. Temporary Shift uses this to schedule
           * the return of just the top card.
           */
          afterShift?: Effect;
      };

/**
 * Abilities that can be granted during play. Simple and numeric keywords use
 * gainKeyword instead. Boost and Shift need their complete costs and rules.
 */
export type GrantedAbility =
    | Exclude<Ability, { type: "Keyword" | "Deck Construction" }>
    | { type: "Keyword"; keyword: Extract<KeywordAbility, { name: "Boost" | "Shift" }> };

/**
 * All pieces must be payable before activation. Partial payment is not sufficient.
 * Order follows the array. These are costs, not ordinary resolving effects.
 */
export type Cost =
    /**
     * When a group pays together, `each` makes every player in the group pay the
     * full amount (Monumental Scarab - Skittering Statue). Otherwise the group shares it.
     */
    | { type: "Ink"; amount: AmountForCost; each?: true }
    | { type: "Exert"; cards: CardSelection }
    | { type: "Banish"; cards: CardSelection }
    | { type: "Discard"; cards: CardSelection }
    | { type: "Deal Damage"; cards: CardSelection; amount: AmountForCost }
    | { type: "Lose Lore"; amount: AmountForCost }
    | { type: "Move Card"; cards: CardSelection; to: "Hand" }
    | { type: "Move Card"; cards: CardSelection; to: "Deck Bottom"; order?: "Chosen" | "Random" }
    | { type: "Move Card"; cards: CardSelection; to: "Under"; under: CardSelection }
    /**
     * Selects cards for the nested costs, which must all be payable in full.
     */
    | { type: "Choose Cards"; from: CardSelection; count: number; cost: Cost[] };

/**
 * Costs may depend on the board, but not on results of the effect they enable.
 */
export type AmountForCost = number | { count: CardSelection };

/**
 * Describes an event that can trigger an ability. Its `when` condition is checked
 * when the event occurs. An effect's `if` condition is checked later, when that
 * instruction resolves.
 * Event cards retain the facts needed by the ability even if they leave play.
 */
export type EventPattern =
    | {
          event: "Quest" | "Leave Play" | "Ready" | "Exert" | "Boost" | "Put Into Inkwell";
          card?: CardSelection;
          player?: PlayerSelection;
          when?: Condition;
      }
    | {
          event: "Discard";
          card?: CardSelection;
          /** The player whose cards are discarded. */
          player?: PlayerSelection;
          /**
           * Whether the discard pays a cost or is caused by an effect.
           * Kronk - Laid Back prevents only discards caused by effects.
           */
          kind?: "Cost" | "Effect";
          when?: Condition;
      }
    | { event: "Put Under"; card?: CardSelection; under?: CardSelection; player?: PlayerSelection; when?: Condition }
    | { event: "Chosen For Support"; card?: CardSelection; source?: CardSelection; player?: PlayerSelection; when?: Condition }
    | {
          event: "Play" | "Shift";
          card?: CardSelection;
          player?: PlayerSelection;
          /**
           * Matches any character selected to shift onto, not every card under the stack.
           */
          onto?: CardSelection;
          when?: Condition;
      }
    | {
          event: "Chosen";
          card?: CardSelection;
          /**
           * The player making the choice, not the chosen card's owner.
           */
          player?: PlayerSelection;
          source?: CardSelection;
          kind?: "Ability" | "Action";
          when?: Condition;
      }
    | {
          event: "Banish";
          card?: CardSelection;
          player?: PlayerSelection;
          source?: CardSelection;
          kind?: "Challenge" | "Ability" | "Action";
          attacker?: CardSelection;
          defender?: CardSelection;
          when?: Condition;
      }
    /**
     * Normally matches each singer separately. `together` matches the group once per song.
     */
    | { event: "Sing"; card?: CardSelection; song?: CardSelection; together?: boolean; player?: PlayerSelection; when?: Condition }
    /**
     * Matches any alternative, producing only one trigger per event.
     */
    | { anyOf: [EventPattern, EventPattern, ...EventPattern[]] }
    | { event: "Challenge" | "After Challenge"; attacker?: CardSelection; defender?: CardSelection; when?: Condition }
    | {
          event: "Deal Damage" | "Put Damage" | "Remove Damage";
          card?: CardSelection;
          source?: CardSelection;
          /** The player responsible ("whenever you remove 1 or more damage", Grand Pabbie). */
          player?: PlayerSelection;
          kind?: "Challenge" | "Ability" | "Action";
          when?: Condition;
      }
    | { event: "Draw" | "Gain Lore" | "Lose Lore" | "Remove Ink Drop"; player?: PlayerSelection; when?: Condition }
    | { event: "Turn Start" | "Turn End"; player?: PlayerSelection; when?: Condition }
    | { event: "Move To Location"; card?: CardSelection; location?: CardSelection; when?: Condition }
    /**
     * Every physical card changing zone emits this, including discard/banish/play.
     */
    | {
          event: "Move Card";
          card?: CardSelection;
          player?: PlayerSelection;
          from?: Zone;
          to?: Zone;
          /** "Whenever you put 1 or more cards ...": cards moved together trigger once (Mamá Coco - Visiting the Park). */
          batch?: true;
          when?: Condition;
      };

/**
 * Cost To Sing is a character's effective singing value, not its play cost.
 */
export type Stat = "Strength" | "Willpower" | "Lore" | "Cost To Sing";

/** Numeric card values that instructions can read, not necessarily change. */
export type Characteristic = Stat | "Cost" | "Damage" | "Cards Under";

/**
 * Areas to search for cards. Under selects cards beneath another card, not cards directly in play.
 */
export type Zone = "Play" | "Hand" | "Deck" | "Discard" | "Inkwell" | "Under";

/**
 * Prohibitions override permissions. Even mandatory actions must be legal.
 */
export type CardRestriction =
    | "Can't Quest"
    | "Can't Challenge"
    | "Can't Move"
    | "Can't Sing"
    | "Can't Ready"
    | "Can't Ready At Start Of Turn"
    | "Can't Be Challenged"
    | "Can't Be Dealt Damage"
    | "Can't Be Chosen"
    | "Must Quest"
    | "Can't Gain Keyword"
    | "Can't Remove Damage"
    | "Can't Sing Without Sing Together"
    | "Must Be Chosen"
    /** Cannot be played from any zone, e.g. while a printed play requirement is unmet. */
    | "Can't Be Played";

export type CardPermission = "Can Challenge Ready Characters" | "Can Quest The Turn Played";

/** Battleground abilities exist only in Illumineer's Quest scenarios. */
export type PlayerRestriction = "Can't Play" | "Can't Gain Lore" | "Can't Lose Lore" | "Can't Use Battleground Abilities";

export type PlayerPermission = "Can Ink From Discard" | "Can Play From Discard" | "Can Play From Under";

/**
 * Relative players are interpreted from the ability's acting player, not the active player.
 */
export type PlayerSelection =
    | "You"
    | "Opponents"
    | "Teammates"
    | "All"
    | "Selected Player"
    | { ownerOf: CardSelection }
    | { event: "Player" }
    /**
     * where/rank bind Selected Player to each candidate, locally. Ranking
     * retains all ties and preserves the input's order.
     */
    | { from: PlayerSelection; where?: Condition; rank?: { order: "Highest"; by: Amount } }
    /**
     * The players decide or pay as one group, e.g. "the opposing players together
     * choose" (Tamatoa - Grabby Crab). Used where a single player would decide.
     */
    | { together: PlayerSelection }
    /**
     * Concrete operands in resolved lasting rules, not catalog definitions.
     */
    | { players: PlayerNumber[] }
    /**
     * Freeze this operand when a lasting rule is created.
     */
    | { capture: PlayerSelection };

/**
 * A set of cards. Choosing from it is a separate instruction.
 */
export type CardSelection =
    | "Self"
    /**
     * The individual card receiving a modifier, not the ability source.
     */
    | "Affected Card"
    | "Selected Cards"
    /**
     * The immediately enclosing selection, e.g. the source of moved damage.
     */
    | "Parent Selected Cards"
    | CardSelector
    | { result: CardResult }
    | { event: "Card" | "Attacker" | "Defender" | "Location" | "Song" | "Singers" | "Under" }
    /**
     * Current challenge participants, also available to continuous rules.
     * Refers to the current challenge rather than a past event. Empty outside a challenge.
     */
    | { challengeParticipant: "Attacker" | "Defender" }
    /**
     * Returns each location occupied by these characters once. Characters without a location are ignored.
     */
    | { locationOf: CardSelection }
    /**
     * Select physical cards from the triggering event's retained position.
     * Movement still acts on those cards in the current position.
     */
    | { atEvent: "Before"; cards: CardSelection }
    /**
     * Cards participating in matching recorded events, deduplicated in event order.
     */
    | { events: EventPattern; during: "This Turn"; role?: "Card" | "Attacker" | "Defender" | "Song" | "Singers" }
    | { union: CardSelection[] }
    | { filter: CardSelection; where: CardFilter }
    /**
     * Concrete physical cards in resolved lasting rules.
     */
    | { cards: CardIdentifier[] }
    /**
     * Captures a value from the enclosing context. Without a capture, event references
     * inside a new rule refer to that rule's own event.
     */
    | { capture: CardSelection }
    /**
     * Set subtraction by physical card identity, preserving the first set's order.
     */
    | { difference: [CardSelection, CardSelection] };

/**
 * A live zone query, not a target choice. Choose Cards chooses from this set.
 */
export interface CardSelector {
    zone: Zone | "Any";
    /**
     * Omitted: every player.
     */
    player?: PlayerSelection;
    cardType?: "Character" | "Item" | "Location" | "Action";
    where?: CardFilter;
    exclude?: CardSelection;
    /**
     * Under-zone only: the card the selected cards are beneath.
     */
    under?: CardSelection;
    /**
     * Selects the first N cards in zone order. For a deck, these are the top N cards, not a random sample.
     */
    take?: Amount;
    /**
     * Selects from the top or bottom of a deck, preserving card order. Defaults to Top.
     */
    position?: "Top" | "Bottom";
    /**
     * Limits the query to these physical cards. Targets that have left play are excluded.
     */
    cards?: CardIdentifier[];
}

/**
 * Fields combine with AND. Empty filters match everything. Characteristics are effective values.
 */
export interface CardFilter {
    zone?: Zone;
    /** Controlled by one of these players. */
    player?: PlayerSelection;
    name?: string;
    /**
     * Compare character names, not full name/version or physical identity.
     */
    sameNameAs?: CardSelection;
    /**
     * Match a legal printed name supplied by Name Card, including a team card's
     * individual names. Version/subtitle is not part of this name.
     */
    namedCard?: "Named Card";
    cardType?: "Character" | "Item" | "Location" | "Action";
    song?: boolean;
    inkable?: boolean;
    /** Matches either ink of a dual-ink card. */
    inkType?: "Amber" | "Amethyst" | "Emerald" | "Ruby" | "Sapphire" | "Steel";
    classification?: Subtype;
    keyword?: Keyword;
    cost?: Comparison;
    moveCost?: Comparison;
    strength?: Comparison;
    willpower?: Comparison;
    lore?: Comparison;
    damage?: Comparison;
    cardsUnder?: Comparison;
    faceDown?: boolean;
    exerted?: boolean;
    at?: CardSelection;
    and?: CardFilter[];
    or?: CardFilter[];
    not?: CardFilter;
}

/** Numeric tests shared by card filters and conditions. */
export type Comparison = { equal: Amount } | { lessThan: Amount } | { atMost: Amount } | { greaterThan: Amount } | { atLeast: Amount };

/**
 * Names for instruction results. These names are fixed rather than chosen by the author.
 */
export type CardResult =
    | "Looked At Cards"
    | "Revealed Cards"
    | "Discarded Cards"
    | "Banished Cards"
    | "Moved Cards"
    | "Paid Cards"
    | "Characters With Damage Removed"
    /** Every card in play a Ready instruction applied to, including any that were already ready. */
    | "Readied Cards";

export type NumericResult = "Damage Removed" | "Damage Moved" | "Lore Lost";

/**
 * Actual instruction results, not requested amounts or identifiers in game state.
 */
export type Amount =
    | number
    | { count: CardSelection }
    /** Ink Type counts the union of inks. A dual-ink card contributes both. */
    | { distinct: "Ink Type"; cards: CardSelection }
    /**
     * Requires exactly one card to read its numeric characteristic.
     */
    | { stat: Characteristic; card: CardSelection; printed?: boolean }
    | { sum: { stat: Characteristic; cards: CardSelection; printed?: boolean } }
    /**
     * Empty groups have no min/max: guard with exists before reading.
     */
    | { highest: { stat: Characteristic; cards: CardSelection; printed?: boolean } }
    | { lowest: { stat: Characteristic; cards: CardSelection; printed?: boolean } }
    | { lore: PlayerSelection }
    /** The number of players, e.g. "if you have 2 or more opponents" (Flippant Taunt). */
    | { players: PlayerSelection }
    /** Unspent ink drops. Each can be removed to pay 1 ink. */
    | { inkDrops: PlayerSelection }
    | { turnsTaken: PlayerSelection }
    | { result: NumericResult }
    | { event: "Amount" | "Ink Paid" }
    /**
     * Explicit event-time reading, e.g. cards under a character before banishment.
     * Reads facts from an event without copying printed card details into game state.
     */
    | { atEvent: "Before"; value: Amount }
    | { capture: Amount }
    /**
     * Resolution history, not a field in a between-turn GameState.
     */
    | { countEvents: EventPattern; during: "This Turn" }
    | { add: Amount[] }
    | { subtract: [Amount, Amount] }
    | { multiply: [Amount, Amount] }
    | { min: Amount[] }
    | { max: Amount[] };

/**
 * Conditions are evaluated in their enclosing scope. Reading facts from an event must be explicit.
 */
export type Condition =
    | { value: Amount; is: Comparison }
    | { exists: CardSelection }
    /** Belle - Bookworm checks whether any opponent has an empty hand, even when no cards can match. */
    | { existsPlayer: PlayerSelection }
    /**
     * The Selected Player is one of these players, e.g. "another chosen player"
     * chooses from { from: "All", where: { not: { isPlayer: "You" } } }.
     */
    | { isPlayer: PlayerSelection }
    /**
     * Requires a nonempty set. Use exists + filter to test whether any match.
     */
    | { every: CardSelection; where: CardFilter }
    | { differentNames: CardSelection }
    /** Ink Drop: at least one ink drop was removed to pay for this card. */
    | { playedUsing: "Shift" | "Sing" | "Sing Together" | "Ink Drop" }
    | { inChallenge: CardSelection; role?: "Attacker" | "Defender" }
    | { duringTurnOf: PlayerSelection }
    | { atEvent: "Before"; if: Condition }
    | { and: Condition[] }
    | { or: Condition[] }
    | { not: Condition };

/**
 * Describes how long an effect lasts. Resolution converts this to a specific expiration in game state.
 * End Of Challenge requires an active challenge when installed. Unknown invocation
 * contexts (such as generated action effects) must be checked by the evaluator.
 */
export type Duration =
    | { until: "End Of Turn" | "End Of Challenge" }
    | { until: "Start Of Next Turn" | "End Of Next Turn"; player: PlayerSelection }
    /**
     * Starts at the player's next turn and expires at its end (John Silver - Alien Pirate).
     */
    | { duringNextTurn: PlayerSelection }
    /**
     * Binds exactly one source now and ends on its departure, even if it returns later.
     * The Magic Feather grants Evasive only while the item remains in play.
     */
    | { whileInPlay: CardSelection };

/**
 * Definitions can calculate amounts, but resolved modifiers store numbers.
 * Active stat changes are added together before minimum values are applied.
 * Ability/keyword suppression masks matching printed and gained abilities while active.
 */
export type CardChange =
    /**
     * `when` limits the change to moments the affected card meets it, e.g.
     * Olympus Would Be That Way's +3 strength only while challenging a location.
     */
    | { stat: Stat; amount: Amount; when?: Condition }
    | { gainKeyword: SimpleKeyword; amount?: never }
    | { gainKeyword: NumericKeyword; amount: Amount }
    /**
     * Suppresses printed and gained instances while active.
     * Shift/Boost grants instead use gainAbility with a complete KeywordAbility.
     */
    | { loseKeyword: Exclude<Keyword, "Sing Together"> }
    | { gainClassification: Subtype }
    | { inkable: boolean }
    /**
     * `by` is the other card involved: the challenger for Can't Be Challenged,
     * the challenged card for Can't Challenge.
     */
    | { restriction: CardRestriction; keyword?: Exclude<Keyword, "Sing Together">; by?: CardFilter; byPlayer?: PlayerSelection; when?: Condition }
    /** `where` limits the cards the permission applies to, e.g. only ready Villain characters. */
    | { permission: CardPermission; where?: CardFilter }
    /**
     * Consumed by Deal Damage, not Put/Move Damage (Rapunzel - Ready for Adventure).
     * Does not depend on Rapunzel remaining in play.
     */
    | { preventDamage: "Next" }
    /**
     * An independent occurrence with its own limit (Bruno Madrigal - Out of the Shadows).
     */
    | { gainAbility: GrantedAbility }
    /**
     * Suppresses printed and gained abilities without deleting them.
     * Angela - Night Warrior suppresses Stone by Day until her rule ends.
     */
    | { loseAbility: "All" | { name: string } }
    /**
     * Supplements names without changing catalog identity (Turbo's Shift eligibility).
     */
    | { countsAsName: string; for?: "Shift" }
    /**
     * Floors the final modified value, e.g. Elisa Maza - Transformed Gargoyle's strength.
     */
    | { minimumStat: Stat; amount: Amount };

export type PlayerChange =
    /**
     * Skips the normal draw step. Card effects can still draw cards.
     */
    | { skipDrawStep: true }
    | { restriction: "Can't Play"; where?: CardFilter }
    | { restriction: Exclude<PlayerRestriction, "Can't Play">; where?: never }
    | { permission: PlayerPermission; cards?: CardSelection; exerted?: boolean }
    | { additionalInk: number }
    /**
     * Caps turn-start readying, not effect readying (Marshmallow - Cranky Climber).
     */
    | { readyLimit: number }
    /** Cards put into these players' inkwells enter exerted (Daisy Duck - Paranormal Investigator). */
    | { inkEntersExerted: true }
    /**
     * The named players share a limit on how many characters challenge. Readying
     * a challenger does not create a new character (Prince Charming - Protector of the Realm).
     */
    | { challengeLimit: number; count: "Characters"; players: PlayerSelection }
    /**
     * Changed winning threshold, not a cached result (Donald Duck - Flustered Sorcerer).
     */
    | { victoryLore: number };

/**
 * Rules reevaluate their selectors, amounts and conditions while active. No one-shot operations.
 */
export type ContinuousRule =
    | { type: "Together"; rules: ContinuousRule[] }
    /**
     * Continuous public visibility, not repeated Reveal operations (Roz - Always Watching).
     */
    | { type: "Reveal Cards"; cards: CardSelection }
    | { type: "Modify Cards"; cards: CardSelection; modifier: CardChange }
    | { type: "Modify Players"; players: PlayerSelection; modifier: PlayerChange }
    /**
     * Includes Shift. Use for Shift below for a Shift-only change with optional base filtering.
     */
    | { type: "Modify Cost"; cards: CardSelection; amount: Amount; for: "Play"; optional?: boolean }
    | { type: "Modify Cost"; cards: CardSelection; amount: Amount; for: "Move"; location?: CardSelection; optional?: boolean }
    /**
     * Onto filters the characters proposed for Shift. Applies once per rule, not once per matching character.
     */
    | { type: "Modify Cost"; cards: CardSelection; amount: Amount; for: "Shift"; onto?: CardSelection; optional?: boolean }
    /**
     * Override printed base eligibility (including Shift variants), not base count,
     * payment or unrelated play requirements (Morph - Little Imitator).
     */
    | { type: "Can Shift Onto"; cards: CardSelection; onto: CardSelection }
    | { type: "Additional Cost"; cards: CardSelection; for: ("Quest" | "Challenge")[]; cost: Cost[] }
    | { type: "Alternate Cost"; cards: CardSelection; for: "Play"; cost: Cost[] }
    | { type: "Alternate Cost"; cards: CardSelection; for: "Shift"; onto?: CardSelection; cost: Cost[] }
    | { type: "Alternate Cost"; cards: CardSelection; for: "Move"; location?: CardSelection; cost: Cost[] }
    /**
     * Permission to waive an activated/Boost ability's costs except exerting its
     * source (Maui's Fish Hook). Name selects a printed activated ability title.
     * Keyword selects Boost. Omit both to cover all activated/Boost abilities.
     */
    | { type: "Free Ability"; cards: CardSelection; name?: string; keyword?: never }
    | { type: "Free Ability"; cards: CardSelection; keyword: "Boost"; name?: never }
    /**
     * Uses another stat for challenge damage, before prevention/replacement.
     * Dale - Ready for His Shot uses willpower during challenges.
     */
    | { type: "Challenge Damage"; cards: CardSelection; stat: Stat }
    /**
     * Applies before the card enters play. The modifier can outlast this rule, as with Powhatan's Staff.
     */
    | {
          type: "Enter Play"; cards: CardSelection; exerted?: boolean; damage?: Amount; modifier?: CardChange; duration?: Duration;
          /** The player may decline, as with "This character may enter play exerted." */
          optional?: boolean;
          /**
           * Resolves once after the card enters play this way (Lord MacGuffin:
           * "may enter play exerted to deal 3 damage to chosen damaged character").
           */
          then?: Effect;
      }
    | { type: "Conditional"; if: Condition; then: ContinuousRule; otherwise?: ContinuousRule };

/**
 * Match a proposed event before it occurs. `instead` replaces it, not a trigger
 * queued after it. Omitted instead prevents it. Engine rules decide applicability
 * and ordering. This definition does not introduce a separate replacement order.
 */
export type Replacement =
    | {
          event: EventPattern;
          instead?: Effect;
          damage?: never;
          optional?: boolean;
          /**
           * Counts the first N matching events, not events chosen later.
           */
          limit?: OccurrencesLimit;
      }
    | {
          event: EventPattern;
          /**
           * Adjust the proposed event, retaining its source/kind. Not a new
           * Deal Damage instruction attributed to this replacement's source.
           */
          damage: { amount: Amount };
          instead?: never;
          optional?: boolean;
          limit?: OccurrencesLimit;
      };

/**
 * Instructions resolve in order, doing as much as possible under Lorcana rules.
 * Choices and iteration supply Selected Cards/Selected Player inside their nested
 * instructions. Nested choices temporarily replace, then restore, that selection.
 * Results use fixed aliases and are available to later instructions in the same
 * sequence. References must be checked for availability before execution.
 */
export type Effect =
    | { type: "Sequence"; effects: Effect[] }
    | { type: "Choose Mode"; options: Effect[]; player?: PlayerSelection }
    /**
     * Only alternatives that can be chosen under rule 6.1.5.2 are offered.
     */
    | { type: "Or"; options: Effect[]; player?: PlayerSelection }
    /**
     * Continues only if `do` was fully performed. Any partial changes remain in place.
     * Dale - Mischievous Ranger must mill all three cards before the debuff.
     */
    | { type: "Do Then"; do: Effect; then: Effect; otherwise?: Effect }
    /**
     * Publishes the results of the instruction. Declining replaces older results with empty lists or zero.
     * Baymax - Armored Companion heals optionally, then gains lore for damage removed.
     */
    | { type: "Optional"; effect: Effect; player?: PlayerSelection }
    | { type: "Conditional"; if: Condition; then: Effect; otherwise?: Effect }
    | {
          type: "Choose Cards";
          from: CardSelection;
          count: Amount | { upTo: Amount } | "Any";
          /**
           * Validate the prospective Selected Cards as a whole before committing.
           */
          where?: Condition;
          player?: PlayerSelection;
          effect: Effect;
      }
    /**
     * Sampling is not choosing, so it does not invoke chosen-target restrictions.
     */
    | { type: "Random Cards"; from: CardSelection; count: Amount; effect: Effect }
    | { type: "Choose Player"; from: PlayerSelection; effect: Effect; player?: PlayerSelection }
    | { type: "For Each Player"; players: PlayerSelection; effect: Effect }
    | { type: "For Each Card"; cards: CardSelection; effect: Effect }
    /**
     * Repeats a bounded number of times. Each iteration keeps its results local.
     */
    | { type: "Repeat"; times: Amount; until?: never; effect: Effect }
    /**
     * Checks each iteration's results before repeating. Stops when there is no more work to do.
     * Sisu - Uniting Dragon repeats while a Dragon is put into hand.
     */
    | { type: "Repeat"; until: Condition; times?: never; effect: Effect }
    /**
     * Requires full payment before committing, unlike partial resolving effects.
     * Handles ink payments. Use Do Then for sequential instructions that are not payments.
     * Wrap in Optional when the player may decline payment.
     */
    | { type: "Pay Cost"; cost: Cost[]; then: Effect; otherwise?: Effect; player?: PlayerSelection }
    | { type: "Draw"; player: PlayerSelection; amount: Amount; from?: "Bottom" }
    | { type: "Gain Lore" | "Lose Lore"; player: PlayerSelection; amount: Amount }
    /** Ink drops are a resource that can be removed to pay 1 ink each. */
    | { type: "Gain Ink Drops"; player: PlayerSelection; amount: Amount }
    /** The acting player takes control of these cards (Illumineer's Quest: "steals The Reforged Crown"). */
    | { type: "Gain Control"; cards: CardSelection }
    | { type: "Discard" | "Banish" | "Exert" | "Ready"; cards: CardSelection }
    | { type: "Deal Damage"; cards: CardSelection; amount: Amount; ignoreResist?: boolean }
    /**
     * Places damage counters without dealing damage, bypassing Resist and damage prevention.
     */
    | { type: "Put Damage"; cards: CardSelection; amount: Amount }
    /**
     * Total shares one damage-removal budget across all cards. Otherwise, each card gets its own budget.
     * Example: I'm Never Not by Your Side.
     */
    | { type: "Remove Damage"; cards: CardSelection; amount: Amount | { upTo: Amount } | "All"; distribution?: "Total" }
    /**
     * Moves counters from one card to another without dealing damage.
     * Example: Belle - Accomplished Mystic.
     */
    | { type: "Move Damage"; from: CardSelection; to: CardSelection; amount: Amount | { upTo: Amount } }
    | {
          type: "Move Card";
          cards: CardSelection;
          /**
           * To each card's owner's zone, not necessarily the acting player's.
           */
          to: "Hand" | "Discard";
          wholeStack?: boolean;
      }
    | { type: "Move Card"; cards: CardSelection; to: "Inkwell"; exerted?: boolean; wholeStack?: boolean }
    | {
          type: "Move Card";
          cards: CardSelection;
          to: "Deck";
          position: "Top" | "Bottom";
          /**
           * Chosen order is chosen by the acting player, not the deck's owner.
           */
          order?: "Chosen" | "Random";
          /**
           * Defaults to the acting player, regardless of who owns the destination.
           */
          player?: PlayerSelection;
          wholeStack?: boolean;
      }
    | { type: "Move Card"; cards: CardSelection; to: "Deck"; position: "Shuffle"; wholeStack?: boolean }
    | { type: "Move Card"; cards: CardSelection; to: "Under"; under: CardSelection; faceDown: boolean; wholeStack?: boolean }
    /**
     * Plays the selected cards. Optional offers the choice, and Do Then handles
     * instructions that depend on successful play.
     */
    | {
          type: "Play";
          cards: CardSelection;
          free?: boolean;
          exerted?: boolean;
          method?: "Shift" | "Play Or Shift";
          /** The player who plays the card and pays its cost. Defaults to the acting player. */
          player?: PlayerSelection;
          /**
           * Redirects the action after its effect finishes, not immediately on play.
           * Ursula - Deceiver of All sends the replayed song to Deck Bottom.
           */
          afterwards?: "Deck Bottom";
      }
    | { type: "Shuffle"; player: PlayerSelection }
    /**
     * Moves characters to one location. Even a calculated destination must identify exactly one card.
     */
    | { type: "Move To Location"; cards: CardSelection; location: CardSelection; free?: boolean }
    /**
     * Look shows cards only to this player, who defaults to You. Reveal shows them to everyone.
     */
    | { type: "Look"; cards: CardSelection; player?: PlayerSelection }
    | { type: "Reveal"; cards: CardSelection }
    /**
     * Searching does not choose a target. A failed search can leave matching cards hidden.
     */
    | { type: "Search"; from: CardSelector; count: Amount | { upTo: Amount }; effect: Effect }
    /**
     * Reveals through the first match or deck exhaustion (Fred - Giant-Sized).
     */
    | { type: "Reveal Until"; player: PlayerSelection; where: CardFilter }
    | { type: "Name Card"; player?: PlayerSelection }
    /**
     * Freeze affected cards and computed changes at resolution (e.g. Kida).
     */
    | { type: "Modify Cards"; cards: CardSelection; modifier: CardChange; duration?: Duration }
    /**
     * Freezes the affected players and installs their changes at resolution.
     * Use Create Rule for live queries that also affect future characters.
     */
    | { type: "Modify Players"; players: PlayerSelection; modifier: PlayerChange; duration?: Duration }
    /**
     * Independent rule with outer references captured before storage.
     * Installation retains its source card, player and cause in the state modifier.
     * Lantern creates a one-use discount for the next character played this turn.
     */
    | { type: "Create Rule"; rule: ContinuousRule; duration?: Duration; uses?: number }
    /**
     * Future listener: event references bind to the future event, not the creating event.
     * Capture explicitly when it needs a target chosen now.
     * Its creating source remains available for attribution after that card leaves play.
     */
    | { type: "Create Trigger"; trigger: EventPattern; effect: Effect; duration?: Duration; uses?: number }
    /**
     * Schedules instructions to run once at the next specified boundary, using a stored trigger.
     * Temporary Shift delays returning only the shifted top card until turn end.
     */
    | { type: "Delay"; until: { turnEnd: PlayerSelection }; effect: Effect };

/**
 * Machine-readable play rules. Execution does not interpret printed card text.
 */
export type PlayRule =
    | { type: "Sing" | "Sing Together"; cost: number }
    | { type: "Alternate Cost"; cost: Cost[]; when?: Condition }
    | { type: "Requirement"; when: Condition };

/**
 * Actions have effects. Characters, items and locations have abilities.
 * For non-actions, abilities[i] corresponds to catalog abilities[i], including
 * deck-construction rules. Each printed ability becomes one entry in catalog
 * order, without dropping or splitting it.
 * Action instructions instead become effect and playRules, including Sing Together.
 */
export type CardRules =
    /**
     * Action abilities work outside play, such as a cost reduction in hand or
     * Look What You've Done's replay from the discard.
     */
    | { type: "Action"; effect: Effect; playRules?: PlayRule[]; abilities?: Ability[] }
    | { type: "Character" | "Item" | "Location"; abilities: Ability[]; playRules?: Exclude<PlayRule, { type: "Sing" | "Sing Together" }>[] };
