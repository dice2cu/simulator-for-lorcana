import type { Ability, Effect, PlayRule } from "./ability";
import type { Subtype } from "./identity";

/** An immutable card definition, not a physical card or its current game state. */
export type Card = CharacterCard | ActionCard | ItemCard | LocationCard;

/** Printed properties shared by every card type. */
export interface CardBase {
    /** Exact full card name, such as "Merlin - Goat". Matches CardIdentifier.fullName. */
    readonly fullName: string;
    /**
     * Complete printed rules text for display, including ability titles,
     * reminder text and line breaks. Omitted for cards with no rules text.
     * Gameplay uses the parsed abilities and effects instead.
     */
    readonly fullText?: string;
    /**
     * Printed names without subtitles, such as ["Merlin"]. Duo cards have two
     * names, such as ["Mickey Mouse", "Minnie Mouse"], for name-matching rules.
     */
    readonly names: readonly [string, ...string[]];
    /** One ink color normally, two for dual-ink cards. Empty for inkless scenario cards. */
    readonly colors: readonly ("Amber" | "Amethyst" | "Emerald" | "Ruby" | "Sapphire" | "Steel")[];
    readonly cost: number;
    /** Whether the printed card can be placed in the inkwell normally. */
    readonly inkwell: boolean;
    /** Printed classifications, such as Storyborn, Sorcerer or Song. */
    readonly subtypes: readonly Subtype[];
}

export interface ActionCard extends CardBase {
    readonly type: "Action";
    /** Instructions resolved when the action is played. */
    readonly effect: Effect;
    /** Includes singing costs for songs, alternate costs and requirements. */
    readonly playRules?: readonly PlayRule[];
    /**
     * Abilities that work outside play, such as a cost reduction in hand or a
     * replay from the discard. Omitted when the action has none.
     */
    readonly abilities?: readonly Ability[];
}

export interface NonActionCard extends CardBase {
    /** One parsed entry per printed ability, in order. Omitted when the card has none. */
    readonly abilities?: readonly Ability[];
    /** Alternate costs and requirements, when applicable. */
    readonly playRules?: readonly Exclude<PlayRule, { type: "Sing" | "Sing Together" }>[];
}

export interface CharacterCard extends NonActionCard {
    readonly type: "Character";
    readonly strength: number;
    readonly willpower: number;
    /** Lore gained by questing before game effects change it. */
    readonly lore: number;
}

export interface ItemCard extends NonActionCard {
    readonly type: "Item";
}

export interface LocationCard extends NonActionCard {
    readonly type: "Location";
    readonly willpower: number;
    /** Lore gained at the start of its controller's turn. */
    readonly lore: number;
    /** Ink cost to move one character to this location normally. */
    readonly moveCost: number;
}
