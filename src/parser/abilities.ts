import type {
    Ability,
    AbilityLimit,
    CardChange,
    CardFilter,
    CardRestriction,
    CardSelection,
    CardSelector,
    Condition,
    ContinuousRule,
    Cost,
    Duration,
    Effect,
    EventPattern,
    GrantedAbility,
    PlayerChange,
    PlayerSelection,
    Replacement,
    Zone,
} from "../model/ability";
import { Cursor } from "./text";
import { type Parser, type Source, type State, type Step, assertResolved, fold } from "./core";
import {
    bareCards,
    cardName,
    cardNP,
    cardsReference,
    classification,
    digits,
    it,
    keyword,
    mergeFilters,
    nameList,
    number,
    statSymbol,
} from "./nouns";
import { anyZone, condition } from "./conditions";
import { countable, duration, instructions, sentences, verbPhrase } from "./effects";

export function state(source: Source, text: string): State {
    return {
        source,
        ids: 0,
        actor: "You",
        boss: /(?<!named )\bJafar\b(?! -)/.test(text) && !/named Jafar/.test(text),
        named: false,
        results: [],
        parseTrigger: inlineTrigger,
    };
}

type Events = [EventPattern, EventPattern, ...EventPattern[]];

// ---------------------------------------------------------------------------
// Costs

/** One printed cost: "{E}", "2 {I}", "Banish one of your items", "Choose and discard a card". */
function cost(c: Parser): Cost[] | undefined {
    return c.try((): Cost[] | undefined => {
        const choice = (verb: "Exert" | "Banish" | "Discard", zone?: "Hand"): Cost[] | undefined => {
            const self = cardsReference(c);
            if (self === "Self") return [{ type: verb, cards: "Self" }];
            if (self !== undefined) return undefined;
            const steps: Step[] = [];
            const np = cardNP(c, steps);
            if (!np || np.kind !== "Choose" || steps.length || typeof np.count !== "number") return undefined;
            const from =
                zone && typeof np.from === "object" && "zone" in np.from && np.from.zone === "Play" ? { ...np.from, zone, player: "You" as const } : np.from;
            return [{ type: "Choose Cards", from, count: np.count, cost: [{ type: verb, cards: "Selected Cards" }] }];
        };
        if (c.lit("{E}")) return choice("Exert") ?? [{ type: "Exert", cards: "Self" }];
        const ink = c.try(() => {
            const n = digits(c);
            return n !== undefined && c.lit("{I}") ? n : undefined;
        });
        if (ink !== undefined) return [{ type: "Ink", amount: ink }];
        if (c.lit("banish")) return choice("Banish");
        if (c.lit("exert")) return choice("Exert");
        if (c.lit("choose and discard", "discard")) return choice("Discard", "Hand");
        const damage = c.try(() => {
            if (!c.lit("deal")) return undefined;
            const n = number(c);
            if (n === undefined || !c.lit("damage to this character")) return undefined;
            return [{ type: "Deal Damage", cards: "Self", amount: n }] as Cost[];
        });
        if (damage) return damage;
        const bottom = c.try(() => {
            if (!c.lit("put")) return undefined;
            const steps: Step[] = [];
            const np = cardNP(c, steps);
            if (!np || np.kind !== "Choose" || steps.length || typeof np.count !== "number") return undefined;
            if (!c.lit("on the bottom of your deck")) return undefined;
            const order = c.lit("in any order") ? { order: "Chosen" as const } : {};
            return [
                { type: "Choose Cards", from: np.from, count: np.count, cost: [{ type: "Move Card", cards: "Selected Cards", to: "Deck Bottom", ...order }] },
            ] as Cost[];
        });
        if (bottom) return bottom;
        const paid = c.try(() => {
            if (!c.lit("pay", "together pay")) return undefined;
            const n = number(c);
            if (n === undefined) return undefined;
            if (c.lit("lore")) return [{ type: "Lose Lore", amount: n }] as Cost[];
            return c.lit("{I}") ? ([{ type: "Ink", amount: n }] as Cost[]) : undefined;
        });
        if (paid) return paid;
        return undefined;
    });
}

function costs(c: Parser): Cost[] | undefined {
    const list = c.list(() => cost(c), ["and"]);
    return list?.flat();
}

// ---------------------------------------------------------------------------
// Trigger events

interface Trigger {
    pattern: EventPattern;
    limit?: AbilityLimit;
    duration?: Duration;
    uses?: number;
}

function withWhere(cards: CardSelection, where: CardFilter): CardSelection {
    if (typeof cards === "object" && "zone" in cards) return { ...cards, where: mergeFilters([cards.where ?? {}, where]) };
    return { filter: cards, where };
}

/** A card subject in an event: "one of your other Floodborn characters", "an opposing character". */
function eventCards(c: Parser): CardSelection | undefined {
    return c.try((): CardSelection | undefined => {
        const union = c.try(() => {
            if (!c.lit("this character or one of your")) return undefined;
            const steps: Step[] = [];
            const spec = bareCards(c, steps, "You");
            return spec && !steps.length ? ({ union: ["Self", spec.anyZone()] } as CardSelection) : undefined;
        });
        if (union) return union;
        const thisOrAnother = c.try(() => {
            if (!c.lit("this or another", "this character or another")) return undefined;
            const steps: Step[] = [];
            const spec = bareCards(c, steps, undefined);
            return spec && !steps.length ? spec.anyZone() : undefined;
        });
        if (thisOrAnother) return thisOrAnother;
        if (c.lit("one or more of your characters")) return { zone: "Any", player: "You", cardType: "Character" };
        if (c.lit("this character", "this item", "this location", "this card")) return "Self";
        if (c.lit("he", "she", "it", "they")) return c.state.it ?? "Self";
        const steps: Step[] = [];
        const np = cardNP(c, steps);
        if (!np || steps.length) return undefined;
        return anyZone(np.kind === "Fixed" ? np.cards : np.from);
    });
}

/** Event phrases after "when"/"whenever". */
function event(c: Parser): EventPattern | undefined {
    return c.try((): EventPattern | undefined => {
        const you = c.try(() => youEvent(c));
        if (you) return you;
        const opponent = c.try((): EventPattern | undefined => {
            const player = c.try((): PlayerSelection | undefined => {
                if (c.state.boss && c.lit("jafar")) return "You";
                if (c.lit("an opponent", "your opponent")) return "Opponents";
                if (c.lit("they")) return c.state.they ?? "Opponents";
                return undefined;
            });
            if (player === undefined) return undefined;
            {
                if (c.lit("plays", "play")) {
                    const steps: Step[] = [];
                    const np = cardNP(c, steps);
                    if (!np || steps.length) return undefined;
                    return { event: "Play", player, card: np.kind === "Fixed" ? np.cards : anyZone(np.from) };
                }
                if (c.lit("draws a card", "draw a card")) return { event: "Draw", player };
                if (c.lit("discards 1 or more cards")) return { event: "Discard", player };
                if (c.lit("chooses this character for an action or ability")) return { event: "Chosen", card: "Self", player };
                return undefined;
            }
        });
        if (opponent) return opponent;
        const actions = c.try((): EventPattern | undefined => {
            if (!c.lit("one of your actions deals damage to")) return undefined;
            const steps: Step[] = [];
            const np = cardNP(c, steps);
            if (!np || steps.length) return undefined;
            return {
                event: "Deal Damage",
                kind: "Action",
                source: { zone: "Any", player: "You", cardType: "Action" },
                card: anyZone(np.kind === "Fixed" ? np.cards : np.from),
            };
        });
        if (actions) return actions;
        const card = eventCards(c);
        if (card === undefined) return undefined;
        const first = cardEvent(c, card);
        if (!first) return undefined;
        // "Whenever this character quests or challenges"
        const second = c.try(() => (c.lit("or") ? cardEvent(c, card) : undefined));
        return second ? { anyOf: [first, second] } : first;
    });
}

function cardEvent(c: Parser, card: CardSelection): EventPattern | undefined {
    return c.try((): EventPattern | undefined => {
        if (c.lit("quests")) return { event: "Quest", card };
        if (c.lit("challenges and is banished")) return { event: "Banish", card, kind: "Challenge", attacker: card };
        if (c.lit("is challenged and banished")) return { event: "Banish", card, kind: "Challenge", defender: card };
        if (c.lit("is banished in a challenge")) return { event: "Banish", card, kind: "Challenge" };
        if (c.lit("is banished")) return { event: "Banish", card };
        if (c.lit("banishes another character in a challenge", "banishes a character in a challenge")) {
            // A challenge never banishes the character dealing the damage. Excluding a whole group
            // would exclude every character (Thebes - The Big Olive).
            return { event: "Banish", kind: "Challenge", source: card, card: { zone: "Any", cardType: "Character", ...(card === "Self" ? { exclude: card } : {}) } };
        }
        if (c.lit("is challenged")) return { event: "Challenge", defender: card };
        if (c.lit("challenges", "challenge")) {
            if (c.lit("this location")) return { event: "Challenge", attacker: card, defender: "Self" };
            const defender = c.try((): CardSelection | undefined => {
                const steps: Step[] = [];
                const np = cardNP(c, steps);
                if (!np || steps.length) return undefined;
                return np.kind === "Fixed" ? np.cards : anyZone(np.from);
            });
            if (defender === undefined) return { event: "Challenge", attacker: card };
            // "Another character" is other than the challenger, which can never challenge itself. It is
            // not other than this card (Mad Hatter - Unruly Eccentric can be the one challenged).
            if (card !== "Self" && typeof defender === "object" && "zone" in defender && defender.exclude === "Self") {
                const { exclude: _, ...rest } = defender;
                void _;
                return { event: "Challenge", attacker: card, defender: rest };
            }
            return { event: "Challenge", attacker: card, defender };
        }
        if (c.lit("leaves play")) return { event: "Leave Play", card };
        if (c.lit("is dealt damage")) return { event: "Deal Damage", card, when: { value: { event: "Amount" }, is: { greaterThan: 0 } } };
        if (c.lit("takes damage"))
            return {
                anyOf: [
                    { event: "Deal Damage", card, when: { value: { event: "Amount" }, is: { greaterThan: 0 } } },
                    { event: "Put Damage", card, when: { value: { event: "Amount" }, is: { greaterThan: 0 } } },
                ],
            };
        if (c.lit("deals damage to another character in a challenge")) {
            return { event: "Deal Damage", source: card, kind: "Challenge", card: { zone: "Any", cardType: "Character", ...(card === "Self" ? { exclude: card } : {}) } };
        }
        if (c.lit("exerts", "becomes exerted", "is exerted")) return { event: "Exert", card };
        if (c.lit("moves to a location")) return { event: "Move To Location", card };
        if (c.lit("moves here")) return { event: "Move To Location", card, location: "Self" };
        if (c.lit("sings a song with sing together")) return { event: "Sing", card, together: true };
        if (c.lit("sings a song", "sing a song")) {
            const group = typeof card === "object" && "zone" in card && card.player === "You" && /one or more/i.test(c.text);
            return { event: "Sing", card, ...(group ? { together: true } : {}) };
        }
        if (c.lit("is chosen for support")) return { event: "Chosen For Support", card };
        if (c.lit("is chosen for an action or an item's ability")) {
            return {
                anyOf: [
                    { event: "Chosen", card, kind: "Action" },
                    { event: "Chosen", card, kind: "Ability", source: { zone: "Play", cardType: "Item" } },
                ],
            };
        }
        if (c.lit("is played")) return { event: "Play", card };
        if (c.lit("enters play exerted")) return { event: "Play", card, when: { every: { event: "Card" }, where: { exerted: true } } };
        if (c.lit("is returned to your hand from play", "is returned to their hand from play")) {
            return { event: "Move Card", card, from: "Play", to: "Hand" };
        }
        if (c.lit("is put into your inkwell")) return { event: "Put Into Inkwell", card, player: "You" };
        if (c.lit("leaves your discard")) return { event: "Move Card", card, from: "Discard", player: "You" };
        return undefined;
    });
}

/** Events the controller performs: "you play a song", "you draw a card". */
function youEvent(c: Parser): EventPattern | undefined {
    return c.try((): EventPattern | undefined => {
        if (!c.lit("you")) return undefined;
        if (c.lit("play this character", "play this item", "play this location", "play this card")) {
            const another = c.try(() => {
                if (!c.lit("or another")) return undefined;
                const steps: Step[] = [];
                const spec = bareCards(c, steps, undefined);
                return spec && !steps.length ? spec.anyZone() : undefined;
            });
            return { event: "Play", card: another ?? "Self", ...(another ? { player: "You" } : {}) };
        }
        const cheap = c.try((): EventPattern | undefined => {
            if (!c.lit("pay")) return undefined;
            const n = digits(c);
            if (n === undefined || !c.lit("{I} or less to play")) return undefined;
            const kind = c.lit("a card")
                ? {}
                : c.lit("a non-character")
                  ? ({ not: { cardType: "Character" } } as CardFilter)
                  : c.lit("a character")
                    ? ({ cardType: "Character" } as CardFilter)
                    : undefined;
            if (!kind) return undefined;
            return {
                event: "Play",
                player: "You",
                card: { zone: "Any", ...(Object.keys(kind).length ? { where: kind } : {}) },
                when: { value: { event: "Ink Paid" }, is: { atMost: n } },
            };
        });
        if (cheap) return cheap;
        if (c.lit("play")) {
            if (c.lit("a second action in a turn")) {
                const action: CardSelector = { zone: "Any", cardType: "Action" };
                return {
                    event: "Play",
                    player: "You",
                    card: action,
                    when: { value: { countEvents: { event: "Play", player: "You", card: action }, during: "This Turn" }, is: { equal: 2 } },
                };
            }
            const thisOr = c.try(() => {
                if (!c.lit("this or another", "this character or another")) return undefined;
                const steps: Step[] = [];
                const spec = bareCards(c, steps, undefined);
                return spec && !steps.length ? spec.anyZone() : undefined;
            });
            if (thisOr) return { event: "Play", player: "You", card: thisOr };
            const steps: Step[] = [];
            const np = cardNP(c, steps);
            if (!np || steps.length) return undefined;
            let card = np.kind === "Fixed" ? np.cards : anyZone(np.from);
            if (c.lit("on this card")) return { event: "Play", player: "You", card, onto: "Self" };
            if (
                /another\s+\S+$/i.test(c.text.slice(Math.max(0, c.pos - 60), c.pos).split(" play ")[1] ?? "") &&
                typeof card === "object" &&
                "zone" in card &&
                card.exclude === undefined
            )
                card = { ...card, exclude: "Self" };
            return { event: "Play", player: "You", card };
        }
        if (c.lit("draw a card")) return { event: "Draw", player: "You" };
        if (c.lit("discard this card")) return { event: "Discard", card: "Self" };
        if (c.lit("discard a card")) return { event: "Discard", player: "You" };
        if (c.lit("discard")) {
            const steps: Step[] = [];
            const np = cardNP(c, steps);
            if (!np || steps.length || np.kind !== "Choose") return undefined;
            return { event: "Discard", player: "You", card: anyZone(np.from) };
        }
        if (c.lit("put a card into your inkwell")) return { event: "Put Into Inkwell", player: "You" };
        if (c.lit("put 1 or more cards into your discard from your deck")) return { event: "Move Card", player: "You", from: "Deck", to: "Discard", batch: true };
        if (c.lit("put a card under this character")) return { event: "Put Under", under: "Self", player: "You" };
        if (c.lit("put a card under one of your characters or locations")) {
            return {
                event: "Put Under",
                player: "You",
                under: { zone: "Play", player: "You", where: { or: [{ cardType: "Character" }, { cardType: "Location" }] } },
            };
        }
        if (c.lit("put a card under one of your other characters")) {
            return { event: "Put Under", player: "You", under: { zone: "Play", player: "You", cardType: "Character", exclude: "Self" } };
        }
        if (c.lit("ready this character")) return { event: "Ready", card: "Self" };
        if (c.lit("remove 1 or more damage from", "remove damage from")) {
            const steps: Step[] = [];
            const np = cardNP(c, steps);
            if (!np || steps.length) return undefined;
            return { event: "Remove Damage", player: "You", card: anyZone(np.kind === "Fixed" ? np.cards : np.from) };
        }
        if (c.lit("return")) {
            const steps: Step[] = [];
            const np = cardNP(c, steps);
            if (!np || steps.length || np.kind !== "Choose" || !c.lit("to your hand")) return undefined;
            return { event: "Move Card", player: "You", card: anyZone(np.from), from: "Discard", to: "Hand" };
        }
        if (c.lit("use the boost ability of a character")) return { event: "Boost", player: "You", card: { zone: "Play", cardType: "Character" } };
        if (c.lit("move a character")) {
            const filter = c.try(() => {
                if (!c.lit("with")) return undefined;
                const n = digits(c);
                const stat = statSymbol(c);
                return n !== undefined && stat && c.lit("or more") ? ({ [stat.toLowerCase()]: { atLeast: n } } as CardFilter) : undefined;
            });
            c.lit("here");
            const fromLocation = Boolean(c.lit("from a location"));
            const card: CardSelector = { zone: "Play", player: "You", cardType: "Character", ...(filter ? { where: filter } : {}) };
            return {
                event: "Move To Location",
                card,
                location: "Self",
                ...(fromLocation
                    ? { when: { atEvent: "Before", if: { every: { event: "Card" }, where: { at: { zone: "Play", cardType: "Location" } } } } }
                    : {}),
            };
        }
        if (c.lit("shift a character on top of this character", "shift a character on top of her")) return { event: "Shift", player: "You", onto: "Self" };
        if (c.lit("shift this character")) return { event: "Shift", card: "Self" };
        if (c.lit("remove an ink drop")) return { event: "Remove Ink Drop", player: "You" };
        return undefined;
    });
}

/** "When you play this character and whenever he quests". */
function events(c: Parser): EventPattern | undefined {
    const first = event(c);
    if (!first) return undefined;
    const rest: EventPattern[] = [];
    for (;;) {
        const next = c.try(() => {
            if (!c.lit("and when", "and whenever", "or when", "or whenever", "and")) return undefined;
            if (c.lit("at the start of your turn")) return { event: "Turn Start", player: "You" } as EventPattern;
            const e = event(c);
            return e ? eventSuffix(c, e) : undefined;
        });
        if (!next) break;
        rest.push(next);
    }
    if (!rest.length) return first;
    return { anyOf: [first, ...rest] as Events };
}

function addWhen(pattern: EventPattern, when: Condition): EventPattern {
    if ("anyOf" in pattern) return { anyOf: pattern.anyOf.map((p) => addWhen(p, when)) as Events };
    const existing = pattern.when;
    return { ...pattern, when: existing ? { and: [existing, when] } : when };
}

/** "while here", "while at a location" and "while this character is exerted" after an event. */
function eventSuffix(c: Parser, pattern: EventPattern): EventPattern {
    if (c.lit("while here")) return locate(pattern);
    if (c.lit("while at a location")) return addWhen(pattern, eventCardIs({ at: { zone: "Play", cardType: "Location" } }, pattern));
    const suffix = c.try(() => (c.lit("while") ? condition(c) : undefined));
    if (suffix) return addWhen(pattern, suffix);
    if (c.lit("during your turn")) return addWhen(pattern, { duringTurnOf: "You" });
    if (c.lit("during their turn")) return addWhen(pattern, { duringTurnOf: "Opponents" });
    return pattern;
}

/** A test on the event's card, or this card when the event is about it. */
function eventCardIs(where: CardFilter, pattern: EventPattern): Condition {
    const card = "card" in pattern ? pattern.card : undefined;
    return { every: card === "Self" ? "Self" : { event: "Card" }, where };
}

/** Restrict the event's card to characters at this location. */
function locate(pattern: EventPattern): EventPattern {
    if ("anyOf" in pattern) return { anyOf: pattern.anyOf.map(locate) as Events };
    const at: CardFilter = { at: "Self" };
    const character: CardSelector = { zone: "Any", cardType: "Character" };
    if (pattern.event === "Banish") {
        if (pattern.kind === "Challenge" && pattern.source !== undefined) {
            return { ...pattern, source: { atEvent: "Before", cards: withWhere(playZone(pattern.source), at) } };
        }
        return { ...pattern, card: { atEvent: "Before", cards: withWhere(playZone(pattern.card ?? character), at) } };
    }
    if (pattern.event === "Challenge") {
        if (pattern.defender !== undefined && pattern.attacker === undefined) return { ...pattern, defender: withWhere(pattern.defender, at) };
        return { ...pattern, attacker: withWhere(pattern.attacker ?? character, at) };
    }
    if ("card" in pattern) return { ...pattern, card: withWhere(pattern.card ?? character, at) } as EventPattern;
    return pattern;
}

function playZone(cards: CardSelection): CardSelection {
    if (typeof cards === "object" && "zone" in cards && cards.zone === "Any") return { ...cards, zone: "Play" };
    return cards;
}

/**
 * Trigger openings: "When ...,", "At the start of your turn,", "Once during your turn, whenever ...,".
 * `absorbIf` puts a following "if" condition on the trigger; otherwise the effect keeps it.
 */
function trigger(c: Parser, absorbIf = true): Trigger | undefined {
    return c.try((): Trigger | undefined => {
        let limit: AbilityLimit | undefined;
        const when: Condition[] = [];
        if (c.lit("once during your turn,")) {
            limit = { perTurn: 1, count: "Uses" };
            when.push({ duringTurnOf: "You" });
        } else if (c.lit("twice during your turn,")) {
            limit = { perTurn: 2, count: "Uses" };
            when.push({ duringTurnOf: "You" });
        } else if (c.lit("once per turn,")) limit = { perTurn: 1, count: "Uses" };
        if (c.lit("during your turn,")) when.push({ duringTurnOf: "You" });
        else if (c.lit("during an opponent's turn,", "during opponents' turns,", "during each opponent's turn,")) {
            when.push({ duringTurnOf: "Opponents" });
            c.state.they = "Opponents";
        }
        const prefix = c.try(() => {
            if (!c.lit("while")) return undefined;
            const test = condition(c);
            return test && c.lit(",") ? test : undefined;
        });
        if (prefix) when.push(prefix);
        let pattern: EventPattern | undefined;
        const boundary = c.try((): EventPattern | undefined => {
            if (c.lit("at the start of your turn", "at the start of jafar's turn")) return { event: "Turn Start", player: "You" };
            if (c.lit("at the end of your turn")) return { event: "Turn End", player: "You" };
            if (c.lit("at the end of each opponent's turn")) return { event: "Turn End", player: "Opponents" };
            if (c.lit("at the end of each player's turn")) return { event: "Turn End", player: "All" };
            return undefined;
        });
        if (boundary) pattern = boundary;
        else {
            const first = c.try(() => {
                if (!c.lit("the first time")) return undefined;
                const e = event(c);
                if (!e) return undefined;
                c.lit("each turn");
                return e;
            });
            if (first) {
                pattern = first;
                limit = { perTurn: 1, count: "Occurrences" };
            } else {
                if (!c.lit("whenever", "when")) return undefined;
                pattern = events(c);
                if (!pattern) return undefined;
            }
        }
        pattern = eventSuffix(c, pattern);
        bindEvent(c, pattern);
        if (absorbIf) {
            const conditional = c.try(() => {
                if (!c.lit(", if")) return undefined;
                c.state.conditionSteps = [];
                const test = condition(c);
                const extra = c.state.conditionSteps;
                c.state.conditionSteps = undefined;
                return test && !extra.length ? test : undefined;
            });
            if (conditional) {
                when.push(conditional);
                c.lit(",");
            } else if (!c.lit(",")) return undefined;
        } else if (!c.lit(",")) return undefined;
        for (const test of when) pattern = addWhen(pattern, test);
        return { pattern, ...(limit ? { limit } : {}) };
    });
}

/** Triggers inside effects: "Whenever one of your characters quests this turn, ...". */
function inlineTrigger(c: Parser): { pattern: EventPattern; duration?: Duration; uses?: number } | undefined {
    return c.try(() => {
        const next = c.try(() => {
            if (!c.lit("the next time")) return undefined;
            const e = event(c);
            if (!e) return undefined;
            c.lit("this turn");
            return e;
        });
        if (next) return c.lit(",") ? { pattern: next, uses: 1 } : undefined;
        if (!c.lit("whenever")) return undefined;
        const pattern = events(c);
        if (!pattern) return undefined;
        c.lit("this turn");
        return c.lit(",") ? { pattern } : undefined;
    });
}

/** Bind event references for the effect: "them" means the event's card. */
function bindEvent(c: Parser, pattern: EventPattern): void {
    const simple = "anyOf" in pattern ? undefined : pattern;
    if (!simple) {
        // "When you play this character and whenever he quests": every alternative is about this card.
        return;
    }
    const card = "card" in simple ? simple.card : undefined;
    if (simple.event === "Challenge") {
        c.state.it = simple.attacker === "Self" ? { event: "Defender" } : { event: "Attacker" };
    } else if (simple.event === "Banish" && simple.kind === "Challenge" && simple.source === "Self") {
        c.state.it = { event: "Card" };
    } else if (card !== undefined && card !== "Self") c.state.it = { event: "Card" };
    else if (simple.event === "Play" && simple.card === undefined) c.state.it = { event: "Card" };
    // A later character choice must not replace the location that caused this trigger.
    if (simple.event === "Play" && card && typeof card === "object" && "cardType" in card && card.cardType === "Location") {
        c.state.location = { event: "Card" };
    }
    if ((simple.event === "Turn End" || simple.event === "Turn Start") && simple.player !== "You") c.state.they = { event: "Player" };
    if (simple.event === "Chosen" || simple.event === "Draw" || simple.event === "Discard") {
        if ("player" in simple && simple.player !== "You" && simple.player !== undefined) c.state.they = { event: "Player" };
    }
    if (simple.event === "Challenge" && simple.defender === "Self") c.state.they = { ownerOf: { event: "Attacker" } };
    if (simple.event === "Move To Location") {
        c.state.moved = { event: "Card" };
        c.state.location = { event: "Location" };
    }
    c.state.event = simple;
}

// ---------------------------------------------------------------------------
// Replacement abilities

/**
 * "If this character would be banished, ... instead", "the first time this
 * character would take damage, she takes no damage instead".
 */
function replacementAbility(c: Parser): Replacement | undefined {
    return c.try((): Replacement | undefined => {
        const when: Condition[] = [];
        if (c.lit("during each opponent's turn,", "during opponents' turns,")) when.push({ duringTurnOf: "Opponents" });
        const first = Boolean(c.lit("the first time"));
        if (!first) c.lit("if", "whenever");
        if (c.lit("an effect would cause you to discard one or more cards")) {
            c.lit("from your hand");
            if (!c.lit(", you don't discard")) return undefined;
            const pattern: EventPattern = { event: "Discard", player: "You", kind: "Effect" };
            return { event: when.length ? addWhen(pattern, when[0]) : pattern };
        }
        const card = eventCards(c);
        if (card === undefined) return undefined;
        let pattern: EventPattern | undefined;
        if (c.lit("would be banished")) pattern = { event: "Banish", card };
        else if (c.lit("would take damage", "would be dealt damage")) pattern = { event: "Deal Damage", card };
        if (!pattern || !c.lit(",")) return undefined;
        for (const test of when) pattern = addWhen(pattern, test);
        const limit = first ? { limit: { perTurn: 1, count: "Occurrences" as const } } : {};
        if (c.lit("she takes no damage instead", "he takes no damage instead", "it takes no damage instead", "they take no damage instead")) {
            return { event: pattern, ...limit };
        }
        c.state.it = { event: "Card" };
        const saved = c.state;
        const body = c.try(() => {
            const steps = verbPhrase(c, "You");
            return steps && c.lit("instead") ? steps : undefined;
        });
        c.state = { ...saved, ids: c.state.ids };
        if (!body) return undefined;
        return { event: pattern, instead: fold(body), ...limit };
    });
}

// ---------------------------------------------------------------------------
// Static rules

function modifyRules(cards: CardSelection, changes: CardChange[]): ContinuousRule {
    const rules = changes.map((modifier): ContinuousRule => ({ type: "Modify Cards", cards, modifier }));
    return rules.length === 1 ? rules[0] : { type: "Together", rules };
}

function conditional(rule: ContinuousRule, tests: Condition[]): ContinuousRule {
    if (!tests.length) return rule;
    return { type: "Conditional", if: tests.length === 1 ? tests[0] : { and: tests }, then: rule };
}

interface StaticResult {
    rule: ContinuousRule;
    from?: Zone[];
    limit?: { perTurn: number; count: "Uses" };
}

function staticAbility(c: Parser): StaticResult | undefined {
    return c.try((): StaticResult | undefined => {
        c.state.continuous = true;
        const tests: Condition[] = [];
        for (;;) {
            const prefix = c.try((): Condition | undefined => {
                if (c.lit("during your turn,")) return { duringTurnOf: "You" };
                if (c.lit("during opponents' turns,", "during an opponent's turn,", "during the illumineers' turn,", "during the opposing players' turn,")) {
                    return { duringTurnOf: "Opponents" };
                }
                if (c.lit("during challenges,")) return { inChallenge: { zone: "Play", cardType: "Character" } };
                if (!c.lit("while", "if")) return undefined;
                const test = condition(c);
                return test && c.lit(",") ? test : undefined;
            });
            if (!prefix) break;
            tests.push(prefix);
        }
        const body = staticBodies(c);
        if (!body) return undefined;
        const suffix = c.try(() => {
            const unless = c.lit("unless");
            if (!unless && !c.lit("while", "if")) return undefined;
            const test = condition(c);
            return test ? (unless ? { not: test } : test) : undefined;
        });
        if (suffix) tests.push(suffix);
        if (!endOfText(c)) return undefined;
        return { ...body, rule: conditional(body.rule, tests) };
    });
}

function endOfText(c: Parser): boolean {
    c.lit(".");
    return c.done;
}

/** Static bodies joined by "and" with different subjects. */
function staticBodies(c: Parser): StaticResult | undefined {
    const first = staticBody(c);
    if (!first) return undefined;
    const rules = [first.rule];
    for (;;) {
        const next = c.try(() => (c.lit("and") ? staticBody(c) : undefined));
        if (!next) break;
        rules.push(next.rule);
    }
    return rules.length === 1 ? first : { ...first, rule: { type: "Together", rules } };
}

const staticRestrictions: [string, CardRestriction][] = [
    ["quest", "Can't Quest"],
    ["challenge", "Can't Challenge"],
    ["move to locations", "Can't Move"],
    ["exert to sing songs", "Can't Sing"],
    ["{E} to sing songs", "Can't Sing"],
    ["be challenged", "Can't Be Challenged"],
    ["be dealt damage", "Can't Be Dealt Damage"],
    ["ready at the start of your turn", "Can't Ready At Start Of Turn"],
    ["ready at the start of their turn", "Can't Ready At Start Of Turn"],
    ["ready at the start of their players' turns", "Can't Ready At Start Of Turn"],
    ["ready", "Can't Ready"],
    ["sing songs without sing together", "Can't Sing Without Sing Together"],
];

/** Changes printed as continuous: "gets +1 {L}", "can't be challenged by Pirate characters". */
function staticChanges(c: Parser, subject: CardSelection): ContinuousRule | undefined {
    return c.try((): ContinuousRule | undefined => {
        const rules: ContinuousRule[] = [];
        const one = (): boolean =>
            c.try(() => {
                const rule = staticChange(c, subject);
                if (!rule) return undefined;
                duration(c);
                rules.push(rule);
                return true;
            }) === true;
        if (!one()) return undefined;
        while (c.try(() => (c.lit(", and", "and", ",") && one() ? true : undefined))) {
            /* more */
        }
        return rules.length === 1 ? rules[0] : { type: "Together", rules };
    });
}

/** The subject's description as a filter, for "Characters with cost 2 or less can't challenge your characters". */
function asFilter(cards: CardSelection): CardFilter | undefined {
    if (typeof cards !== "object" || !("zone" in cards)) return undefined;
    return mergeFilters([cards.cardType ? { cardType: cards.cardType } : {}, cards.where ?? {}]) ?? {};
}

function staticChange(c: Parser, subject: CardSelection): ContinuousRule | undefined {
    return c.try((): ContinuousRule | undefined => {
        const modify = (modifier: CardChange): ContinuousRule => ({ type: "Modify Cards", cards: subject, modifier });
        if (c.lit("gets", "get")) {
            const list = c.list(
                () =>
                    c.try((): CardChange | undefined => {
                        const sign = c.re("([+-])");
                        if (!sign) return undefined;
                        const n = digits(c);
                        const stat = statSymbol(c);
                        if (n === undefined || !stat) return undefined;
                        return { stat, amount: sign[1] === "-" ? -n : n };
                    }),
                ["and"],
            );
            if (!list) return undefined;
            const per = c.try(() => (c.lit("for each") ? countable(c) : undefined));
            const challenging = c.try(() => {
                if (!c.lit("while challenging a location")) return undefined;
                return {
                    and: [
                        { inChallenge: "Affected Card", role: "Attacker" },
                        { exists: { filter: { challengeParticipant: "Defender" }, where: { cardType: "Location" } } },
                    ],
                } as Condition;
            });
            return modifyRules(
                subject,
                list.map((change) => {
                    const scaled =
                        per === undefined ? change : ({ ...change, amount: { multiply: [(change as { amount: number }).amount, per] } } as CardChange);
                    return challenging ? ({ ...scaled, when: challenging } as CardChange) : scaled;
                }),
            );
        }
        if (c.lit("gains", "gain", "has")) {
            const list = c.list((): CardChange | undefined => {
                const quoted = c.try(() => {
                    if (!c.lit('"')) return undefined;
                    const ability = grantedAbility(c);
                    return ability && c.lit('"') ? ({ gainAbility: ability } as CardChange) : undefined;
                });
                if (quoted) return quoted;
                const kind = c.try(() => {
                    if (!c.lit("the")) return undefined;
                    const k = classification(c);
                    return k && c.lit("classification") ? ({ gainClassification: k } as CardChange) : undefined;
                });
                if (kind) return kind;
                const shift = c.try(() => {
                    if (!c.lit("shift")) return undefined;
                    const n = digits(c);
                    if (n === undefined || !c.lit("{I}")) return undefined;
                    return { gainAbility: { type: "Keyword", keyword: { name: "Shift", cost: [{ type: "Ink", amount: n }] } } } as CardChange;
                });
                if (shift) return shift;
                const word = keyword(c);
                if (!word) return undefined;
                if (word === "Challenger" || word === "Resist" || word === "Singer") {
                    c.re("\\+");
                    const n = digits(c);
                    if (n === undefined) return undefined;
                    const per = c.try(() => (c.lit("for each") ? countable(c) : undefined));
                    return { gainKeyword: word, amount: per === undefined ? n : { multiply: [n, per] } };
                }
                if (word === "Boost" || word === "Shift" || word === "Sing Together") return undefined;
                return { gainKeyword: word } as CardChange;
            }, ["and"]);
            if (!list) return undefined;
            if (c.lit("and can challenge ready characters")) list.push({ permission: "Can Challenge Ready Characters" });
            return modifyRules(subject, list);
        }
        if (c.lit("loses", "lose")) {
            const named = c.try(() => {
                if (!c.lit("the")) return undefined;
                const start = c.pos;
                const end = c.text.toLowerCase().indexOf(" ability", start);
                if (end < 0) return undefined;
                const name = c.text.slice(start, end);
                c.pos = end + 1;
                if (!c.lit("ability")) return undefined;
                return modify({ loseAbility: { name: name.toUpperCase() } });
            });
            if (named) return named;
            const word = keyword(c);
            if (!word || word === "Sing Together") return undefined;
            const rules: ContinuousRule[] = [modify({ loseKeyword: word })];
            if (c.lit("and can't gain")) {
                if (keyword(c) !== word) return undefined;
                rules.push(modify({ restriction: "Can't Gain Keyword", keyword: word }));
            }
            return rules.length === 1 ? rules[0] : { type: "Together", rules };
        }
        if (c.lit("can't gain")) {
            const word = keyword(c);
            if (!word || word === "Sing Together") return undefined;
            return modify({ restriction: "Can't Gain Keyword", keyword: word });
        }
        if (c.lit("can't")) {
            const items = c.list(() => {
                for (const [phrase, restriction] of staticRestrictions) if (c.lit(phrase)) return restriction;
                return undefined;
            }, ["or", "and"]);
            if (!items) return undefined;
            // "Characters with cost 2 or less can't challenge your characters": a restriction on the defenders.
            if (items.length === 1 && items[0] === "Can't Challenge") {
                const defenders = c.try((): CardSelection | undefined => {
                    if (c.lit("this character")) return "Self";
                    const steps: Step[] = [];
                    const np = cardNP(c, steps);
                    if (!np || steps.length || np.kind !== "Fixed") return undefined;
                    return np.cards;
                });
                if (defenders !== undefined) {
                    const by = asFilter(subject);
                    if (!by) return undefined;
                    return { type: "Modify Cards", cards: defenders, modifier: { restriction: "Can't Be Challenged", by } };
                }
            }
            const by = c.try(() => {
                if (!c.lit("by")) return undefined;
                const steps: Step[] = [];
                const spec = bareCards(c, steps, undefined);
                return spec && !steps.length ? spec.filter() : undefined;
            });
            const unless = c.try((): Condition | undefined => {
                if (!c.lit("unless")) return undefined;
                if (c.lit("he is being challenged", "they are being challenged")) return { inChallenge: "Affected Card", role: "Defender" };
                if (c.lit("it is at a location")) return { every: "Affected Card", where: { at: { zone: "Play", cardType: "Location" } } };
                return undefined;
            });
            const pay = c.try(() => {
                if (!c.lit("unless you pay")) return undefined;
                const n = number(c);
                return n !== undefined && c.lit("{I}") ? n : undefined;
            });
            if (pay !== undefined) {
                const kinds = items.map((item) =>
                    item === "Can't Quest" ? ("Quest" as const) : item === "Can't Challenge" ? ("Challenge" as const) : undefined,
                );
                if (kinds.some((kind) => kind === undefined)) return undefined;
                return { type: "Additional Cost", cards: subject, for: kinds as ("Quest" | "Challenge")[], cost: [{ type: "Ink", amount: pay }] };
            }
            const rules = items.map((restriction) => modify({ restriction, ...(by ? { by } : {}), ...(unless ? { when: { not: unless } } : {}) }));
            if (c.lit("and must quest if able")) rules.push(modify({ restriction: "Must Quest" }));
            return rules.length === 1 ? rules[0] : { type: "Together", rules };
        }
        if (c.lit("can challenge ready characters")) return modify({ permission: "Can Challenge Ready Characters" });
        if (c.lit("can challenge ready")) {
            const steps: Step[] = [];
            const spec = bareCards(c, steps, undefined);
            if (!spec || steps.length) return undefined;
            return modify({ permission: "Can Challenge Ready Characters", where: spec.filter() });
        }
        if (c.lit("can quest the turn he is played", "can quest the turn she is played", "can quest the turn they are played")) {
            return modify({ permission: "Can Quest The Turn Played" });
        }
        if (c.lit("may enter play exerted")) {
            const then = c.try(() => {
                if (!c.lit("to")) return undefined;
                const steps = verbPhrase(c, "You");
                return steps ? fold(steps) : undefined;
            });
            return { type: "Enter Play", cards: subject, exerted: true, optional: true, ...(then ? { then } : {}) };
        }
        if (c.lit("enters play exerted", "enter play exerted")) return { type: "Enter Play", cards: anyZone(subject), exerted: true };
        const damage = c.try(() => {
            if (!c.lit("enters play with", "enter play with")) return undefined;
            const n = number(c);
            return n !== undefined && c.lit("damage") ? ({ type: "Enter Play", cards: anyZone(subject), damage: n } as ContinuousRule) : undefined;
        });
        if (damage) return damage;
        if (c.lit("takes no damage from challenges", "take no damage from challenges")) {
            return modify({ restriction: "Can't Be Dealt Damage", when: { inChallenge: "Affected Card" } });
        }
        const singing = c.try(() => {
            if (!c.lit("counts as having", "count as having")) return undefined;
            const sign = c.re("([+-])");
            const n = digits(c);
            if (!sign || n === undefined || !c.lit("cost to sing songs")) return undefined;
            return modify({ stat: "Cost To Sing", amount: sign[1] === "-" ? -n : n });
        });
        if (singing) return singing;
        if (c.lit("also counts as being named")) {
            const name = cardName(c);
            if (!name || !c.lit("for shift")) return undefined;
            return modify({ countsAsName: name, for: "Shift" });
        }
        if (c.lit("counts as being named both")) {
            const list = nameList(c);
            if (!list) return undefined;
            return { type: "Together", rules: list.map((name) => modify({ countsAsName: name })) };
        }
        if (c.lit("can move here for free", "may move here for free")) {
            return { type: "Alternate Cost", cards: subject, for: "Move", location: "Self", cost: [] };
        }
        if (c.lit("deal damage with their {W} instead of their {S}")) return { type: "Challenge Damage", cards: subject, stat: "Willpower" };
        if (c.lit("count as having {K}")) return modify({ inkable: true });
        if (c.lit("{S} can't be reduced below their printed value")) {
            return modify({ minimumStat: "Strength", amount: { stat: "Strength", card: "Affected Card", printed: true } });
        }
        return undefined;
    });
}

/** The subject of a static rule. */
function staticSubject(c: Parser): CardSelection | undefined {
    return c.try((): CardSelection | undefined => {
        if (c.state.conditionCards !== undefined && c.lit("they")) return c.state.conditionCards;
        if (c.lit("this character", "this item", "this location", "this card", "he", "she", "it", "they")) return "Self";
        if (c.lit("your locations and characters at locations")) {
            return {
                union: [
                    { zone: "Play", player: "You", cardType: "Location" },
                    { zone: "Play", player: "You", cardType: "Character", where: { at: { zone: "Play", cardType: "Location" } } },
                ],
            };
        }
        if (c.lit("that character", "that location")) return c.state.it;
        if (c.lit("your characters'")) return { zone: "Play", player: "You", cardType: "Character" };
        const list = c.list((): CardSelection | undefined => {
            const steps: Step[] = [];
            const np = cardNP(c, steps);
            if (!np || steps.length) return undefined;
            return np.kind === "Fixed" ? np.cards : np.from;
        }, ["and"]);
        if (!list) return undefined;
        return list.length === 1 ? list[0] : { union: list };
    });
}

function staticBody(c: Parser): StaticResult | undefined {
    return c.try((): StaticResult | undefined => {
        const discount = c.try(() => costRule(c));
        if (discount) return discount;
        const alternate = c.try(() => alternateCost(c));
        if (alternate) return alternate;
        const player = c.try(() => playerRule(c));
        if (player) return { rule: player };
        const per = c.try(() => {
            if (!c.lit("for each")) return undefined;
            const value = countable(c);
            return value !== undefined && c.lit(",") ? value : undefined;
        });
        const subject = staticSubject(c);
        if (subject === undefined) return undefined;
        let changes = staticChanges(c, subject);
        if (!changes) return undefined;
        if (per !== undefined) changes = scale(changes, per);
        if (c.lit("while here")) return { rule: relocate(changes) };
        // Conditional Shift must be available before playing the card, just like printed Shift.
        if (
            subject === "Self" &&
            changes.type === "Modify Cards" &&
            "gainAbility" in changes.modifier &&
            changes.modifier.gainAbility.type === "Keyword" &&
            changes.modifier.gainAbility.keyword.name === "Shift"
        ) {
            return { rule: changes, from: ["Hand", "Play", "Discard", "Under", "Inkwell"] };
        }
        return { rule: changes };
    });
}

/** "For each location you have in play, this character gets +1 {L}." */
function scale(rule: ContinuousRule, per: import("../model/ability").Amount): ContinuousRule {
    if (rule.type === "Together") return { ...rule, rules: rule.rules.map((r) => scale(r, per)) };
    if (rule.type !== "Modify Cards") return rule;
    const modifier = rule.modifier;
    if ("stat" in modifier && typeof modifier.amount === "number") return { ...rule, modifier: { ...modifier, amount: { multiply: [modifier.amount, per] } } };
    if ("gainKeyword" in modifier && typeof modifier.amount === "number") {
        return { ...rule, modifier: { ...modifier, amount: { multiply: [modifier.amount, per] } } as CardChange };
    }
    return rule;
}

function relocate(rule: ContinuousRule): ContinuousRule {
    const at = (cards: CardSelection): CardSelection => withWhere(cards, { at: "Self" });
    switch (rule.type) {
        case "Together":
            return { ...rule, rules: rule.rules.map(relocate) };
        case "Modify Cards":
            return { ...rule, cards: at(rule.cards) };
        default:
            return rule;
    }
}

/** Cost changes: "you pay 1 {I} less to play this character". */
function costRule(c: Parser): StaticResult | undefined {
    return c.try((): StaticResult | undefined => {
        const per = c.try(() => {
            if (!c.lit("for each")) return undefined;
            const value = countable(c);
            return value !== undefined && c.lit(",") ? value : undefined;
        });
        const once = Boolean(c.lit("once during your turn,"));
        const everyone = Boolean(c.lit("each player pays"));
        const optional = !everyone && Boolean(c.lit("you may pay"));
        if (!everyone && !optional && !c.lit("you pay")) return undefined;
        const n = number(c);
        if (n === undefined || !c.lit("{I}")) return undefined;
        const more = c.lit("more");
        if (!more && !c.lit("less")) return undefined;
        const sign = more ? 1 : -1;
        const amount: import("../model/ability").Amount = per === undefined ? sign * n : { multiply: [sign * n, per] };
        const limit = once ? { limit: { perTurn: 1, count: "Uses" as const } } : {};
        if (c.lit("to play this character using her shift ability", "to play this character using his shift ability")) {
            return { rule: { type: "Modify Cost", cards: "Self", amount, for: "Shift" }, from: ["Hand"] };
        }
        if (c.lit("to play this character", "to play this item", "to play this action", "to play this location", "to play this card")) {
            return { rule: { type: "Modify Cost", cards: "Self", amount, for: "Play" }, from: ["Hand"] };
        }
        if (c.lit("to shift a character on top of this character")) {
            return { rule: { type: "Modify Cost", cards: { zone: "Any", player: "You", cardType: "Character" }, amount, for: "Shift", onto: "Self" } };
        }
        if (c.lit("to play characters using their shift ability")) {
            return { rule: { type: "Modify Cost", cards: { zone: "Any", player: "You", cardType: "Character" }, amount, for: "Shift" } };
        }
        if (optional && c.lit("to move this character to a location")) {
            return {
                rule: conditional({ type: "Modify Cost", cards: "Self", amount, for: "Move", optional: true }, once ? [{ duringTurnOf: "You" }] : []),
                ...limit,
            };
        }
        if (optional) return undefined;
        if (c.lit("to move a character of yours here", "to move your characters to a location")) {
            const here = /here$/i.test(c.text.slice(0, c.pos));
            return {
                rule: {
                    type: "Modify Cost",
                    cards: { zone: "Play", player: "You", cardType: "Character" },
                    amount,
                    for: "Move",
                    ...(here ? { location: "Self" } : {}),
                },
            };
        }
        if (c.lit("for the next character you play this turn")) {
            return { rule: { type: "Modify Cost", cards: { zone: "Any", player: "You", cardType: "Character" }, amount, for: "Play" }, ...limit };
        }
        if (c.lit("for the first action you play each turn")) {
            return {
                rule: { type: "Modify Cost", cards: { zone: "Any", player: "You", cardType: "Action" }, amount, for: "Play" },
                limit: { perTurn: 1, count: "Uses" },
            };
        }
        if (!c.lit("to play")) return undefined;
        const steps: Step[] = [];
        const spec = bareCards(c, steps, everyone ? undefined : "You");
        if (!spec || steps.length) return undefined;
        // Yokai - Intellectual Schemer discounts only plays that use Shift.
        const shift = Boolean(c.lit("using their shift ability"));
        return { rule: { type: "Modify Cost", cards: spec.anyZone(), amount, for: shift ? "Shift" : "Play" } };
    });
}

/** Alternative ways to play: "you may play this character for free", "You may exert 4 items of yours to play this character for free". */
function alternateCost(c: Parser): StaticResult | undefined {
    return c.try((): StaticResult | undefined => {
        if (!c.lit("you may", "you can")) return undefined;
        const paid =
            c.try(() => {
                const list = costs(c);
                return list && c.lit("to") ? list : undefined;
            }) ?? [];
        const shift = Boolean(c.lit("shift this character"));
        if (!shift && !c.lit("play")) return undefined;
        let cards: CardSelection = "Self";
        if (!shift && !c.lit("this character", "this item", "this card")) {
            const steps: Step[] = [];
            const np = cardNP(c, steps);
            if (!np || steps.length || np.kind !== "Fixed") return undefined;
            cards = anyZone(np.cards);
            if (typeof cards === "object" && "zone" in cards && cards.player === undefined) cards = { ...cards, player: "You" };
        }
        if (!c.lit("for free")) return undefined;
        const tests: Condition[] = [];
        const suffix = c.try(() => (c.lit("if") ? condition(c) : undefined));
        if (suffix) tests.push(suffix);
        const rule: ContinuousRule = shift
            ? { type: "Alternate Cost", cards: "Self", for: "Shift", cost: paid }
            : { type: "Alternate Cost", cards, for: "Play", cost: paid };
        return { rule: conditional(rule, tests), ...(cards === "Self" ? { from: ["Hand"] } : {}) };
    });
}

/** Rules about players: "Skip your turn's Draw step", "Opponents can't play actions". */
function playerRule(c: Parser): ContinuousRule | undefined {
    return c.try((): ContinuousRule | undefined => {
        const players = (p: PlayerSelection, modifier: PlayerChange): ContinuousRule => ({ type: "Modify Players", players: p, modifier });
        if (c.lit("skip your turn's draw step")) return players("You", { skipDrawStep: true });
        if (c.lit("you can ink cards from your discard")) return players("You", { permission: "Can Ink From Discard" });
        if (c.lit("you may ink an additional card")) return players("You", { additionalInk: 1 });
        if (c.lit("you can't lose lore")) return players("You", { restriction: "Can't Lose Lore" });
        if (c.lit("you can shift any character on top of this character")) {
            return { type: "Can Shift Onto", cards: { zone: "Any", player: "You", cardType: "Character" }, onto: "Self" };
        }
        if (c.lit("you may play any character with shift on this character as if this character had any name")) {
            return { type: "Can Shift Onto", cards: { zone: "Any", player: "You", cardType: "Character", where: { keyword: "Shift" } }, onto: "Self" };
        }
        const free = c.try(() => {
            if (!c.lit("you may use this item's")) return undefined;
            const start = c.pos;
            const end = c.text.toLowerCase().indexOf(" ability for free", start);
            if (end < 0) return undefined;
            const name = c.text.slice(start, end);
            c.pos = end + 1;
            return c.lit("ability for free") ? ({ type: "Free Ability", cards: "Self", name: name.toUpperCase() } as ContinuousRule) : undefined;
        });
        if (free) return free;
        const victory = c.try(() => {
            if (!c.lit("opponents need")) return undefined;
            const n = digits(c);
            return n !== undefined && c.lit("lore to win the game") ? players("Opponents", { victoryLore: n }) : undefined;
        });
        if (victory) return victory;
        if (c.lit("each turn, only one character can challenge")) return players("All", { challengeLimit: 1, count: "Characters", players: "All" });
        if (c.lit("you may play characters from your discard. if you do, they enter play exerted")) {
            return players("You", { permission: "Can Play From Discard", cards: { zone: "Discard", player: "You", cardType: "Character" }, exerted: true });
        }
        const who = c.try((): PlayerSelection | undefined => {
            if (c.lit("opponents", "opposing players", "illumineers", "each opposing player")) return "Opponents";
            if (c.lit("you")) return "You";
            return undefined;
        });
        if (who !== undefined) {
            if (c.lit("can't choose your items for abilities or effects")) {
                return {
                    type: "Modify Cards",
                    cards: { zone: "Play", player: "You", cardType: "Item" },
                    modifier: { restriction: "Can't Be Chosen", byPlayer: who },
                };
            }
            if (c.lit("must choose this character for actions and abilities if able")) {
                return { type: "Modify Cards", cards: "Self", modifier: { restriction: "Must Be Chosen", byPlayer: who } };
            }
            if (c.lit("can't play actions or items"))
                return players(who, { restriction: "Can't Play", where: { or: [{ cardType: "Action" }, { cardType: "Item" }] } });
            const actions = c.try(() => {
                if (!c.lit("can't play actions")) return undefined;
                const cost = c.try(() => {
                    if (!c.lit("with cost")) return undefined;
                    const n = digits(c);
                    return n !== undefined && c.lit("or more") ? { atLeast: n } : undefined;
                });
                return players(who, { restriction: "Can't Play", where: { cardType: "Action", ...(cost ? { cost } : {}) } });
            });
            if (actions) return actions;
            if (c.lit("can't use battleground abilities")) return players(who, { restriction: "Can't Use Battleground Abilities" });
            if (c.lit("can't gain lore")) {
                const unless = c.try(() => {
                    if (!c.lit("unless one of their characters has challenged this turn")) return undefined;
                    return {
                        value: {
                            countEvents: { event: "Challenge", attacker: { zone: "Any", player: "Selected Player", cardType: "Character" } },
                            during: "This Turn",
                        },
                        is: { atLeast: 1 },
                    } as Condition;
                });
                if (unless) return { type: "Modify Players", players: { from: who, where: { not: unless } }, modifier: { restriction: "Can't Gain Lore" } };
                return players(who, { restriction: "Can't Gain Lore" });
            }
        }
        if (c.lit("each opponent plays with the top card of their deck faceup"))
            return { type: "Reveal Cards", cards: { zone: "Deck", player: "Opponents", position: "Top", take: 1 } };
        if (c.lit("each player plays with the top card of their deck face up"))
            return { type: "Reveal Cards", cards: { zone: "Deck", player: "All", position: "Top", take: 1 } };
        if (c.lit("damage counters can't be removed")) {
            return {
                type: "Modify Cards",
                cards: { zone: "Play", where: { or: [{ cardType: "Character" }, { cardType: "Location" }] } },
                modifier: { restriction: "Can't Remove Damage" },
            };
        }
        if (c.lit("cards enter opponents' inkwells exerted")) return players("Opponents", { inkEntersExerted: true });
        return undefined;
    });
}

// ---------------------------------------------------------------------------
// Ability slots

/** "Once during your turn, you may pay 2 {I} to reveal ...": optional uses printed without an activation cost. */
function limitedActivated(c: Parser): Ability | undefined {
    return c.try((): Ability | undefined => {
        let limit: { perTurn: number; count: "Uses" } | undefined;
        const when: Condition[] = [];
        if (c.lit("once during your turn,")) {
            limit = { perTurn: 1, count: "Uses" };
            when.push({ duringTurnOf: "You" });
        } else if (c.lit("once per turn,")) limit = { perTurn: 1, count: "Uses" };
        let by: PlayerSelection | undefined;
        if (c.lit("during the illumineers' turn,", "during the opposing players' turn,")) {
            when.push({ duringTurnOf: "Opponents" });
            if (!c.lit("they may")) return undefined;
            // The group activates once: "together pay 3 lore" is shared, "pay 3 {I} each" is paid by every player.
            by = { together: "Opponents" };
            let paid = costs(c);
            if (paid && c.lit("each")) paid = paid.map((cost) => (cost.type === "Ink" ? { ...cost, each: true as const } : cost));
            if (!paid || !c.lit("to")) return undefined;
            const steps = verbPhrase(c, "You");
            if (!steps || !endOfText(c)) return undefined;
            return { type: "Activated", cost: paid, effect: fold(steps), when: when[0], by };
        }
        const test = c.try(() => {
            if (!c.lit("if", "while")) return undefined;
            const t = condition(c);
            return t && c.lit(",") ? t : undefined;
        });
        if (test) when.push(test);
        if (!limit && !test) return undefined;
        const optional = c.pos;
        if (!c.lit("you may")) return undefined;
        // Paid costs become activation costs; the rest is the effect.
        const paid = c.try(() => {
            const list = costs(c);
            if (!list) return undefined;
            if (c.lit("to")) return { list, purpose: true };
            if (c.lit(".") && c.lit("if you do,")) return { list, purpose: true };
            return undefined;
        });
        const pay = paid
            ? undefined
            : c.try(() => {
                  if (!c.lit("pay")) return undefined;
                  const n = number(c);
                  return n !== undefined && c.lit("{I} to") ? n : undefined;
              });
        const cost: Cost[] = paid ? paid.list : pay !== undefined ? [{ type: "Ink", amount: pay }] : [];
        // Without a separate cost, "you may X. If you do, Y" stays one optional instruction.
        if (!cost.length) c.pos = optional;
        const steps = sentences(c);
        if (!steps || !steps.length || !c.done) return undefined;
        let effect = fold(steps);
        if (!cost.length) {
            // "you may move him to another location for free. If you do, gain 1 lore": optional by activation.
            effect = unwrapOptional(effect);
        }
        // Conditional free play is a play permission, not an activation in play.
        if (!limit && !cost.length && effect.type === "Play" && effect.cards === "Self" && effect.free) return undefined;
        const condition_ = when.length === 0 ? undefined : when.length === 1 ? when[0] : { and: when };
        return { type: "Activated", cost, effect, ...(condition_ ? { when: condition_ } : {}), ...(limit ? { limit } : {}) };
    });
}

function unwrapOptional(effect: Effect): Effect {
    if (effect.type === "Optional") return effect.effect;
    if (effect.type === "Sequence" && effect.effects[0]?.type === "Optional") {
        return { ...effect, effects: [unwrapOptional(effect.effects[0]), ...effect.effects.slice(1)] };
    }
    if (effect.type === "Do Then" && effect.do.type === "Optional") return { ...effect, do: effect.do.effect };
    return effect;
}

/**
 * Triggers that work from the discard: "if this card is in your discard" becomes
 * the ability's zone, and "when you discard this card" fires once it arrives there.
 */
function triggerZone(pattern: EventPattern): { pattern: EventPattern; from?: ["Discard"] } {
    if ("anyOf" in pattern) return { pattern };
    const inDiscard = (test: Condition): boolean => JSON.stringify(test) === JSON.stringify({ every: "Self", where: { zone: "Discard" } });
    const when = pattern.when;
    if (when && inDiscard(when)) {
        const { when: _, ...rest } = pattern;
        void _;
        return { pattern: rest as EventPattern, from: ["Discard"] };
    }
    if (when && "and" in when && when.and.some(inDiscard)) {
        const others = when.and.filter((test) => !inDiscard(test));
        return { pattern: { ...pattern, when: others.length === 1 ? others[0] : { and: others } } as EventPattern, from: ["Discard"] };
    }
    if (pattern.event === "Discard" && "card" in pattern && pattern.card === "Self") return { pattern, from: ["Discard"] };
    return { pattern };
}

/** "If you used Shift to play this character, you may draw 2 cards when he enters play." */
function shiftedEntry(c: Parser): Ability | undefined {
    return c.try((): Ability | undefined => {
        if (!c.lit("if you used shift to play this character,")) return undefined;
        const start = c.pos;
        const end = c.text.toLowerCase().lastIndexOf(" when he enters play");
        if (end < 0) return undefined;
        const inner: Parser = new Cursor(c.text.slice(start, end) + ".", { ...c.state });
        const effect = instructions(inner);
        if (!effect || !inner.done) return undefined;
        c.pos = c.text.length;
        return { type: "Triggered", trigger: { event: "Play", card: "Self", when: { playedUsing: "Shift" } }, effect };
    });
}

/**
 * The text inside quotes in `gains "{E} — Draw a card"`. It is parsed on its own,
 * since the granted ability's references bind when it is used, not when granted.
 */
export function grantedAbility(c: Parser): GrantedAbility | undefined {
    const end = c.text.indexOf('"', c.pos);
    if (end < 0) return undefined;
    const text = c.text.slice(c.pos, end).replace(/\.$/, "");
    const inner: Parser = new Cursor(text, { ...state(c.state.source, text), boss: c.state.boss, granted: true });
    const ability = slotAbility(inner);
    if (!ability || ability.type === "Keyword" || ability.type === "Deck Construction") return undefined;
    c.re(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    c.lit(".");
    return ability;
}

/**
 * "Whenever this character deals damage to another character ..., deal the same amount
 * of damage to up to 2 other chosen characters": other than both characters (Mulan - Elite Archer, Namaari - Heir of Fang).
 */
function otherThanDamaged(pattern: EventPattern, effect: Effect): Effect {
    if ("anyOf" in pattern || pattern.event !== "Deal Damage" || pattern.source !== "Self") return effect;
    if (typeof pattern.card !== "object" || !("exclude" in pattern.card) || pattern.card.exclude !== "Self") return effect;
    if (effect.type === "Optional") return { ...effect, effect: otherThanDamaged(pattern, effect.effect) };
    if (effect.type !== "Choose Cards" || typeof effect.from !== "object" || !("zone" in effect.from) || effect.from.exclude !== "Self") return effect;
    return { ...effect, from: { ...effect.from, exclude: { union: ["Self", { event: "Card" }] } } };
}

/** Any non-keyword ability text, tried as triggered, replacement, activated, then static. */
export function slotAbility(c: Parser): Ability | undefined {
    const sentencesFollow = /\.\s+\S/.test(c.text.replace(/"[^"]*"/g, "").replace(/\.$/, ""));
    for (const absorbIf of sentencesFollow ? [false, true] : [true, false]) {
        const triggered = c.try((): Ability | undefined => {
            const t = trigger(c, absorbIf);
            if (!t) return undefined;
            bindEvent(c, t.pattern);
            const effect = instructions(c);
            if (!effect || !c.done) return undefined;
            assertResolved(effect);
            const zone = triggerZone(t.pattern);
            return { type: "Triggered", trigger: zone.pattern, effect: otherThanDamaged(t.pattern, effect), ...(t.limit ? { limit: t.limit } : {}), ...(zone.from ? { from: zone.from } : {}) };
        });
        if (triggered) return triggered;
    }
    const replacement = c.try((): Ability | undefined => {
        const r = replacementAbility(c);
        if (!r || !endOfText(c)) return undefined;
        return { type: "Replacement", replacement: r };
    });
    if (replacement) return replacement;
    const activated = c.try((): Ability | undefined => {
        const paid = costs(c);
        if (!paid || !c.lit("—")) return undefined;
        if (paid.some((cost) => cost.type === "Choose Cards")) {
            c.state.it = { result: "Paid Cards" };
            c.state.characterRef = { result: "Paid Cards" };
        }
        const effect = instructions(c);
        if (!effect || !c.done) return undefined;
        assertResolved(effect);
        return { type: "Activated", cost: paid, effect };
    });
    if (activated) return activated;
    const limited = c.try(() => {
        const ability = limitedActivated(c);
        if (ability) assertResolved(ability);
        return ability;
    });
    if (limited) return limited;
    const shifted = shiftedEntry(c);
    if (shifted) return shifted;
    const rule = c.try(() => staticAbility(c));
    if (rule) {
        assertResolved(rule.rule);
        return { type: "Static", rule: rule.rule, ...(rule.limit ? { limit: rule.limit } : {}), ...(rule.from ? { from: rule.from } : {}) };
    }
    return undefined;
}

export { trigger, staticAbility, costs, bindEvent, event, inlineTrigger, it };
export type { Trigger, StaticResult, Effect, State, Source, CardRestriction };
