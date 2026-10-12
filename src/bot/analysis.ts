import type { CardFilter } from "../model/ability";
import type { DeckKnowledge } from "../model/bot";
import type { Card } from "../model/card";
import type { PlayerNumber } from "../model/identity";
import type { DeckListEntry } from "../model/player-interaction";
import type { Strategy } from "../model/strategy";
import { getCard } from "../cards";

/** Mechanics read from parsed rules, never from card names or deck names. */
export interface Mechanics {
    ramp: boolean;
    draw: boolean;
    removal: boolean;
    recursion: boolean;
    songPayoff: boolean;
    itemPayoff: boolean;
    /** Names this card's rules refer to, such as Shift bases or partner requirements. */
    names: string[];
    classifications: string[];
}

const mechanicsCache = new WeakMap<Card, Mechanics>();

export function mechanics(card: Card): Mechanics {
    const cached = mechanicsCache.get(card);
    if (cached) return cached;
    const result: Mechanics = { ramp: false, draw: false, removal: false, recursion: false, songPayoff: false, itemPayoff: false, names: [], classifications: [] };
    // hostile: the nearest card selection can pick characters in play that the player does not control.
    const visit = (value: unknown, opposing: boolean, hostile: boolean): void => {
        if (Array.isArray(value)) {
            for (const entry of value) visit(entry, opposing, hostile);
            return;
        }
        if (value === null || typeof value !== "object") return;
        const node = value as Record<string, unknown>;
        const targetsOpponents = opposing || node.player === "Opponents" || node.player === "Opponent";
        const selected = node.cards === "Selected Cards" && hostile;
        if (node.type === "Choose Cards" && node.from && typeof node.from === "object") {
            const from = node.from as Record<string, unknown>;
            hostile = from.zone === "Play" && from.player !== "You" && (from.cardType === undefined || from.cardType === "Character");
        }
        switch (node.type) {
            case "Gain Ink Drops":
                result.ramp = true;
                break;
            case "Move Card":
                if (node.to === "Inkwell") result.ramp = true;
                if (node.to === "Hand" || node.to === "Deck") if (selected || mentionsOpponents(node.cards)) result.removal = true;
                if (mentionsZone(node.cards, "Discard") && (node.to === "Hand" || node.to === "Play")) result.recursion = true;
                break;
            case "Draw":
                if (node.player === "You") result.draw = true;
                break;
            case "Banish":
            case "Deal Damage":
            case "Put Damage":
                if (selected || targetsOpponents || mentionsOpponents(node.cards) || mentionsAnyCharacter(node.cards)) result.removal = true;
                break;
            case "Play":
                if (mentionsZone(node, "Discard")) result.recursion = true;
                break;
        }
        if (node.event === "Sing" || (node.event === "Play" && typeof node.card === "object" && node.card !== null && JSON.stringify(node.card).includes('"song":true')))
            result.songPayoff = true;
        if (node.cardType === "Item" && node.event !== undefined) result.itemPayoff = true;
        if ("additionalInk" in node) result.ramp = true;
        if (typeof node.name === "string" && node.type === undefined) result.names.push(node.name);
        if (typeof node.classification === "string") result.classifications.push(node.classification);
        for (const [field, entry] of Object.entries(node)) if (field !== "name") visit(entry, targetsOpponents && field !== "then", hostile);
    };
    visit(card.type === "Action" ? [card.effect, card.abilities ?? []] : (card.abilities ?? []), false, false);
    for (const ability of card.abilities ?? []) if (ability.type === "Keyword" && ability.keyword.name === "Shift") result.names.push(...shiftNames(ability.keyword));
    result.names = [...new Set(result.names)];
    result.classifications = [...new Set(result.classifications)];
    mechanicsCache.set(card, result);
    return result;
}

function shiftNames(shift: object): string[] {
    const names: string[] = [];
    const visit = (value: unknown): void => {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === "object")
            for (const [field, entry] of Object.entries(value)) {
                if (field === "name" && typeof entry === "string") names.push(entry);
                else visit(entry);
            }
    };
    visit(shift);
    return names;
}

function mentionsOpponents(value: unknown): boolean {
    return JSON.stringify(value ?? null).includes('"Opponents"');
}

function mentionsAnyCharacter(value: unknown): boolean {
    const text = JSON.stringify(value ?? null);
    return text.includes('"cardType":"Character"') && !text.includes('"player":"You"');
}

function mentionsZone(value: unknown, zone: string): boolean {
    return JSON.stringify(value ?? null).includes(`"zone":"${zone}"`);
}

/** Expands a deck list to definitions, skipping names missing from the catalog. */
export function definitions(deck: readonly DeckListEntry[]): { card: Card; count: number }[] {
    return deck.flatMap((entry) => {
        const card = getCard(entry.fullName);
        return card ? [{ card, count: entry.count }] : [];
    });
}

/**
 * deck + permitted opponent knowledge -> Strategy. A mixture of objectives, not
 * an archetype label. Relationships come from parsed mechanics only.
 */
export function analyzeDeck(deck: readonly DeckListEntry[], opponents: Readonly<Partial<Record<PlayerNumber, DeckKnowledge>>> = {}): Strategy {
    const cards = definitions(deck);
    const total = Math.max(1, cards.reduce((sum, entry) => sum + entry.count, 0));
    const share = (test: (card: Card) => boolean): number => cards.reduce((sum, entry) => sum + (test(entry.card) ? entry.count : 0), 0) / total;
    const characters = cards.filter((entry) => entry.card.type === "Character");
    const characterCount = characters.reduce((sum, entry) => sum + entry.count, 0);
    const average = (value: (card: Card) => number): number =>
        characterCount ? characters.reduce((sum, entry) => sum + value(entry.card) * entry.count, 0) / characterCount : 0;
    const lore = average((card) => (card.type === "Character" ? card.lore : 0));
    const strength = average((card) => (card.type === "Character" ? card.strength : 0));
    const costs = cards.flatMap((entry) => Array<number>(entry.count).fill(entry.card.cost)).sort((a, b) => a - b);
    const high = costs[Math.floor(costs.length * 0.85)] ?? 4;
    const ramp = share((card) => mechanics(card).ramp),
        draw = share((card) => mechanics(card).draw),
        removal = share((card) => mechanics(card).removal),
        expensive = share((card) => card.cost >= 6);

    const opposingRemoval = Object.values(opponents).some((known) => known && definitions(known.cards).some((entry) => mechanics(entry.card).removal));
    const strategy: Strategy = {
        priorities: {
            lore: 1 + lore * 0.6,
            boardControl: 0.6 + removal * 3 + strength / 8,
            cards: 0.4 + draw * 3,
            ink: 0.4 + ramp * 3 + expensive * 2,
            development: 0.6 + (characterCount / total) * 1.2,
        },
        resources: {
            targetInk: Math.max(4, Math.min(8, high + (ramp > 0.1 ? 1 : 0))),
            preserve: preservation(cards),
        },
        synergies: synergies(cards),
        caution: opposingRemoval ? 0.45 : 0.3,
    };
    return strategy;
}

/** Cards that other cards in the deck need by name, such as Shift bases. */
function preservation(cards: readonly { card: Card; count: number }[]): Strategy["resources"]["preserve"] {
    const needed = new Map<string, number>();
    for (const { card } of cards) for (const name of mechanics(card).names) if (!card.names.includes(name)) needed.set(name, (needed.get(name) ?? 0) + 1);
    return [...needed]
        .filter(([name]) => cards.some(({ card }) => card.names.includes(name)))
        .map(([name, references]) => ({ cards: { name } as CardFilter, importance: Math.min(1, 0.4 + references * 0.15), copies: 1 }));
}

function synergies(cards: readonly { card: Card; count: number }[]): Strategy["synergies"] {
    const result: Strategy["synergies"][number][] = [];
    const has = (test: (card: Card) => boolean): number => cards.reduce((sum, entry) => sum + (test(entry.card) ? entry.count : 0), 0);
    const songs = has((card) => card.subtypes.includes("Song"));
    const singers = has((card) => (card.abilities ?? []).some((ability) => ability.type === "Keyword" && ability.keyword.name === "Singer"));
    if (songs >= 4 && singers >= 4) result.push({ enablers: [{ keyword: "Singer" }], payoffs: [{ song: true }], importance: Math.min(1, (songs + singers) / 24) });
    const songPayoffs = has((card) => mechanics(card).songPayoff);
    if (songs >= 4 && songPayoffs) result.push({ enablers: [{ song: true }], payoffs: [{ cardType: "Character", cost: { atLeast: 0 } }], importance: Math.min(1, songPayoffs / 8) });
    const ramp = has((card) => mechanics(card).ramp),
        expensive = has((card) => card.cost >= 6);
    if (ramp >= 4 && expensive >= 4) result.push({ enablers: [{ cost: { atMost: 4 } }], payoffs: [{ cost: { atLeast: 6 } }], importance: Math.min(1, (ramp + expensive) / 20) });
    const recursion = has((card) => mechanics(card).recursion);
    if (recursion >= 3) result.push({ enablers: [{ cardType: "Character" }], payoffs: [{ cardType: "Character" }], importance: Math.min(1, recursion / 10) });
    const items = has((card) => card.type === "Item"),
        itemPayoffs = has((card) => mechanics(card).itemPayoff);
    if (items >= 6 && itemPayoffs >= 3) result.push({ enablers: [{ cardType: "Item" }], payoffs: [{ cardType: "Character" }], importance: Math.min(1, (items + itemPayoffs) / 20) });
    const classifications = new Map<string, number>();
    for (const { card, count } of cards) for (const classification of mechanics(card).classifications) classifications.set(classification, (classifications.get(classification) ?? 0) + count);
    for (const [classification, references] of classifications) {
        const bodies = has((card) => (card.subtypes as readonly string[]).includes(classification));
        if (references >= 3 && bodies >= 8)
            result.push({ enablers: [{ classification } as CardFilter], payoffs: [{ classification } as CardFilter], importance: Math.min(1, (references + bodies) / 30) });
    }
    return result;
}

/** Names a Name Card answer can use. Dual-name cards such as Chip 'n' Dale have two. */
export function printedNames(fullName: string): readonly string[] {
    return getCard(fullName)?.names ?? [fullName.split(" - ")[0]];
}
