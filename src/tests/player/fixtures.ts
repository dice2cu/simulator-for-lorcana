import { getCard } from "../../cards";
import type { Card } from "../../model/card";
import type { Effect } from "../../model/ability";
import type { CardState, GameState, PlayerPosition } from "../../model/game-state";
import type { CardIdentifier, PlayerNumber } from "../../model/identity";
import type { Rules } from "../../engine/rules";

export function emptyPlayer(): PlayerPosition {
    return { lore: 0, turnsTaken: 0, deck: [], hand: [], play: [], discard: [], inkwell: [] };
}

export function cardIds(catalog: ReturnType<typeof testCards>, cards: readonly (string | Card)[]): CardIdentifier[] {
    return cards.map((card) => catalog.create(card));
}

export function cardStates(
    catalog: ReturnType<typeof testCards>,
    cards: readonly (string | Card | { definition: string | Card; damage?: number; exerted?: boolean; drying?: boolean })[],
    exerted = false,
): CardState[] {
    return cards.map((value) => {
        if (typeof value === "object" && "definition" in value)
            return { card: catalog.create(value.definition), damage: value.damage ?? 0, exerted: value.exerted ?? exerted, drying: value.drying ?? false };
        return { card: catalog.create(value), damage: 0, exerted, drying: false };
    });
}

/** Each test owns its physical identities and any deliberately overridden definitions. */
export function testCards() {
    const definitions = new Map<string, Card>();
    const instances: CardIdentifier[] = [];
    const definition = (fullName: string): Card => {
        const card = definitions.get(fullName) ?? getCard(fullName);
        if (!card) throw new Error(`Missing test card: ${fullName}`);
        return card;
    };
    return {
        definitions,
        definition,
        lookup: (name: string) => definitions.get(name) ?? getCard(name),
        create(value: string | Card): CardIdentifier {
            if (typeof value !== "string") definitions.set(value.fullName, value);
            const fullName = typeof value === "string" ? value : value.fullName;
            definition(fullName);
            const card = { fullName, i: instances.length + 1 };
            instances.push(card);
            return card;
        },
        /** Refers to a fixture already created in this test, not to a deck copy number. */
        instance(i: number): CardIdentifier {
            const card = instances[i - 1];
            if (!card) throw new Error(`Missing physical test card ${i}`);
            return card;
        },
        fixture(card: Card): Card {
            const printed = getCard(card.fullName);
            if (printed && printed.type !== card.type) throw new Error("Fixture changes the printed card type");
            return { ...printed, ...card } as Card;
        },
    };
}

export function playerAt(state: GameState, player: PlayerNumber): PlayerPosition {
    const position = state.players[player];
    if (!position) throw new Error(`Missing player ${player}`);
    return position;
}

export function inPlay(rules: Rules, card: CardIdentifier): CardState {
    const state = rules.locate(card)?.state;
    if (!state) throw new Error(`Card is not in play: ${card.fullName}`);
    return state;
}

export function printedEffect(card: Card, ability?: number): Effect {
    if (ability === undefined) {
        if (card.type !== "Action") throw new Error("Expected an action instruction");
        return card.effect;
    }
    const printed = card.abilities?.[ability];
    if (!printed || (printed.type !== "Triggered" && printed.type !== "Activated")) throw new Error("Expected a printed instruction");
    return printed.effect;
}

export function keywords(rules: Rules, card: CardIdentifier): string[] {
    return (
        [
            "Adventurous",
            "Alert",
            "Bodyguard",
            "Evasive",
            "Reckless",
            "Rush",
            "Support",
            "Vanish",
            "Ward",
            "Challenger",
            "Resist",
            "Singer",
            "Boost",
            "Shift",
        ] as const
    ).filter((name) => rules.keyword(card, name) > 0);
}

export function classifications(rules: Rules, card: CardIdentifier): string[] {
    return [
        ...new Set([
            ...rules.definition(card).subtypes,
            ...rules.modifiers(card).flatMap((modifier) => ("gainClassification" in modifier ? [modifier.gainClassification] : [])),
        ]),
    ];
}

export function isExerted(rules: Rules, card: CardIdentifier): boolean {
    const location = rules.locate(card);
    if (location?.zone === "Play") return Boolean(location.state?.exerted);
    if (location?.zone === "Inkwell")
        return Boolean(rules.player(location.player).inkwell.find((ink) => ink.card.i === card.i && ink.card.fullName === card.fullName)?.exerted);
    throw new Error("Exertion queried outside play or the inkwell");
}
