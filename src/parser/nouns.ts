import type { Amount, CardFilter, CardSelection, CardSelector, Comparison, Keyword, PlayerSelection, Stat, Zone } from '../model/ability';
import type { Subtype } from '../model/identity';
import { cards as catalog } from '../cards';
import { Unsupported } from './text';
import { type Parser, type Step, cardRef, nextId, playerRef } from './core';

export type CardType = 'Character' | 'Item' | 'Location' | 'Action';
export type Ink = 'Amber' | 'Amethyst' | 'Emerald' | 'Ruby' | 'Sapphire' | 'Steel';

export const classifications: readonly Subtype[] = ['Alien', 'Ally', 'Broom', 'Captain', 'Colossus', 'Deity', 'Detective',
    'Dinosaur', 'Dragon', 'Dreamborn', 'Entangled', 'Fairy', 'Floodborn', 'Gargoyle', 'Ghost', 'Giant', 'Hero', 'Hunny',
    'Hyena', 'Hyperia City', 'Illusion', 'Inventor', 'King', 'Knight', 'Madrigal', 'Mentor', 'Monster', 'Musketeer',
    'Obstacle', 'Pirate', 'Prince', 'Princess', 'Puppy', 'Queen', 'Racer', 'Red Panda', 'Robot', 'Seven Dwarfs', 'Sorcerer',
    'Storyborn', 'Super', 'Team', 'Tigger', 'Titan', 'Toy', 'Villain', 'Vineling', 'Whisper'];
const inks: readonly Ink[] = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];
export const keywords: readonly Keyword[] = ['Alert', 'Bodyguard', 'Evasive', 'Reckless', 'Rush', 'Support', 'Vanish', 'Ward',
    'Adventurous', 'Challenger', 'Resist', 'Singer', 'Boost', 'Shift', 'Sing Together'];

/** Printed names, longest first, so "named" consumes exactly one known name. */
const known = new Set<string>(['Potato', 'The Reforged Crown']);
let names: string[] = [];

/** Recognize the names of these cards, e.g. a newly downloaded catalog that is not embedded yet. */
export function addCardNames(cards: Iterable<{ readonly fullName: string; readonly names?: readonly string[]; readonly name?: string }>): void {
    for (const card of cards) {
        known.add(card.fullName);
        for (const name of card.names ?? (card.name ? [card.name] : [])) known.add(name);
        known.add(card.fullName.split(' - ')[0]);
    }
    names = [...known].sort((a, b) => b.length - a.length);
}

addCardNames(catalog);

export function cardName(c: Parser): string | undefined {
    const rest = c.rest.toLowerCase();
    for (const name of names) {
        const lower = name.toLowerCase();
        if (rest.startsWith(lower) && !/^[\w']/.test(rest.slice(lower.length))) {
            const text = c.text.slice(c.pos, c.pos + name.length);
            c.re(escapeRegExp(text));
            return name;
        }
    }
    // A name missing from this catalog snapshot: capitalized words, case-sensitively.
    const unknown = /^[A-Z][\w'!-]*(?: (?:(?:of|the|and|a|in|on|to|&) )*[A-Z][\w'!-]*)*/.exec(c.rest);
    if (!unknown) return undefined;
    c.re(escapeRegExp(unknown[0]));
    return unknown[0];
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Names joined by "or": "named Woody or Jessie". */
export function nameList(c: Parser): string[] | undefined {
    return c.list(() => cardName(c), ['or', 'and']);
}

const numberWords: Readonly<Record<string, number>> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

export function number(c: Parser): number | undefined {
    const digits = c.re('\\d+(?![\\w])');
    if (digits) return Number(digits[0]);
    const word = c.re('(a|an|one|two|three|four|five|six|seven)(?![\\w\'])');
    return word ? numberWords[word[1].toLowerCase()] : undefined;
}

/** Digits only, for printed values such as "cost 3". */
export function digits(c: Parser): number | undefined {
    const match = c.re('\\d+(?![\\w])');
    return match ? Number(match[0]) : undefined;
}

export function statSymbol(c: Parser): Stat | undefined {
    const match = c.re('\\{(S|W|L)\\}');
    if (!match) return undefined;
    return ({ S: 'Strength', W: 'Willpower', L: 'Lore' } as const)[match[1].toUpperCase() as 'S' | 'W' | 'L'];
}

export function classification(c: Parser): Subtype | undefined {
    for (const name of [...classifications].sort((a, b) => b.length - a.length)) {
        if (c.lit(name)) return name;
    }
    return undefined;
}

export function keyword(c: Parser): Keyword | undefined {
    for (const name of [...keywords].sort((a, b) => b.length - a.length)) {
        if (c.lit(name)) return name;
    }
    return undefined;
}

function ink(c: Parser): Ink | undefined {
    for (const name of inks) if (c.lit(name)) return name;
    return undefined;
}

// ---------------------------------------------------------------------------
// Players

/** A player phrase. Choices must be made by an enclosing Choose Player step. */
export type PlayerNP =
    | { kind: 'Fixed'; player: PlayerSelection; plural: boolean }
    | { kind: 'Choose'; from: PlayerSelection };

export function playerNP(c: Parser): PlayerNP | undefined {
    const fixed = (player: PlayerSelection, plural = false): PlayerNP => ({ kind: 'Fixed', player, plural });
    if (c.lit('another chosen player')) return { kind: 'Choose', from: { from: 'All', where: { not: { isPlayer: 'You' } } } };
    if (c.lit('chosen opponent', 'chosen opposing player')) return { kind: 'Choose', from: 'Opponents' };
    if (c.lit('chosen player')) return { kind: 'Choose', from: 'All' };
    if (c.lit('each opponent', 'each opposing player', 'all opponents', 'opponents', 'opposing players', 'the opposing players',
        'your opponents', 'each illumineer', 'the illumineers', 'illumineers', 'your opponent')) return fixed('Opponents', true);
    if (c.lit('each player', 'all players', 'every player', 'players')) return fixed('All', true);
    if (c.lit('you')) return fixed('You');
    if (c.state.boss && c.lit('jafar', 'he')) return fixed('You');
    if (c.lit('its player', 'their player', 'that player', "that character's player")) {
        return fixed({ ownerOf: it(c) });
    }
    if (c.lit("the challenging character's player", 'the challenging player')) return fixed({ ownerOf: { event: 'Attacker' } });
    if (c.lit('they')) return fixed(members(c.state.they ?? c.state.actor));
    return undefined;
}

/** "your", "their", "chosen player's" before a zone. Choices produce steps. */
export function possessive(c: Parser, steps: Step[]): PlayerSelection | undefined {
    if (c.lit('your')) return 'You';
    if (c.state.boss && c.lit('his', "jafar's")) return 'You';
    if (c.lit('their', 'its')) return members(c.state.they ?? c.state.actor);
    if (c.lit("each opponent's", "opponents'", "each opposing player's", "an opponent's")) return 'Opponents';
    if (c.lit("each player's")) return 'All';
    if (c.lit("their players'", "their player's", "its player's", "that player's")) return { ownerOf: it(c) };
    if (c.lit("chosen opponent's", "chosen player's")) {
        const opponent = /opponent/i.test(c.text.slice(c.pos - 20, c.pos));
        const id = nextId(c);
        steps.push({ kind: 'Choose Player', id, from: opponent ? 'Opponents' : 'All' });
        c.state.they = playerRef(id);
        return playerRef(id);
    }
    return undefined;
}

/** The cards that "they", "it" and "that character" refer to. */
export function it(c: Parser): CardSelection {
    return c.state.it ?? 'Self';
}

// ---------------------------------------------------------------------------
// Amounts

export function comparisonSuffix(c: Parser, value: Amount): Comparison | undefined {
    if (c.lit('or less', 'or fewer')) return { atMost: value };
    if (c.lit('or more', 'or greater')) return { atLeast: value };
    return { equal: value };
}

// ---------------------------------------------------------------------------
// Cards

/**
 * A card phrase before it is used. A choice becomes a Choose Cards step only
 * when an instruction uses it; conditions treat indefinite phrases as tests.
 */
export type CardNP =
    /** referred: a pronoun or definite reference to cards an earlier instruction named. */
    | { kind: 'Fixed'; cards: CardSelection; plural: boolean; referred?: boolean }
    | {
          kind: 'Choose'; from: CardSelection; count: Amount | { upTo: Amount } | 'Any';
          /** Printed "chosen", which targets. Other choices are still choices. */
          chosen: boolean; plural: boolean; groupWhere?: import('../model/ability').Condition;
          chooser?: PlayerSelection; possessive?: boolean;
          /** One choice for each of these players, from that player's cards. */
          perPlayer?: PlayerSelection;
      };

interface Spec {
    zone?: Zone | 'Any';
    player?: PlayerSelection;
    types: CardType[];
    filters: CardFilter[];
    exclude?: CardSelection;
    under?: CardSelection;
    take?: Amount;
    position?: 'Top' | 'Bottom';
    explicitCard?: boolean;
    /** Cards from history or results that the description narrows, e.g. "who was challenged this turn". */
    within?: CardSelection;
    /** "the character with the lowest cost": compare against the same description. */
    extreme?: 'Highest' | 'Lowest';
    /** Compare against all characters in play instead. */
    extremeAll?: boolean;
    /** A test on the chosen group as a whole, e.g. "with total {S} 10 or less". */
    group?: import('../model/ability').Condition;
}

/** Cards "of theirs" belong to each player in a group that decides together. */
function members(player: PlayerSelection): PlayerSelection;
function members(player: PlayerSelection | undefined): PlayerSelection | undefined;
function members(player: PlayerSelection | undefined): PlayerSelection | undefined {
    return typeof player === 'object' && 'together' in player ? player.together : player;
}

export function mergeFilters(filters: readonly CardFilter[]): CardFilter | undefined {
    const merged: CardFilter = {};
    const extra: CardFilter[] = [];
    for (const filter of filters) {
        for (const [key, value] of Object.entries(filter) as [keyof CardFilter, unknown][]) {
            if (value === undefined) continue;
            if (key in merged) extra.push({ [key]: value } as CardFilter);
            else (merged as Record<string, unknown>)[key] = value;
        }
    }
    if (extra.length) merged.and = [...(merged.and ?? []), ...extra];
    return Object.keys(merged).length ? merged : undefined;
}

export function selector(spec: Spec): CardSelector {
    const filters = [...spec.filters];
    let type: CardType | undefined;
    if (spec.types.length === 1) type = spec.types[0];
    else if (spec.types.length > 1) filters.unshift({ or: spec.types.map(t => ({ cardType: t })) });
    const where = mergeFilters(filters);
    return {
        zone: spec.zone ?? 'Play',
        ...(spec.player !== undefined ? { player: spec.player } : {}),
        ...(type ? { cardType: type } : {}),
        ...(where ? { where } : {}),
        ...(spec.exclude !== undefined ? { exclude: spec.exclude } : {}),
        ...(spec.under !== undefined ? { under: spec.under } : {}),
        ...(spec.position !== undefined ? { position: spec.position } : {}),
        ...(spec.take !== undefined ? { take: spec.take } : {}),
    };
}

/** Type nouns, alone or in lists such as "character, item, or location". */
function typeNoun(c: Parser): { types: CardType[]; plural: boolean; card: boolean; song?: boolean } | undefined {
    const one = (): { types: CardType[]; plural: boolean; card: boolean; song?: boolean } | undefined => {
        const m = c.re("(characters?|items?|locations?|actions?|songs?|cards?)(?:'s)?(?![\\w'])");
        if (!m) return undefined;
        const word = m[1].toLowerCase();
        const plural = word.endsWith('s') && word !== 'cards' ? true : word === 'cards';
        const base = word.replace(/s$/, '');
        if (base === 'card') return { types: [], plural, card: true };
        if (base === 'song') {
            const card = Boolean(c.lit('cards', 'card'));
            return { types: ['Action'], plural, card, song: true };
        }
        const type = (base[0].toUpperCase() + base.slice(1)) as CardType;
        if (m[0].endsWith("'s")) {
            c.state.possessive = true;
            return { types: [type], plural, card: false };
        }
        const card = c.re('cards?(?![\\w])');
        return { types: [type], plural: plural || Boolean(card && /s$/i.test(card[0])), card: Boolean(card) };
    };
    const items = c.list(one, ['and/or', 'or', 'and']);
    if (!items) return undefined;
    if (items.length === 1) return items[0];
    if (items.some(item => item.song)) return undefined;
    return { types: items.flatMap(item => item.types), plural: items.some(item => item.plural), card: items.some(item => item.card) };
}

interface Determiner {
    kind: 'Choose' | 'All' | 'Indefinite' | 'Bare' | 'The';
    count?: Amount | { upTo: Amount } | 'Any';
    chosen?: boolean;
    other?: boolean;
    player?: PlayerSelection;
}

function determiner(c: Parser): Determiner | undefined {
    const another = Boolean(c.lit('another'));
    if (c.lit('any number of chosen')) return { kind: 'Choose', count: 'Any', chosen: true, other: another };
    if (c.lit('any number of your')) return { kind: 'Choose', count: 'Any', chosen: false, player: 'You' };
    const upTo = c.try(() => c.lit('up to') ? number(c) : undefined);
    if (upTo !== undefined) {
        const player: PlayerSelection | undefined = c.lit('of your') ? 'You' : c.state.boss && c.lit("of jafar's") ? 'You' : undefined;
        const other = Boolean(c.lit('other')) || another;
        const chosen = Boolean(c.lit('chosen'));
        return { kind: 'Choose', count: { upTo }, chosen, other, ...(player ? { player } : {}) };
    }
    if (c.lit('chosen')) return { kind: 'Choose', count: 1, chosen: true, other: another };
    const counted = c.try(() => {
        const n = number(c);
        if (n === undefined || n === 1 && !another) return undefined;
        return c.lit('chosen') ? n : undefined;
    });
    if (counted !== undefined) return { kind: 'Choose', count: counted, chosen: true, other: another };
    if (another) return { kind: 'Indefinite', count: 1, other: true };
    if (c.lit('any number of')) return { kind: 'Choose', count: 'Any', chosen: false };
    if (c.lit('each of your', 'all of your')) return { kind: 'All', player: 'You' };
    if (c.lit('each of their', 'all of their')) return { kind: 'All', player: members(c.state.they ?? c.state.actor) };
    if (c.lit('all your')) return { kind: 'All', player: 'You' };
    if (c.lit('each other', 'all other', 'every other')) return { kind: 'All', other: true };
    if (c.lit('each', 'all', 'every', 'all the')) return { kind: 'All' };
    if (c.lit("one of your opponents'")) return { kind: 'Indefinite', count: 1, player: 'Opponents' };
    if (c.lit('one of your')) return { kind: 'Indefinite', count: 1, player: 'You' };
    if (c.state.boss && c.lit("jafar's")) return { kind: 'All', player: 'You' };
    if (c.lit('any')) return { kind: 'Indefinite', count: 1 };
    if (c.lit('one of their')) return { kind: 'Indefinite', count: 1, player: members(c.state.they ?? c.state.actor) };
    const ofYours = c.try(() => {
        const n = number(c);
        return n !== undefined && c.lit('of your') ? n : undefined;
    });
    if (ofYours !== undefined) return { kind: 'Indefinite', count: ofYours, player: 'You' };
    const ofTheirs = c.try(() => {
        const n = number(c);
        return n !== undefined && c.lit('of their') ? n : undefined;
    });
    if (ofTheirs !== undefined) return { kind: 'Indefinite', count: ofTheirs, player: members(c.state.they ?? c.state.actor) };
    if (c.lit('your')) return { kind: 'All', player: 'You' };
    if (c.lit('the')) return { kind: 'The' };
    const n = number(c);
    if (n !== undefined) return { kind: 'Indefinite', count: n };
    return { kind: 'Bare' };
}

/** Adjectives before the type noun. Returns whether a classification was read. */
function premodifiers(c: Parser, spec: Spec, defaultPlayer?: PlayerSelection): boolean {
    const classes: string[] = [];
    const classInks: Ink[] = [];
    for (;;) {
        if (c.lit('opposing')) { spec.player = 'Opponents'; continue; }
        if (c.lit('other')) { spec.exclude = (spec.player ?? defaultPlayer) === 'You' ? 'Self' : c.state.chosen ?? 'Self'; continue; }
        if (c.lit('exerted')) { spec.filters.push({ exerted: true }); continue; }
        if (c.lit('ready')) { spec.filters.push({ exerted: false }); continue; }
        if (c.lit('damaged')) { spec.filters.push({ damage: { atLeast: 1 } }); continue; }
        if (c.lit('undamaged')) { spec.filters.push({ damage: { equal: 0 } }); continue; }
        if (c.lit('non-character')) { spec.filters.push({ not: { cardType: 'Character' } }); continue; }
        const list = c.list(() => classification(c) ?? ink(c), ['or', 'and']);
        if (list) {
            for (const entry of list) {
                if ((inks as readonly string[]).includes(entry)) classInks.push(entry as Ink);
                else classes.push(entry);
            }
            continue;
        }
        break;
    }
    if (classes.length === 1) spec.filters.push({ classification: classes[0] as Subtype });
    else if (classes.length > 1) spec.filters.push({ or: classes.map(entry => ({ classification: entry as Subtype })) });
    if (classInks.length === 1) spec.filters.push({ inkType: classInks[0] });
    else if (classInks.length > 1) spec.filters.push({ or: classInks.map(entry => ({ inkType: entry })) });
    return classes.length > 0;
}

/** A numeric comparison such as "cost 3 or less" after "with". */
export function costComparison(c: Parser): Comparison | undefined {
    return c.try(() => {
        if (c.lit('equal to or less than')) {
            const value = amountOf(c);
            return value === undefined ? undefined : { atMost: value };
        }
        const value = digits(c);
        if (value === undefined) return undefined;
        return comparisonSuffix(c, value);
    });
}

/** "with ..." and other phrases after the type noun. Returns false if nothing matched. */
function postmodifier(c: Parser, spec: Spec, steps: Step[]): boolean {
    const matched = c.try(() => {
        if (c.lit('of yours')) { spec.player = 'You'; return true; }
        if (c.lit('of theirs')) { spec.player = members(c.state.they ?? c.state.actor); return true; }
        if (c.lit('you have in play', 'you have', 'you control')) { spec.player = 'You'; return true; }
        if (c.lit('opponents have in play', 'an opponent has in play')) { spec.player = 'Opponents'; return true; }
        if (c.lit('each opposing player has in play', 'each illumineer has in play')) { spec.player = 'Opponents'; return true; }
        if (c.lit('they have in play')) { spec.player = members(c.state.they ?? c.state.actor); return true; }
        if (c.lit('in play')) { spec.zone = 'Play'; return true; }
        if (c.lit('here')) {
            spec.filters.push({ at: c.state.source === 'Character' ? { locationOf: 'Self' } : 'Self' });
            return true;
        }
        if (c.lit('at a location', 'at locations')) { spec.filters.push({ at: { zone: 'Play', cardType: 'Location' } }); return true; }
        if (c.lit('each') && !c.peek('of')) return true;
        if (c.lit('who was challenged this turn')) {
            spec.within = { events: { event: 'Challenge' }, during: 'This Turn', role: 'Defender' };
            return true;
        }
        if (c.lit('you removed damage from this way')) { spec.within = { result: 'Characters With Damage Removed' }; return true; }
        if (c.lit('you played this turn')) {
            spec.within = { events: { event: 'Play', player: 'You' }, during: 'This Turn' };
            return true;
        }
        if (c.lit('with that name')) { spec.filters.push({ namedCard: 'Named Card' }); return true; }
        // "the highest cost, or tied for highest cost" compares with every character in play.
        if (c.lit('with the highest cost, or tied for highest cost')) { spec.extreme = 'Highest'; spec.extremeAll = true; return true; }
        if (c.lit('with the highest cost')) { spec.extreme = 'Highest'; return true; }
        if (c.lit('with the lowest cost')) { spec.extreme = 'Lowest'; return true; }
        if (c.lit('with the same cost or less')) { spec.filters.push({ cost: { atMost: { stat: 'Cost', card: it(c) } } }); return true; }
        const costUpTo = c.try(() => {
            if (!c.lit('with cost up to')) return undefined;
            const n = digits(c);
            if (n === undefined || !c.lit('more than')) return undefined;
            const other = cardsReference(c) ?? (c.lit('the banished character') ? { result: 'Paid Cards' } as CardSelection : undefined);
            return other === undefined ? undefined : { cost: { atMost: { add: [{ stat: 'Cost', card: other }, n] } } } as CardFilter;
        });
        if (costUpTo) { spec.filters.push(costUpTo); return true; }
        const lessThan = c.try(() => {
            if (!c.lit('with less')) return undefined;
            const which = statSymbol(c);
            if (!which || !c.lit('than')) return undefined;
            const other = cardsReference(c);
            return other === undefined ? undefined : { [which.toLowerCase()]: { lessThan: { stat: which, card: other } } } as CardFilter;
        });
        if (lessThan) { spec.filters.push(lessThan); return true; }
        const statAtMost = c.try(() => {
            if (!c.lit('with')) return undefined;
            const which = statSymbol(c);
            if (!which || !c.lit('equal to or less than')) return undefined;
            const value = amountOf(c);
            return value === undefined ? undefined : { [which.toLowerCase()]: { atMost: value } } as CardFilter;
        });
        if (statAtMost) { spec.filters.push(statAtMost); return true; }
        const total = c.try(() => {
            if (!c.lit('with total')) return undefined;
            const which = statSymbol(c);
            const n = digits(c);
            if (!which || n === undefined) return undefined;
            const comparison = comparisonSuffix(c, n);
            return comparison ? { value: { sum: { stat: which, cards: 'Selected Cards' } }, is: comparison } as import('../model/ability').Condition : undefined;
        });
        if (total) { spec.group = total; return true; }
        if (c.lit('at that location')) { spec.filters.push({ at: { locationOf: it(c) } }); return true; }
        if (c.lit('that has a card under them', 'that have a card under them', 'with a card under them', 'with a card under it',
            'with cards under them', 'with a card under him', 'with a card under her')) {
            spec.filters.push({ cardsUnder: { atLeast: 1 } });
            return true;
        }
        if (c.lit("that isn't a song card", "that isn't a song")) { spec.filters.push({ not: { song: true } }); return true; }
        if (c.lit('with {K}')) { spec.filters.push({ inkable: true }); return true; }
        if (c.lit('with damage')) { spec.filters.push({ damage: { atLeast: 1 } }); return true; }
        if (c.lit('with no damage')) { spec.filters.push({ damage: { equal: 0 } }); return true; }
        if (c.lit('not named')) {
            const name = cardName(c);
            if (!name) return undefined;
            spec.filters.push({ not: { name } });
            return true;
        }
        if (c.lit('named')) {
            const list = nameList(c);
            if (!list) return undefined;
            spec.filters.push(list.length === 1 ? { name: list[0] } : { or: list.map(name => ({ name })) });
            return true;
        }
        if (c.lit('with the same name as')) {
            const other = cardsReference(c);
            if (!other) return undefined;
            spec.filters.push({ sameNameAs: other });
            return true;
        }
        if (c.lit('with the same name')) { spec.filters.push({ sameNameAs: it(c) }); return true; }
        if (c.lit('without')) {
            const word = keyword(c);
            if (!word) return undefined;
            spec.filters.push({ not: { keyword: word } });
            return true;
        }
        if (c.lit('with cost')) {
            const comparison = costComparison(c);
            if (!comparison) return undefined;
            spec.filters.push({ cost: comparison });
            return true;
        }
        const stat = c.try(() => {
            if (!c.lit('with')) return undefined;
            const value = digits(c);
            if (value === undefined) return undefined;
            const which = statSymbol(c);
            if (!which) return undefined;
            const comparison = comparisonSuffix(c, value);
            if (!comparison) return undefined;
            return { [which.toLowerCase()]: comparison } as CardFilter;
        });
        if (stat) { spec.filters.push(stat); return true; }
        const withKeyword = c.try(() => {
            if (!c.lit('with')) return undefined;
            return c.list(() => keyword(c), ['or']);
        });
        if (withKeyword) {
            spec.filters.push(withKeyword.length === 1 ? { keyword: withKeyword[0] } : { or: withKeyword.map(k => ({ keyword: k })) });
            return true;
        }
        const zone = zonePhrase(c, steps);
        if (zone) {
            spec.zone = zone.zone;
            if (zone.player !== undefined) spec.player = zone.player;
            if (zone.under !== undefined) spec.under = zone.under;
            if (zone.alsoHand) spec.filters.push({ or: [{ zone: 'Hand' }, { zone: 'Discard' }] });
            return true;
        }
        return undefined;
    });
    return matched === true;
}

/** "from your discard", "in your hand", "from under it" and similar. */
export function zonePhrase(c: Parser, steps: Step[]): { zone: Zone | 'Any'; player?: PlayerSelection; under?: CardSelection; alsoHand?: boolean } | undefined {
    return c.try(() => {
        if (!c.lit('from', 'in')) return undefined;
        if (c.lit('under')) {
            const owner = cardsReference(c) ?? c.try(() => {
                const np = cardNP(c, steps);
                return np?.kind === 'Fixed' ? np.cards : undefined;
            });
            return owner ? { zone: 'Under', under: owner } : undefined;
        }
        if (c.lit('any discard')) return { zone: 'Discard' };
        const player = possessive(c, steps);
        if (player === undefined) return undefined;
        if (c.lit('hand or discard')) return { zone: 'Any', player, alsoHand: true };
        if (c.lit('discard')) return { zone: 'Discard', player };
        if (c.lit('hand', 'hands')) return { zone: 'Hand', player };
        if (c.lit('inkwell')) return { zone: 'Inkwell', player };
        if (c.lit('deck')) return { zone: 'Deck', player };
        return undefined;
    });
}

/** Pronouns and definite references to cards already mentioned. */
export function cardsReference(c: Parser): CardSelection | undefined {
    if (c.lit('this character', 'this item', 'this location', 'this card')) return 'Self';
    if (c.lit('the challenging character')) return c.state.continuous ? { challengeParticipant: 'Attacker' } : { event: 'Attacker' };
    if (c.lit('the challenged character')) return { event: 'Defender' };
    // "that character" skips later non-character choices, e.g. cards chosen to discard.
    if (c.lit('that character', 'those characters', 'the chosen character', 'the exerted character', 'the banished character'))
        return c.state.characterRef ?? it(c);
    if (c.lit('the moved character')) return c.state.moved ?? it(c);
    if (c.lit('that location')) return c.state.location ?? it(c);
    if (c.lit('that card', 'that item', 'those cards',
        'the banished item', 'the other character',
        'that action card', 'that song', 'the revealed card', 'the revealed cards', 'the chosen card', 'that action',
        'them', 'they', 'it', 'each of them')) {
        return it(c);
    }
    if (c.lit('him', 'her', 'he', 'she')) return c.state.character ? it(c) : 'Self';
    return undefined;
}

/** A parsed card description without a determiner. */
export interface BareCards {
    spec: Spec;
    plural: boolean;
    /** The live selector. A player override replaces the owner phrase ("their hand" for each opponent). */
    cards(player?: PlayerSelection): CardSelection;
    /** The description as a filter, for testing one known card. */
    filter(): CardFilter;
    /** Also match cards outside play, e.g. for history and events. */
    anyZone(exclude?: CardSelection): CardSelection;
}

/**
 * Adjectives, type noun and modifiers: "opposing damaged characters with cost 2 or less".
 * `player` is the default owner when none is printed.
 */
export function bareCards(c: Parser, steps: Step[], player?: PlayerSelection, allowBareSingular = true): BareCards | undefined {
    return c.try((): BareCards | undefined => {
        const spec: Spec = { types: [], filters: [] };
        const saved = c.state.they;
        if (player !== undefined) c.state.they = player;
        try {
            const classified = premodifiers(c, spec, player);
            const noun = typeNoun(c) ?? (classified && !c.peek('(characters?|cards?)\\b') ? { types: ['Character'] as CardType[], plural: false, card: false } : undefined);
            if (!noun) return undefined;
            if (!allowBareSingular && !noun.plural) return undefined;
            spec.types = noun.types;
            if (noun.song) spec.filters.push({ song: true });
            spec.explicitCard = noun.card;
            while (postmodifier(c, spec, steps)) { /* consume */ }
            if (spec.player === undefined && player !== undefined) spec.player = player;
            return describe(spec, noun.plural);
        } finally {
            c.state.they = saved;
        }
    });
}

/** Apply history narrowing and "highest/lowest" comparisons to a selector. */
function finish(spec: Spec, base: CardSelector): CardSelection {
    let cards: CardSelection = base;
    if (spec.extreme) {
        const { where, ...rest } = base;
        const pool: CardSelector = spec.extremeAll ? { zone: 'Play', cardType: 'Character' } : { ...rest, ...(where ? { where } : {}) };
        const key = spec.extreme === 'Highest' ? 'highest' : 'lowest';
        const extreme = { [key]: { stat: 'Cost', cards: pool } } as Amount;
        cards = { ...rest, where: mergeFilters([where ?? {}, { cost: { equal: extreme } }]) };
    }
    if (spec.within !== undefined) {
        const typed = cards as CardSelector;
        cards = { filter: spec.within, where: mergeFilters([{ zone: typed.zone === 'Any' ? undefined : typed.zone },
            typed.cardType ? { cardType: typed.cardType } : {}, typed.where ?? {}]) ?? {} };
    }
    return cards;
}

function describe(spec: Spec, plural: boolean): BareCards {
    return {
        spec, plural,
        cards(player) {
            const owner = player !== undefined && spec.player !== undefined ? player : spec.player;
            return finish(spec, selector({ ...spec, ...(owner !== undefined ? { player: owner } : {}) }));
        },
        filter() {
            const filters = [...spec.filters];
            if (spec.types.length === 1) filters.unshift({ cardType: spec.types[0] });
            else if (spec.types.length > 1) filters.unshift({ or: spec.types.map(type => ({ cardType: type })) });
            return mergeFilters(filters) ?? {};
        },
        anyZone(exclude) {
            return finish(spec, selector({ ...spec, zone: spec.zone === undefined || spec.zone === 'Play' ? 'Any' : spec.zone,
                ...(exclude !== undefined ? { exclude } : {}) }));
        },
    };
}

/** "the top 3 cards of your deck", "the top card of chosen player's deck". */
export function deckTop(c: Parser, steps: Step[], actor: PlayerSelection): CardSelection | undefined {
    return c.try(() => {
        if (c.lit('a card from the top of your deck')) return { zone: 'Deck', player: 'You', position: 'Top', take: 1 } as CardSelection;
        if (!c.lit('the top')) return undefined;
        const n = c.try(() => {
            const value = number(c);
            return value !== undefined && c.lit('cards') ? value : undefined;
        }) ?? (c.lit('card') ? 1 : undefined);
        if (n === undefined) return undefined;
        if (!c.lit('of')) return { zone: 'Deck', player: actor, position: 'Top', take: n } as CardSelection;
        const owner = possessive(c, steps) ?? actor;
        if (!c.lit('deck')) return undefined;
        return { zone: 'Deck', player: owner, position: 'Top', take: n } as CardSelection;
    });
}

/** Whole zones and stacks: "your hand", "all cards from under this location". */
function zoneContents(c: Parser, steps: Step[]): CardSelection | undefined {
    return c.try((): CardSelection | undefined => {
        c.lit('all of', 'all');
        c.lit('the');
        if (c.lit('cards that were under them', 'cards that were under him', 'cards that were under her')) {
            return { atEvent: 'Before', cards: { zone: 'Under', under: it(c) } };
        }
        const cardsWord = Boolean(c.lit('cards'));
        if (cardsWord && c.lit('from under', 'under')) {
            const reference = cardsReference(c);
            if (reference !== undefined) return { zone: 'Under', under: reference };
            const np = cardNP(c, steps);
            if (!np) return undefined;
            return { zone: 'Under', under: useCards(c, np, steps) };
        }
        if (cardsWord) c.lit('in', 'from');
        const owner = possessive(c, steps);
        if (owner === undefined) return undefined;
        if (c.lit('hand', 'hands')) return { zone: 'Hand', player: owner };
        if (cardsWord && c.lit('inkwell')) return { zone: 'Inkwell', player: owner };
        return undefined;
    });
}

/**
 * "the highest cost character each opposing player has in play", "the opposing
 * character with the lowest cost". Ties are broken by a choice.
 */
function extremeNP(c: Parser): CardNP | undefined {
    const cost = (order: 'highest' | 'lowest', pool: CardSelector): CardSelector =>
        ({ ...pool, where: { cost: { equal: { [order]: { stat: 'Cost', cards: pool } } as Amount } } });
    if (c.lit('the highest cost character each opposing player has in play', 'the character with the highest cost each illumineer has in play')) {
        return { kind: 'Choose', from: cost('highest', { zone: 'Play', player: 'Opponents', cardType: 'Character' }), count: 1, chosen: false,
            plural: false, perPlayer: 'Opponents' };
    }
    if (c.lit('the opposing character with the lowest cost')) {
        return { kind: 'Choose', from: cost('lowest', { zone: 'Play', player: 'Opponents', cardType: 'Character' }), count: 1, chosen: false, plural: false };
    }
    return undefined;
}

/** Parse a card phrase. Choices made while naming a zone are appended to steps. */
export function cardNP(c: Parser, steps: Step[]): CardNP | undefined {
    return c.try((): CardNP | undefined => {
        c.state.possessive = false;
        const top = deckTop(c, steps, c.state.actor);
        if (top) return { kind: 'Fixed', cards: top, plural: true };
        const zone = zoneContents(c, steps);
        if (zone) return { kind: 'Fixed', cards: zone, plural: true };
        const reference = cardsReference(c);
        if (reference !== undefined) {
            const plural = reference !== 'Self' && /them|they|those|each of/i.test(c.text.slice(Math.max(0, c.pos - 14), c.pos));
            return { kind: 'Fixed', cards: reference, plural, referred: true };
        }
        const extreme = c.try(() => extremeNP(c));
        if (extreme) return extreme;
        const det = c.lit('a chosen') ? { kind: 'Choose' as const, count: 1, chosen: true } : determiner(c);
        if (!det || det.kind === 'The') return undefined;
        const described = bareCards(c, steps, det.player, det.kind !== 'Bare');
        if (!described) return undefined;
        // "chosen character with Bodyguard or item", "an Alien character card or a location card"
        const alternative = det.kind === 'Choose' || det.kind === 'Indefinite' ? c.try(() => {
            if (!c.lit('or')) return undefined;
            c.lit('a', 'an');
            return bareCards(c, steps, det.player);
        }) : undefined;
        if (alternative) {
            const first = described.filter();
            const second = alternative.filter();
            described.spec.types = [];
            described.spec.filters = [{ or: [first, second] }];
            if (alternative.spec.zone !== undefined) described.spec.zone = alternative.spec.zone;
            if (alternative.spec.player !== undefined) described.spec.player = alternative.spec.player;
        }
        if (det.other) described.spec.exclude = c.state.chosen ?? 'Self';
        const cards = described.cards();
        const plural = described.plural || det.kind === 'All';
        switch (det.kind) {
            case 'Choose':
                return { kind: 'Choose', from: cards, count: det.count ?? 1, chosen: Boolean(det.chosen), plural: plural || det.count !== 1,
                    ...(described.spec.group ? { groupWhere: described.spec.group } : {}), ...(c.state.possessive ? { possessive: true } : {}) };
            case 'Indefinite':
                return { kind: 'Choose', from: cards, count: det.count ?? 1, chosen: false, plural: plural || det.count !== 1 };
            case 'All':
            case 'Bare':
                return { kind: 'Fixed', cards, plural: true };
        }
    });
}

/**
 * Use a card phrase as an instruction operand. Choices become steps whose
 * placeholder later becomes Selected Cards, and set the pronoun referent.
 */
export function useCards(c: Parser, np: CardNP, steps: Step[]): CardSelection {
    if (np.kind === 'Fixed') {
        if (np.cards !== 'Self' && typeof np.cards === 'object' && 'zone' in np.cards) c.state.it = np.cards;
        if (typeof np.cards === 'object' && 'zone' in np.cards && np.cards.cardType === 'Location') c.state.location = np.cards;
        return np.cards;
    }
    if (np.perPlayer !== undefined) {
        const player = nextId(c);
        const from = JSON.parse(JSON.stringify(np.from).split('"Opponents"').join(JSON.stringify(playerRef(player)))) as CardSelection;
        steps.push({ kind: 'For Each Player', id: player, players: np.perPlayer });
        const id = nextId(c);
        steps.push({ kind: 'Choose Cards', id, from, count: np.count, player: playerRef(player) });
        c.state.it = cardRef(id);
        c.state.single = [...(c.state.single ?? []), id];
        return cardRef(id);
    }
    const id = nextId(c);
    steps.push({ kind: 'Choose Cards', id, from: np.from, count: np.count,
        ...(np.groupWhere ? { where: np.groupWhere } : {}),
        ...(np.chooser !== undefined && np.chooser !== 'You' ? { player: np.chooser } : {}) });
    const ref = cardRef(id);
    c.state.it = ref;
    // Private hand/discard choices must not replace a previous battlefield target.
    if (np.chosen || (typeof np.from === 'object' && 'zone' in np.from && np.from.zone === 'Play'))
        c.state.chosen = ref;
    c.state.character = isCharacter(np.from);
    if (c.state.character) c.state.characterRef = ref;
    if (typeof np.from === 'object' && 'zone' in np.from && np.from.cardType === 'Location') c.state.location = ref;
    if (typeof np.from === 'object' && 'zone' in np.from && np.from.cardType === 'Character' && np.from.where?.at)
        c.state.location = { locationOf: ref };
    if (np.count === 1) c.state.single = [...(c.state.single ?? []), id];
    return ref;
}

/** Whether a selection only contains characters, so "he" or "she" can refer to it. */
function isCharacter(cards: CardSelection): boolean {
    if (typeof cards !== 'object') return false;
    if ('zone' in cards) return cards.cardType === 'Character' || cards.where?.cardType === 'Character';
    if ('filter' in cards) return cards.where.cardType === 'Character' || isCharacter(cards.filter);
    return false;
}

/** Parse and use a card phrase in one step. */
export function cards(c: Parser, steps: Step[]): CardSelection | undefined {
    const np = cardNP(c, steps);
    return np === undefined ? undefined : useCards(c, np, steps);
}

/**
 * Numeric expressions: "2", "their {S}", "the number of ...", "the damage on chosen character".
 * Choices are only allowed when `steps` is given to receive them.
 */
export function amountOf(c: Parser, steps?: Step[]): Amount | undefined {
    return c.try((): Amount | undefined => {
        const local: Step[] = [];
        const done = (amount: Amount | undefined): Amount | undefined => {
            if (amount === undefined) return undefined;
            if (local.length && !steps) return undefined;
            steps?.push(...local);
            return amount;
        };
        if (c.lit('that number', 'that amount', 'that many')) return c.state.counted ?? undefined;
        if (c.lit('the same amount', 'that much')) return { event: 'Amount' };
        if (c.lit('the lore lost this way', 'the lore lost')) return { result: 'Lore Lost' };
        if (c.lit('the number of')) {
            const np = cardNP(c, local);
            if (!np) return undefined;
            return done({ count: np.kind === 'Fixed' ? np.cards : np.from });
        }
        const had = c.try(() => {
            if (!c.lit('the')) return undefined;
            const which = statSymbol(c);
            return which && c.lit('he had in play', 'she had in play', 'they had in play')
                ? { atEvent: 'Before', value: { stat: which, card: 'Self' } } as Amount : undefined;
        });
        if (had) return had;
        const possessed = c.try(() => {
            const np = cardNP(c, local);
            if (!np || np.kind !== 'Choose' || !np.possessive) return undefined;
            const which = statSymbol(c);
            if (!which) return undefined;
            return { stat: which, card: useCards(c, np, local) } as Amount;
        });
        if (possessed) return done(possessed);
        const owner = c.try((): CardSelection | undefined => {
            if (c.lit('their', 'its', 'his', 'her')) return it(c);
            if (c.lit("this character's", "this location's")) return 'Self';
            if (c.lit("that location's")) return c.state.location ??
                (c.state.source === 'Character' && it(c) === 'Self' ? { locationOf: 'Self' } : it(c));
            if (c.lit("that character's", "the chosen character's", "the banished character's",
                "the exerted character's", "the discarded character's", "the chosen character's")) return it(c);
            return undefined;
        });
        if (owner !== undefined) {
            const which = statSymbol(c) ?? (c.lit('cost') ? 'Cost' as const : undefined);
            if (!which) return undefined;
            const past = c.lit('in play') ? true : false;
            const amount: Amount = { stat: which, card: owner };
            return past ? { atEvent: 'Before', value: amount } : amount;
        }
        const statOf = c.try((): Amount | undefined => {
            if (!c.lit('the')) return undefined;
            const which = statSymbol(c) ?? (c.lit('cost') ? 'Cost' as const : undefined) ?? (c.lit('damage') ? 'Damage' as const : undefined);
            if (!which || !c.lit('of', 'on')) return undefined;
            const reference = cardsReference(c);
            if (reference !== undefined) return { stat: which, card: reference };
            const np = cardNP(c, local);
            if (!np) return undefined;
            const card = useCards(c, np, local);
            return { stat: which, card };
        });
        if (statOf) return done(statOf);
        return number(c);
    });
}

export function unsupported(message: string): never {
    throw new Unsupported(message);
}
