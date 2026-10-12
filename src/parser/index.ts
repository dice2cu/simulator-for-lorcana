/**
 * Parses printed card text directly into the ability model. Every printed
 * slot must be consumed completely; anything else is reported as unsupported.
 */
import type { Ability, CardRules, CardSelection, Condition, Cost, Effect, KeywordAbility, PlayRule } from '../model/ability';
import type { CatalogCard as Catalogued } from '../cards';
import { validateCardRules } from '../model/validate';
import { Cursor, Unsupported, normalize } from './text';
import { type Parser, type Source, assertResolved, simplify } from './core';
import { slotAbility, state } from './abilities';
import { instructions } from './effects';
import { condition } from './conditions';
import { addCardNames, bareCards, classification, digits } from './nouns';

export { addCardNames };

/** The catalog fields the parser reads. */
export type CatalogCard = Pick<Catalogued, 'fullName' | 'type'> & Partial<Pick<Catalogued, 'name' | 'names' | 'abilities' | 'effects'>>;

export interface ParseIssue {
    source: 'Ability' | 'Effect' | 'Card';
    index: number;
    text: string;
    reason: string;
}

export type ParseResult =
    | { supported: true; rules: CardRules }
    | { supported: false; issues: ParseIssue[] };

/** Where parsing stopped, for diagnostics. */
function stopped(c: Parser): string {
    return `Unrecognized text: ${c.text.slice(0, c.furthest)} ⟪${c.text.slice(c.furthest)}⟫`;
}

function cursor(source: Source, text: string): Parser {
    return new Cursor(text, state(source, text));
}

// ---------------------------------------------------------------------------
// Keywords

const simple = ['Alert', 'Bodyguard', 'Evasive', 'Reckless', 'Rush', 'Support', 'Vanish', 'Ward', 'Adventurous'] as const;

function keywordAbility(text: string, card: CatalogCard): KeywordAbility {
    const found = simple.find(name => name.toLowerCase() === text.toLowerCase());
    if (found) return { name: found };
    const numeric = /^(Challenger|Resist) \+(\d+)$|^(Singer) (\d+)$/i.exec(text);
    if (numeric) {
        const name = (numeric[1] ?? numeric[3]).toLowerCase();
        return { name: name === 'challenger' ? 'Challenger' : name === 'resist' ? 'Resist' : 'Singer', amount: Number(numeric[2] ?? numeric[4]) };
    }
    const boost = /^Boost (\d+) \{I\}$/i.exec(text);
    if (boost) return { name: 'Boost', cost: [{ type: 'Ink', amount: Number(boost[1]) }] };
    const shift = /^(?:(Universal|Duo|Combo|Temporary|Temporary Red Panda|Puppy|Madrigal|Floodborn|Potato) )?Shift(?: (\d+)(?: \{I\})?|: (.+))$/i.exec(text);
    if (shift) return shiftAbility(shift[1], shift[2] === undefined ? undefined : Number(shift[2]), shift[3], card);
    throw new Unsupported(`Unknown keyword: ${text}`);
}

function shiftAbility(variant: string | undefined, ink: number | undefined, alternative: string | undefined, card: CatalogCard): KeywordAbility {
    const cost: Cost[] = ink !== undefined ? [{ type: 'Ink', amount: ink }] : discardCost(alternative ?? '');
    const names = card.names ?? [card.name ?? card.fullName];
    const yours = (where?: object): CardSelection => ({ zone: 'Play', player: 'You', cardType: 'Character', ...(where ? { where } : {}) }) as CardSelection;
    switch (variant?.toLowerCase()) {
        case undefined: return { name: 'Shift', cost };
        case 'universal': return { name: 'Shift', cost, onto: yours() };
        case 'duo': return { name: 'Shift', cost, count: 2, names: [...names] };
        case 'combo': return { name: 'Shift', cost, count: 'One Or Two', onto: yours({ or: names.map(name => ({ name })) }),
            when: { differentNames: 'Selected Cards' } };
        case 'potato': return { name: 'Shift', cost, onto: { zone: 'Play', player: 'You', cardType: 'Item', where: { name: 'Potato' } } };
        case 'temporary':
        case 'temporary red panda': {
            // Self remains this physical card, rather than a character target inherited by a later Shift.
            const self: CardSelection = { filter: 'Self', where: { zone: 'Play' } };
            const afterShift: Effect = { type: 'Create Trigger',
                trigger: { event: 'Turn End', player: 'You', when: { exists: self } },
                duration: { until: 'End Of Turn' }, uses: 1,
                effect: { type: 'Sequence', effects: [
                    { type: 'Remove Damage', cards: self, amount: 'All' },
                    { type: 'Move Card', cards: self, to: 'Hand', wholeStack: false },
                ] },
            };
            return { name: 'Shift', cost, ...(variant.toLowerCase() === 'temporary red panda'
                ? { onto: yours({ classification: 'Red Panda' }) } : {}), afterShift };
        }
        default: {
            const kind = variant === undefined ? undefined : classification(cursor('Character', variant));
            if (!kind) throw new Unsupported(`Unknown Shift variant: ${variant}`);
            return { name: 'Shift', cost, onto: yours({ classification: kind }) };
        }
    }
}

/** "Discard 2 cards", "Discard a location card". */
function discardCost(text: string): Cost[] {
    const c = cursor('Character', normalize(text));
    if (!c.lit('discard')) throw new Unsupported(`Unknown Shift cost: ${text}`);
    const n = c.try(() => {
        const value = digits(c);
        return value !== undefined && c.lit('cards') ? value : undefined;
    });
    if (n !== undefined && c.done) {
        return [{ type: 'Choose Cards', from: { zone: 'Hand', player: 'You' }, count: n, cost: [{ type: 'Discard', cards: 'Selected Cards' }] }];
    }
    c.lit('a', 'an');
    const spec = bareCards(c, [], 'You');
    if (!spec || !c.done) throw new Unsupported(`Unknown Shift cost: ${text}`);
    const from = { zone: 'Hand' as const, player: 'You' as const, where: spec.filter() };
    return [{ type: 'Choose Cards', from, count: 1, cost: [{ type: 'Discard', cards: 'Selected Cards' }] }];
}

// ---------------------------------------------------------------------------
// Play rules and deck construction

/** Song costs and play requirements printed on actions. */
function playRule(text: string): PlayRule | undefined {
    const sing = /^A character with cost (\d+) or more can \{E\} to sing this song for free\.?$/i.exec(text);
    if (sing) return { type: 'Sing', cost: Number(sing[1]) };
    const together = /^Sing Together (\d+)$/i.exec(text);
    if (together) return { type: 'Sing Together', cost: Number(together[1]) };
    const requirement = /^You can't play this (?:action|character|item|location) unless (.+?)\.?$/i.exec(text);
    if (requirement) {
        const c = cursor('Action', requirement[1]);
        const test = condition(c);
        if (test && c.done) return { type: 'Requirement', when: test };
    }
    return undefined;
}

function deckConstruction(text: string, card: CatalogCard): Ability | undefined {
    const upTo = /^You may have up to (\d+) copies of (.+) in your deck\.?$/i.exec(text);
    if (upTo && upTo[2] === card.fullName) return { type: 'Deck Construction', maxCopies: Number(upTo[1]) };
    const only = /^You may only have (\d+) copies of (.+) in your deck\.?$/i.exec(text);
    if (only && only[2] === card.fullName) return { type: 'Deck Construction', maxCopies: Number(only[1]) };
    const any = /^You may have any number of cards named (.+) in your deck\.?$/i.exec(text);
    if (any && any[1] === (card.name ?? card.fullName)) return { type: 'Deck Construction', maxCopies: 'Unlimited' };
    const ink = /^You can have (.+) in your deck regardless of ink type\.?$/i.exec(text);
    if (ink) {
        const c = cursor('Character', ink[1]);
        c.lit('other');
        const spec = bareCards(c, [], undefined);
        if (spec && c.done) return { type: 'Deck Construction', anyInk: spec.filter() };
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Cards

function source(type: string): Source {
    if (type === 'Character' || type === 'Item' || type === 'Location' || type === 'Action') return type;
    throw new Unsupported(`Unknown card type: ${type}`);
}

function parseText(kind: Source, text: string): Ability {
    const c = cursor(kind, text);
    const ability = slotAbility(c);
    if (!ability) throw new Unsupported(stopped(c));
    return ability;
}

/** "Deal 2 damage to chosen character. During your turn, when you discard this card, ...": effect, then ability. */
function splitAbility(text: string): { effect?: Effect; ability: Ability } | undefined {
    const sentences = text.split(/(?<=\.) (?=[A-Z])/);
    for (let i = 0; i < sentences.length; i++) {
        try {
            const ability = parseText('Action', sentences.slice(i).join(' '));
            // A resolving action paragraph cannot become a static ability in play.
            if (ability.type === 'Static' && (ability.from ?? ['Play']).includes('Play')) continue;
            const effect = i ? parseEffect(sentences.slice(0, i).join(' ')) : undefined;
            return { ...(effect ? { effect } : {}), ability };
        } catch (error) {
            if (!(error instanceof Unsupported)) throw error;
        }
    }
    return undefined;
}

/** "You can't play this character unless ..." on a character, item or location. */
function playRequirement(text: string): Ability | undefined {
    const requirement = /^You can't play this (?:character|item|location) unless (.+?)\.?$/i.exec(text);
    if (!requirement) return undefined;
    const c = cursor('Character', requirement[1]);
    const test = condition(c);
    if (!test || !c.done) return undefined;
    return { type: 'Static', from: ['Hand', 'Deck', 'Discard', 'Inkwell', 'Under'],
        rule: { type: 'Conditional', if: { not: test }, then: { type: 'Modify Cards', cards: 'Self', modifier: { restriction: "Can't Be Played" } } } };
}

function parseEffect(text: string): Effect {
    const c = cursor('Action', text);
    const effect = c.try(() => {
        const result = instructions(c);
        return result && c.done ? result : undefined;
    });
    if (!effect) throw new Unsupported(stopped(c));
    assertResolved(effect);
    return effect;
}

export function parseCard(card: CatalogCard): ParseResult {
    const issues: ParseIssue[] = [];
    let kind: Source;
    try {
        kind = source(card.type);
    } catch (error) {
        return { supported: false, issues: [{ source: 'Card', index: 0, text: card.type, reason: (error as Error).message }] };
    }
    const abilities: Ability[] = [];
    const playRules: PlayRule[] = [];
    const effects: Effect[] = [];
    const attempt = (source: ParseIssue['source'], index: number, text: string, run: () => void): void => {
        try {
            run();
        } catch (error) {
            if (!(error instanceof Unsupported)) throw error;
            issues.push({ source, index, text, reason: error.message });
        }
    };
    (card.abilities ?? []).forEach((slot, index) => {
        const printed = slot.type === 'activated' && slot.costsText
            ? `${slot.costsText} — ${slot.effect ?? ''}` : slot.effect ?? slot.fullText;
        const text = normalize(slot.type === 'keyword' ? slot.fullText : printed);
        attempt('Ability', index, text, () => {
            if (slot.type === 'keyword') {
                if (kind === 'Action') {
                    const rule = playRule(text);
                    if (!rule) throw new Unsupported(`Unknown action keyword: ${text}`);
                    playRules.push(rule);
                    return;
                }
                abilities.push({ type: 'Keyword', keyword: keywordAbility(text, card) });
                return;
            }
            const deck = deckConstruction(text, card);
            if (deck) { abilities.push(slot.name !== undefined ? { ...deck, name: slot.name } as Ability : deck); return; }
            const requirement = kind === 'Action' ? undefined : playRequirement(text);
            if (requirement) { abilities.push(slot.name !== undefined ? { ...requirement, name: slot.name } as Ability : requirement); return; }
            if (kind === 'Action') {
                const rule = playRule(text);
                if (rule) { playRules.push(rule); return; }
            }
            const ability = parseText(kind, text);
            if (slot.name !== undefined && ability.type !== 'Keyword') abilities.push({ ...ability, name: slot.name });
            else abilities.push(ability);
        });
    });
    if (kind === 'Action') {
        const printed = card.effects ?? [];
        if (!printed.length) issues.push({ source: 'Card', index: 0, text: card.fullName, reason: 'Action has no effect text' });
        printed.forEach((raw, index) => {
            const text = normalize(raw);
            attempt('Effect', index, text, () => {
                try {
                    effects.push(parseEffect(text));
                } catch (error) {
                    // Some action paragraphs are, or end with, abilities that work from another zone.
                    const split = splitAbility(text);
                    if (!split) throw error;
                    if (split.effect) effects.push(split.effect);
                    abilities.push(split.ability);
                }
            });
        });
    }
    if (issues.length) return { supported: false, issues };
    let rules: CardRules;
    if (kind === 'Action') {
        const effect: Effect = effects.length === 1 ? effects[0] : { type: 'Sequence', effects };
        rules = { type: 'Action', effect, ...(playRules.length ? { playRules } : {}), ...(abilities.length ? { abilities } : {}) };
    } else {
        rules = { type: kind, abilities };
    }
    rules = simplify(rules);
    const invalid = validateCardRules(rules);
    if (invalid.length) {
        return { supported: false, issues: invalid.map(issue => ({ source: 'Card', index: 0, text: card.fullName,
            reason: `Invalid model at ${issue.path}: ${issue.message}` })) };
    }
    return { supported: true, rules };
}

// ---------------------------------------------------------------------------
// Catalog report

export interface CatalogReport {
    summary: { printings: number; supportedPrintings: number; slots: number; supportedSlots: number; unsupportedWordings: number };
    unsupported: { text: string; reason: string; cards: string[] }[];
    parsed: { card: string; index: number; rules: CardRules }[];
}

export function parseCatalog(cards: readonly CatalogCard[]): CatalogReport {
    addCardNames(cards);
    const grouped = new Map<string, { text: string; reason: string; cards: string[] }>();
    const parsed: CatalogReport['parsed'] = [];
    let supportedPrintings = 0;
    let slots = 0;
    let failedSlots = 0;
    cards.forEach((card, index) => {
        const result = parseCard(card);
        slots += (card.abilities?.length ?? 0) + (card.type === 'Action' ? card.effects?.length ?? 0 : 0);
        if (result.supported) {
            supportedPrintings++;
            parsed.push({ card: card.fullName, index, rules: result.rules });
            return;
        }
        failedSlots += result.issues.length;
        for (const issue of result.issues) {
            const key = `${issue.text}\u0000${issue.reason}`;
            const entry = grouped.get(key) ?? { text: issue.text, reason: issue.reason, cards: [] };
            if (!entry.cards.includes(card.fullName)) entry.cards.push(card.fullName);
            grouped.set(key, entry);
        }
    });
    const unsupported = [...grouped.values()].sort((a, b) => b.cards.length - a.cards.length || a.text.localeCompare(b.text));
    return {
        summary: { printings: cards.length, supportedPrintings, slots, supportedSlots: slots - failedSlots, unsupportedWordings: unsupported.length },
        unsupported, parsed,
    };
}

export type { Condition };
