import type { CardFilter, CardSelection, Comparison, Condition, EventPattern, PlayerSelection } from "../model/ability";
import { type Parser, type Step, nextId, playerRef } from "./core";
import { type CardNP, bareCards, cardNP, cardsReference, classification, comparisonSuffix, digits, it, nameList, number, statSymbol } from "./nouns";

function count(cards: CardSelection, is: Comparison): Condition {
    return { value: { count: cards }, is };
}

function thisTurn(pattern: EventPattern, is: Comparison = { atLeast: 1 }): Condition {
    return { value: { countEvents: pattern, during: "This Turn" }, is };
}

/** Widen a play-zone selector so it also matches cards that have since left play. */
export function anyZone(cards: CardSelection): CardSelection {
    if (typeof cards === "object" && "zone" in cards && cards.zone === "Play") return { ...cards, zone: "Any" };
    return cards;
}

/** Quantities before a noun: "2 or more", "no", "a", "fewer than 3". */
function quantity(c: Parser): Comparison | undefined {
    return c.try((): Comparison | undefined => {
        if (c.lit("no")) return { equal: 0 };
        if (c.lit("fewer than", "less than")) {
            const n = digits(c);
            return n === undefined ? undefined : { lessThan: n };
        }
        if (c.lit("more than")) {
            const n = digits(c);
            return n === undefined ? undefined : { greaterThan: n };
        }
        if (c.lit("only")) {
            const n = number(c);
            return n === undefined ? undefined : { equal: n };
        }
        const n = c.try(() => {
            const value = number(c);
            if (value === undefined) return undefined;
            if (c.lit("or more")) return { atLeast: value } as Comparison;
            if (c.lit("or less", "or fewer")) return { atMost: value } as Comparison;
            return undefined;
        });
        if (n) return n;
        if (c.lit("one or more", "1 or more", "any", "a", "an")) return { atLeast: 1 };
        return undefined;
    });
}

/** Cards a player has: "a character named Elsa in play", "3 or more cards in your hand". */
function holding(c: Parser, player: PlayerSelection): Condition | undefined {
    return c.try((): Condition | undefined => {
        if (c.lit("an ink drop")) return { value: { inkDrops: player }, is: { atLeast: 1 } };
        const ink = c.try(() => {
            const n = digits(c);
            if (n === undefined || !c.lit("{I}")) return undefined;
            return comparisonSuffix(c, n);
        });
        if (ink) return count({ zone: "Inkwell", player }, ink);
        const steps: Step[] = [];
        const elided = c.try(() => {
            // "If you have any in play with 10 {S} or more": characters, from the previous sentence.
            if (!c.lit("any in play with")) return undefined;
            const n = digits(c);
            const which = statSymbol(c);
            if (n === undefined || !which) return undefined;
            const comparison = comparisonSuffix(c, n);
            return comparison
                ? count({ zone: "Play", player, cardType: "Character", where: { [which.toLowerCase()]: comparison } }, { atLeast: 1 })
                : undefined;
        });
        if (elided) return elided;
        const both = c.try(() => {
            if (!c.lit("characters named")) return undefined;
            const names = nameList(c);
            if (!names || names.length < 2 || !c.lit("in play")) return undefined;
            return { and: names.map((name) => ({ exists: { zone: "Play", player, cardType: "Character", where: { name } } }) as Condition) } as Condition;
        });
        if (both) return both;
        const another = Boolean(c.lit("another"));
        const is = another
            ? { atLeast: 1 }
            : (quantity(c) ??
              c.try(() => {
                  const n = number(c);
                  return n !== undefined && n > 1 ? ({ atLeast: n } as Comparison) : undefined;
              }));
        if (!is) return undefined;
        const spec = bareCards(c, steps, player);
        if (!spec || steps.length) return undefined;
        if (another) spec.spec.exclude = "Self";
        const strongest = c.try(() => {
            if (!c.lit("with more {S} than each opposing character")) return undefined;
            c.lit("in play");
            return true;
        });
        if (strongest) {
            const opposing = { zone: "Play", player: "Opponents", cardType: "Character" } as const;
            // With no opposing characters, any character satisfies "more than each".
            return {
                or: [
                    { and: [{ not: { exists: opposing } }, { exists: spec.cards() }] },
                    { exists: { filter: spec.cards(), where: { strength: { greaterThan: { highest: { stat: "Strength", cards: opposing } } } } } },
                ],
            };
        }
        if (c.lit("with the highest cost, or tied for highest cost")) {
            return {
                exists: { filter: spec.cards(), where: { cost: { equal: { highest: { stat: "Cost", cards: { zone: "Play", cardType: "Character" } } } } } },
            };
        }
        // "While you have only 1 character here, they get ...": a static rule's "they" means these cards.
        c.state.conditionCards = spec.cards();
        return count(spec.cards(), is);
    });
}

/** "you have more cards in your hand than each opponent". */
function comparedHolding(c: Parser): Condition | undefined {
    return c.try((): Condition | undefined => {
        if (!c.lit("more")) return undefined;
        const steps: Step[] = [];
        const spec = bareCards(c, steps, "You");
        if (!spec || steps.length) return undefined;
        if (!c.lit("than each opponent", "than each opposing player")) return undefined;
        return {
            not: {
                existsPlayer: {
                    from: "Opponents",
                    where: {
                        value: { count: spec.cards("Selected Player") },
                        is: { atLeast: { count: spec.cards() } },
                    },
                },
            },
        };
    });
}

/** Facts about a player, phrased as "<player> has ...". */
function playerHas(c: Parser, player: PlayerSelection): Condition | undefined {
    return c.try((): Condition | undefined => {
        if (c.lit("more lore than you")) return { value: { lore: player }, is: { greaterThan: { lore: "You" } } };
        const lore = c.try(() => {
            const n = digits(c);
            if (n === undefined) return undefined;
            const comparison = comparisonSuffix(c, n);
            return comparison && c.lit("lore") ? comparison : undefined;
        });
        if (lore) return { value: { lore: player }, is: lore };
        const more = c.try(() => {
            if (!c.lit("more")) return undefined;
            const steps: Step[] = [];
            const spec = bareCards(c, steps, player);
            if (!spec || steps.length) return undefined;
            if (!c.lit("than you")) return undefined;
            return { value: { count: spec.cards() }, is: { greaterThan: { count: spec.cards("You") } } } as Condition;
        });
        if (more) return more;
        const list = c.list(() => holding(c, player), ["and", "or"]);
        if (!list) return undefined;
        if (list.length === 1) return list[0];
        return /\bor\b/i.test(c.text.slice(0, c.pos)) && !/\band\b/i.test(c.text.slice(0, c.pos)) ? { or: list } : { and: list };
    });
}

/** Conditions about known cards: "this character is exerted", "it is a character card". */
function cardIs(c: Parser, card: CardSelection): Condition | undefined {
    return c.try((): Condition | undefined => {
        const every = (where: CardFilter): Condition => ({ every: card, where });
        if (c.lit("is exerted")) return every({ exerted: true });
        if (c.lit("is ready")) return every({ exerted: false });
        if (c.lit("has no damage", "is undamaged")) return every({ damage: { equal: 0 } });
        if (c.lit("has damage", "is damaged")) return every({ damage: { atLeast: 1 } });
        if (c.lit("is at a location", "are at a location")) return every({ at: { zone: "Play", cardType: "Location" } });
        if (c.lit("is being challenged")) return { inChallenge: card, role: "Defender" };
        if (c.lit("is in your discard")) return every({ zone: "Discard" });
        if (c.lit("is the named card")) return every({ namedCard: "Named Card" });
        if (c.lit("has a card under them", "has a card under him", "has a card under her", "has a card under it")) {
            return every({ cardsUnder: { atLeast: 1 } });
        }
        if (c.lit("had a card under them", "had a card under him", "had a card under her")) {
            return { atEvent: "Before", if: every({ cardsUnder: { atLeast: 1 } }) };
        }
        if (c.lit("has the same name as another card in your discard")) {
            return { exists: { zone: "Discard", player: "You", where: { sameNameAs: card } } };
        }
        if (c.lit("has the same name as the chosen card")) return every({ sameNameAs: c.state.chosen ?? card });
        const stat = c.try(() => {
            if (!c.lit("has")) return undefined;
            const n = digits(c);
            if (n === undefined) return undefined;
            const which = statSymbol(c);
            if (!which) return undefined;
            const comparison = comparisonSuffix(c, n);
            return comparison ? every({ [which.toLowerCase()]: comparison } as CardFilter) : undefined;
        });
        if (stat) return stat;
        const damage = c.try(() => {
            if (!c.lit("has")) return undefined;
            const n = digits(c);
            if (n === undefined) return undefined;
            const comparison = comparisonSuffix(c, n);
            return comparison && c.lit("damage") ? every({ damage: comparison }) : undefined;
        });
        if (damage) return damage;
        const cost = c.try(() => {
            if (!c.lit("costs")) return undefined;
            const n = digits(c);
            if (n === undefined) return undefined;
            const comparison = comparisonSuffix(c, n);
            return comparison ? every({ cost: comparison }) : undefined;
        });
        if (cost) return cost;
        const named = c.try(() => {
            if (!c.lit("is named")) return undefined;
            const list = nameList(c);
            return list ? every(list.length === 1 ? { name: list[0] } : { or: list.map((name) => ({ name })) }) : undefined;
        });
        if (named) return named;
        const isA = c.try(() => {
            if (!c.lit("is a", "is an", "are a", "are an", "are")) return undefined;
            const filter = cardKind(c);
            return filter ? every(filter) : undefined;
        });
        if (isA) return isA;
        return undefined;
    });
}

/** "Princess character card", "character card with cost 3 or less or named Pocahontas", "Knight". */
export function cardKind(c: Parser): CardFilter | undefined {
    return c.try((): CardFilter | undefined => {
        const steps: Step[] = [];
        const alternatives = c.list((): CardFilter | undefined => {
            c.lit("a", "an");
            const spec = bareCards(c, steps, undefined, true);
            if (spec) {
                const filter = spec.filter();
                const named = c.try(() => {
                    if (!c.lit("or named")) return undefined;
                    const list = nameList(c);
                    return list ? ({ or: [filter, ...list.map((name) => ({ name }))] } as CardFilter) : undefined;
                });
                return named ?? filter;
            }
            const kind = classification(c);
            return kind ? { classification: kind } : undefined;
        }, ["or"]);
        if (!alternatives || steps.length) return undefined;
        return alternatives.length === 1 ? alternatives[0] : { or: alternatives };
    });
}

/** Facts recorded this turn. */
function history(c: Parser): Condition | undefined {
    return c.try((): Condition | undefined => {
        const discarded = c.try(() => {
            const is = quantity(c) ?? (c.lit("a card") ? { atLeast: 1 } : undefined);
            if (!is) return undefined;
            c.lit("other");
            c.lit("cards", "card");
            if (!c.lit("were put into your discard this turn", "was put into your discard this turn")) return undefined;
            return thisTurn({ event: "Move Card", to: "Discard", player: "You" }, is);
        });
        if (discarded) return discarded;
        if (c.lit("1 or more cards have left a player's discard this turn", "a card left a player's discard this turn")) {
            return thisTurn({ event: "Move Card", from: "Discard" });
        }
        const played = c.try(() => {
            if (!c.lit("you have played", "you played", "you have played")) return undefined;
            const another = Boolean(c.lit("another"));
            const is = another ? { atLeast: 1 } : (quantity(c) ?? { atLeast: 1 });
            const steps: Step[] = [];
            const spec = bareCards(c, steps, "You", true);
            if (!spec || steps.length) return undefined;
            if (!c.lit("this turn")) return undefined;
            return thisTurn({ event: "Play", player: "You", card: spec.anyZone(another ? "Self" : undefined) }, is);
        });
        if (played) return played;
        if (c.lit("you didn't play a song this turn", "you haven't played a song this turn")) {
            return { not: thisTurn({ event: "Play", player: "You", card: { zone: "Any", cardType: "Action", where: { song: true } } }) };
        }
        if (c.lit("you discarded a card this turn")) return thisTurn({ event: "Discard", player: "You" });
        if (c.lit("you didn't put any cards into your inkwell this turn")) return { not: thisTurn({ event: "Put Into Inkwell", player: "You" }) };
        if (c.lit("you removed damage from a character this turn")) {
            return thisTurn({ event: "Remove Damage", card: { zone: "Any", cardType: "Character" } });
        }
        if (c.lit("you removed 1 or more damage from one of your characters this turn")) {
            return thisTurn({ event: "Remove Damage", card: { zone: "Any", player: "You", cardType: "Character" } });
        }
        if (c.lit("you have put a card under one of your characters or locations this turn")) {
            return thisTurn({ event: "Put Under", player: "You" });
        }
        if (c.lit("you have put a card under her this turn", "you have put a card under him this turn", "you put a card under him this turn")) {
            return thisTurn({ event: "Put Under", under: "Self", player: "You" });
        }
        if (c.lit("none of your characters challenged this turn")) {
            return { not: thisTurn({ event: "Challenge", attacker: { zone: "Any", player: "You", cardType: "Character" } }) };
        }
        if (c.lit("no other character has quested this turn")) {
            return { not: thisTurn({ event: "Quest", card: { zone: "Any", cardType: "Character", exclude: "Self" } }) };
        }
        if (c.lit("it is the second card you have put into your inkwell this turn")) {
            return thisTurn({ event: "Put Into Inkwell", player: "You" }, { equal: 2 });
        }
        if (c.lit("it is the second card they have drawn this turn")) return thisTurn({ event: "Draw", player: { event: "Player" } }, { equal: 2 });
        if (c.lit("it is the second challenge this turn")) {
            return thisTurn({ event: "Challenge", attacker: { zone: "Any", player: "You", cardType: "Character" } }, { equal: 2 });
        }
        // "a character was banished this turn", "one of your characters took damage this turn"
        const event = c.try(() => {
            const steps: Step[] = [];
            const np = cardNP(c, steps);
            if (!np || steps.length) return undefined;
            const card = anyZone(np.kind === "Fixed" ? np.cards : np.from);
            if (c.lit("was banished in a challenge this turn")) return thisTurn({ event: "Banish", card, kind: "Challenge" });
            if (c.lit("was banished this turn")) return thisTurn({ event: "Banish", card });
            if (c.lit("took damage this turn")) return thisTurn({ event: "Deal Damage", card });
            if (c.lit("quested this turn")) return thisTurn({ event: "Quest", card });
            if (c.lit("challenged this turn")) return thisTurn({ event: "Challenge", attacker: card });
            return undefined;
        });
        if (event) return event;
        return undefined;
    });
}

/** "if you returned a Hero character this way". */
function thisWay(c: Parser): Condition | undefined {
    return c.try((): Condition | undefined => {
        const result = (name: "Moved Cards" | "Discarded Cards" | "Banished Cards", kind?: CardFilter): Condition => ({
            exists: kind ? { filter: { result: name }, where: kind } : { result: name },
        });
        if (c.lit("you removed damage this way")) return { value: { result: "Damage Removed" }, is: { atLeast: 1 } };
        const returned = c.try(() => {
            if (!c.lit("you returned")) return undefined;
            const kind = cardKind(c);
            return kind && c.lit("this way") ? result("Moved Cards", kind) : undefined;
        });
        if (returned) return returned;
        const discarded = c.try(() => {
            if (!c.lit("you discarded")) return undefined;
            const kind = cardKind(c);
            if (!kind) return undefined;
            c.lit("this way");
            return result("Discarded Cards", kind);
        });
        if (discarded) return discarded;
        const passive = c.try(() => {
            c.lit("any");
            const kind = cardKind(c);
            if (!kind) return undefined;
            if (c.lit("is discarded this way", "was discarded this way")) return result("Discarded Cards", kind);
            if (c.lit("were moved this way", "was moved this way")) return result("Moved Cards", kind);
            return undefined;
        });
        if (passive) return passive;
        const under = c.try(() => {
            if (!c.lit("any of the cards that were under them are")) return undefined;
            const kind = cardKind(c);
            if (!kind) return undefined;
            const candidates: CardSelection = { filter: { atEvent: "Before", cards: { zone: "Under", under: it(c) } }, where: kind };
            // "Those characters" refers to the matching cards, not the banished source.
            c.state.characterRef = candidates;
            return { exists: candidates };
        });
        if (under) return under;
        return undefined;
    });
}

/** "a Villain character is chosen", "the chosen character is named Pain". */
function chosenIs(c: Parser): Condition | undefined {
    return c.try((): Condition | undefined => {
        const chosen = c.state.chosen ?? c.state.it;
        if (!chosen) return undefined;
        const kind = c.try(() => {
            c.lit("a", "an");
            const filter = cardKind(c);
            return filter && c.lit("is chosen") ? filter : undefined;
        });
        if (kind) return { every: chosen, where: kind };
        return undefined;
    });
}

function atom(c: Parser): Condition | undefined {
    return c.try((): Condition | undefined => {
        if (c.lit("it is your turn", "during your turn")) return { duringTurnOf: "You" };
        if (c.lit("the item you played has a different name than each other item you have in play")) {
            return { not: { exists: { zone: "Play", player: "You", cardType: "Item", exclude: { event: "Card" }, where: { sameNameAs: { event: "Card" } } } } };
        }
        if (c.lit("being challenged")) return { inChallenge: "Self", role: "Defender" };
        const challenging = c.try(() => {
            if (!c.lit("challenging")) return undefined;
            c.lit("a", "an");
            const kind = cardKind(c);
            return kind
                ? ({ and: [{ inChallenge: "Self", role: "Attacker" }, { exists: { filter: { challengeParticipant: "Defender" }, where: kind } }] } as Condition)
                : undefined;
        });
        if (challenging) return challenging;
        const exerted = c.try(() => {
            const n = quantity(c);
            if (!n || !c.lit("characters of yours are exerted")) return undefined;
            return count({ zone: "Play", player: "You", cardType: "Character", where: { exerted: true } }, n);
        });
        if (exerted) return exerted;
        const atLocation = c.try(() => {
            const steps: Step[] = [];
            if (!c.lit("one of your")) return undefined;
            const spec = bareCards(c, steps, "You");
            if (!spec || steps.length || !c.lit("is at a location")) return undefined;
            c.state.it = { filter: spec.cards(), where: { at: { zone: "Play", cardType: "Location" } } };
            return { exists: c.state.it } as Condition;
        });
        if (atLocation) return atLocation;
        if (c.lit("this is your first turn and you are not the first player")) {
            return {
                and: [
                    { duringTurnOf: "You" },
                    { value: { turnsTaken: "You" }, is: { equal: 0 } },
                    { existsPlayer: { from: "Opponents", where: { value: { turnsTaken: "Selected Player" }, is: { atLeast: 1 } } } },
                ],
            };
        }
        if (c.lit("you used shift to play")) {
            c.lit("her", "him", "it", "them", "this character");
            return { playedUsing: "Shift" };
        }
        if (c.lit("you removed an ink drop to play")) {
            c.lit("this action", "her", "him", "it", "this character");
            return { playedUsing: "Ink Drop" };
        }
        const singers = c.try(() => {
            const is = quantity(c);
            if (!is || !c.lit("characters sang this song", "character sang this song")) return undefined;
            c.state.it = { event: "Singers" };
            return count({ event: "Singers" }, is);
        });
        if (singers) return singers;
        if (c.lit("all cards in your inkwell are exerted")) return { every: { zone: "Inkwell", player: "You" }, where: { exerted: true } };
        const opponents = c.try(() => {
            if (!c.lit("you have")) return undefined;
            const n = number(c);
            if (n === undefined || !c.lit("or more opponents")) return undefined;
            return { value: { players: "Opponents" }, is: { atLeast: n } } as Condition;
        });
        if (opponents) return opponents;
        const you = c.try(() => {
            if (!c.lit("you have")) return undefined;
            return comparedHolding(c) ?? playerHas(c, "You");
        });
        if (you) return you;
        const not = c.try(() => {
            if (!c.lit("you don't have")) return undefined;
            const test = playerHas(c, "You");
            return test ? { not: test } : undefined;
        });
        if (not) return not;
        const opponent = c.try(() => {
            if (!c.lit("an opponent has", "one or more opponents have", "an opposing player has")) return undefined;
            const saved = c.state.they;
            c.state.they = "Selected Player";
            try {
                const test = playerHas(c, "Selected Player");
                return test ? ({ existsPlayer: { from: "Opponents", where: test } } as Condition) : undefined;
            } finally {
                c.state.they = saved;
            }
        });
        if (opponent) return opponent;
        const eachOpponent = c.try(() => {
            if (!c.lit("each opponent has", "each illumineer has")) return undefined;
            const test = playerHas(c, "Selected Player");
            return test ? ({ not: { existsPlayer: { from: "Opponents", where: { not: test } } } } as Condition) : undefined;
        });
        if (eachOpponent) return eachOpponent;
        const they = c.try(() => {
            if (!c.lit("they have")) return undefined;
            return playerHas(c, c.state.they ?? c.state.actor);
        });
        if (they) return they;
        const chosen = c.try(() => {
            if (!c.lit("chosen opponent has")) return undefined;
            const id = nextId(c);
            const player = playerRef(id);
            const test = playerHas(c, player);
            if (!test) return undefined;
            c.state.conditionSteps = [...(c.state.conditionSteps ?? []), { kind: "Choose Player", id, from: "Opponents" }];
            c.state.they = player;
            return test;
        });
        if (chosen) return chosen;
        const under = c.try(() => {
            if (!c.lit("there is a card under")) return undefined;
            const card = cardsReference(c);
            return card === undefined ? undefined : ({ every: card, where: { cardsUnder: { atLeast: 1 } } } as Condition);
        });
        if (under) return under;
        const thereIs = c.try(() => {
            const past = c.lit("there was");
            if (!past && !c.lit("there is", "there is", "there are")) return undefined;
            const is = quantity(c);
            if (!is) return undefined;
            const steps: Step[] = [];
            const spec = bareCards(c, steps, undefined);
            if (!spec || steps.length) return undefined;
            const test = count(spec.cards(), is);
            return past ? ({ atEvent: "Before", if: test } as Condition) : test;
        });
        if (thereIs) return thereIs;
        const recorded = history(c);
        if (recorded) return recorded;
        const result = thisWay(c);
        if (result) return result;
        const picked = chosenIs(c);
        if (picked) return picked;
        const subject = c.try(() => {
            const reference = cardsReference(c);
            if (reference === undefined) return undefined;
            return cardIs(c, reference);
        });
        if (subject) return subject;
        // "a Hero character is in play", "an opposing character has damage"
        const present = c.try(() => {
            const steps: Step[] = [];
            const np: CardNP | undefined = cardNP(c, steps);
            if (!np || steps.length || np.kind !== "Choose") return undefined;
            if (c.lit("is in play")) return { exists: np.from } as Condition;
            if (c.lit("has damage")) return { exists: { filter: np.from, where: { damage: { atLeast: 1 } } } } as Condition;
            return undefined;
        });
        if (present) return present;
        return undefined;
    });
}

export function condition(c: Parser): Condition | undefined {
    return c.try((): Condition | undefined => {
        const first = atom(c);
        if (!first) return undefined;
        const parts = [first];
        let joiner: "and" | "or" | undefined;
        for (;;) {
            const next = c.try(() => {
                const word = c.lit("and", "or");
                if (!word || (joiner && word.toLowerCase() !== joiner)) return undefined;
                const value = atom(c);
                if (!value) return undefined;
                joiner = word.toLowerCase() as "and" | "or";
                return value;
            });
            if (!next) break;
            parts.push(next);
        }
        if (parts.length === 1) return first;
        return joiner === "or" ? { or: parts } : { and: parts };
    });
}
