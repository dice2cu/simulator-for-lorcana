import type { Amount, CardSelection, CardSelector, Condition, Duration, Effect, EventPattern, PlayerSelection } from '../model/ability';
import { Cursor, Unsupported } from './text';

export type Source = 'Character' | 'Item' | 'Location' | 'Action';

/**
 * Parse-time bindings. Placeholders stand for a choice made by an enclosing
 * instruction until folding knows how deeply that choice is nested.
 */
export interface State {
    source: Source;
    /** Next placeholder identifier. */
    ids: number;
    /** Cards that "they", "them", "that character" and similar words refer to. */
    it?: CardSelection;
    /** The most recent card choice, excluded by "another chosen". */
    chosen?: CardSelection;
    /** The player that "they" and "their" refer to. */
    they?: PlayerSelection;
    /** The player performing the current verb phrase. */
    actor: PlayerSelection;
    /** The triggering event, so event references can be checked while parsing. */
    event?: EventPattern;
    /** Card text written from the Illumineer's Quest boss's point of view. */
    boss: boolean;
    /** Whether a Name Card instruction occurred. */
    named: boolean;
    /** Results produced so far, which "this way" references can read. */
    results: string[];
    /** Inside a quoted granted ability, where outer bindings must be captured. */
    granted?: boolean;
    /** An amount counted earlier: "Count the number of ..." then "that number". */
    counted?: Amount;
    /** Player choices made while reading a condition, which must precede it. */
    conditionSteps?: Step[];
    /** "put each character card ... into your hand": the kind for the next looked-at choice. */
    eachKind?: import('../model/ability').CardFilter;
    /** The last chosen characters, which "that character" refers to. */
    characterRef?: CardSelection;
    /** The last chosen cards are characters, so "he" and "she" can refer to them. */
    character?: boolean;
    /** Parsing a continuous rule, where challenge references mean the current challenge. */
    continuous?: boolean;
    /** The last card phrase ended in "'s", as in "chosen character's {S}". */
    possessive?: boolean;
    /** The player choice made for a "chooses one:" sentence. */
    chooserId?: number;
    /** Cards counted by the last condition, for a static rule's "they". */
    conditionCards?: CardSelection;
    /** The characters most recently moved to a location, for "the moved character". */
    moved?: CardSelection;
    /** The location most recently moved to, for "that location". */
    location?: CardSelection;
    /** Choices known to select exactly one card. */
    single?: number[];
    /** Cards being looked at or revealed, which "one", "the rest" and "the other" refer to. */
    looked?: CardSelection;
    /** Choices already taken from the looked-at cards, excluded from "the rest". */
    taken?: CardSelection[];
    /** A duration printed before a clause, e.g. "For the rest of this turn, ...". */
    duration?: Duration;
    /** Parses triggers created by effects. Supplied by the ability layer to avoid an import cycle. */
    parseTrigger?: (c: Parser) => { pattern: EventPattern; duration?: Duration; uses?: number } | undefined;
}

export type Parser = Cursor<State>;

/** A placeholder for a card choice, resolved during folding. */
export interface CardRef { $cards: number }
/** A placeholder for a player choice, resolved during folding. */
export interface PlayerRef { $player: number }

export function cardRef(id: number): CardSelection {
    return { $cards: id } as unknown as CardSelection;
}

export function playerRef(id: number): PlayerSelection {
    return { $player: id } as unknown as PlayerSelection;
}

export function isCardRef(value: unknown): value is CardRef {
    return typeof value === 'object' && value !== null && '$cards' in value;
}

export function isPlayerRef(value: unknown): value is PlayerRef {
    return typeof value === 'object' && value !== null && '$player' in value;
}

export function nextId(c: Parser): number {
    return ++c.state.ids;
}

/**
 * Instructions in order. A scope step wraps every later step in the same list,
 * so later sentences can refer back to the chosen cards or player.
 */
export type Step =
    | { kind: 'Effect'; effect: Effect }
    | {
          kind: 'Choose Cards'; id: number; from: CardSelection;
          count: Amount | { upTo: Amount } | 'Any'; player?: PlayerSelection; where?: Condition;
      }
    | { kind: 'Random Cards'; id: number; from: CardSelection; count: Amount }
    | { kind: 'Search'; id: number; from: CardSelector; count: Amount | { upTo: Amount } }
    | { kind: 'For Each Card'; id: number; cards: CardSelection }
    | { kind: 'Choose Player'; id: number; from: PlayerSelection; player?: PlayerSelection }
    | { kind: 'For Each Player'; id: number; players: PlayerSelection };

export function effectStep(effect: Effect): Step {
    return { kind: 'Effect', effect };
}

/** Combine steps into one instruction, wrapping later steps in each scope. */
export function fold(steps: readonly Step[]): Effect {
    const effects: Effect[] = [];
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step.kind === 'Effect') {
            effects.push(step.effect);
            continue;
        }
        const rest = steps.slice(i + 1);
        if (!rest.length) throw new Unsupported('A choice has no instruction to apply to');
        const body = fold(rest);
        switch (step.kind) {
            case 'Choose Cards':
                effects.push(resolve({ type: 'Choose Cards', from: step.from, count: step.count,
                    ...(step.where ? { where: step.where } : {}),
                    ...(step.player && step.player !== 'You' ? { player: step.player } : {}), effect: body }, step.id, 'cards'));
                break;
            case 'Random Cards':
                effects.push(resolve({ type: 'Random Cards', from: step.from, count: step.count, effect: body }, step.id, 'cards'));
                break;
            case 'Search':
                effects.push(resolve({ type: 'Search', from: step.from, count: step.count, effect: body }, step.id, 'cards'));
                break;
            case 'For Each Card':
                effects.push(resolve({ type: 'For Each Card', cards: step.cards, effect: body }, step.id, 'cards'));
                break;
            case 'Choose Player':
                effects.push(resolve({ type: 'Choose Player', from: step.from,
                    ...(step.player && step.player !== 'You' ? { player: step.player } : {}), effect: body }, step.id, 'player'));
                break;
            case 'For Each Player':
                effects.push(resolve({ type: 'For Each Player', players: step.players, effect: body }, step.id, 'player'));
                break;
        }
        break;
    }
    if (effects.length === 1) return effects[0];
    return { type: 'Sequence', effects: effects.flatMap(effect => effect.type === 'Sequence' ? effect.effects : [effect]) };
}

/** Fields of a scope instruction evaluated outside the scope it opens. */
const outerFields: Record<string, string[]> = {
    'Choose Cards': ['from', 'count', 'player'],
    'Random Cards': ['from', 'count'],
    'For Each Card': ['cards'],
    'Choose Player': ['from', 'player'],
    'For Each Player': ['players'],
    'Search': ['from', 'count'],
};

const cardScopes = new Set(['Choose Cards', 'Random Cards', 'For Each Card', 'Search']);
const playerScopes = new Set(['Choose Player', 'For Each Player']);
/** Instructions whose bodies run later, so current choices must be captured. */
const futures = new Set(['Create Trigger', 'Delay', 'Create Rule']);

/**
 * Replace placeholders for the choice made by `root` with the binding
 * visible at each use. Card choices one level further in use Parent Selected Cards.
 */
function resolve(root: Effect, id: number, kind: 'cards' | 'player'): Effect {
    /** Captured references keep the depth at which their future instruction was created. */
    function walk(value: unknown, depth: number, captured: boolean): unknown {
        if (Array.isArray(value)) return value.map(item => walk(item, depth, captured));
        if (value === null || typeof value !== 'object') return value;
        if (kind === 'cards' && isCardRef(value) && value.$cards === id) {
            const binding = depth === 0 ? 'Selected Cards' : depth === 1 ? 'Parent Selected Cards' : undefined;
            if (!binding) throw new Unsupported('A card reference is nested too deeply');
            return captured ? { capture: binding } : binding;
        }
        if (kind === 'player' && isPlayerRef(value) && value.$player === id) {
            if (depth !== 0) throw new Unsupported('A player reference is hidden by a nested player choice');
            return captured ? { capture: 'Selected Player' } : 'Selected Player';
        }
        const node = value as Record<string, unknown>;
        const type = typeof node.type === 'string' ? node.type : undefined;
        const opens = !captured && type !== undefined && (kind === 'cards' ? cardScopes : playerScopes).has(type);
        const future = type !== undefined && futures.has(type);
        const result: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(node)) {
            const outer = type !== undefined && (outerFields[type] ?? []).includes(key);
            const nested = opens && !outer ? depth + 1 : depth;
            result[key] = walk(item, nested, captured || (future && key !== 'duration'));
        }
        return result;
    }
    const top = root as unknown as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(top)) {
        const outer = (outerFields[String(top.type)] ?? []).includes(key);
        // Outer fields of the scope's own instruction are evaluated before choosing.
        result[key] = outer ? item : walk(item, 0, false);
    }
    return result as unknown as Effect;
}

/** True if a selection is known to be exactly one card. */
export function isSingle(c: Parser, cards: CardSelection): boolean {
    if (cards === 'Self') return true;
    if (isCardRef(cards)) return (c.state.single ?? []).includes(cards.$cards);
    return typeof cards === 'object' && 'event' in cards && ['Card', 'Source', 'Attacker', 'Defender', 'Location', 'Song'].includes(cards.event);
}

/**
 * Collapse "each opponent loses 2 lore" from a per-player loop into one
 * instruction for the group, when the loop body only names the player.
 */
export function simplify<T>(value: T): T {
    function walk(item: unknown): unknown {
        if (Array.isArray(item)) return item.map(walk);
        if (item === null || typeof item !== 'object') return item;
        const node = Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, walk(entry)])) as Record<string, unknown>;
        // "Banish it. If it had a card under it, ...": test before the instruction, not before the event.
        const then = node.then as Record<string, unknown> | undefined;
        const test = then?.if as Record<string, unknown> | undefined;
        if (node.type === 'Do Then' && then?.type === 'Conditional' && test?.atEvent === 'Before' && 'if' in test) {
            const branch = (effect: unknown) => effect === undefined ? node.do : { type: 'Do Then', do: node.do, then: effect };
            return { type: 'Conditional', if: test.if, then: branch(then.then), otherwise: branch(then.otherwise) };
        }
        if (node.type !== 'For Each Player') return node;
        const body = node.effect as Record<string, unknown>;
        const group = ['Draw', 'Gain Lore', 'Lose Lore', 'Gain Ink Drops', 'Shuffle'];
        if (group.includes(String(body.type)) && body.player === 'Selected Player'
            && JSON.stringify({ ...body, player: null }).indexOf('Selected Player') < 0) {
            return { ...body, player: node.players };
        }
        return node;
    }
    return walk(value) as T;
}

/** Throw if any placeholder is left unresolved. */
export function assertResolved(value: unknown): void {
    if (Array.isArray(value)) return value.forEach(assertResolved);
    if (value === null || typeof value !== 'object') return;
    if (isCardRef(value)) throw new Unsupported('A card reference is used outside the choice that defines it');
    if (isPlayerRef(value)) throw new Unsupported('A player reference is used outside the choice that defines it');
    Object.values(value).forEach(assertResolved);
}

/** Replace placeholders that have a known fixed meaning, e.g. inside a granted ability. */
export function substitute<T>(value: T, replace: (ref: CardRef | PlayerRef) => unknown): T {
    function walk(item: unknown): unknown {
        if (Array.isArray(item)) return item.map(walk);
        if (item === null || typeof item !== 'object') return item;
        if (isCardRef(item) || isPlayerRef(item)) return replace(item);
        return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, walk(entry)]));
    }
    return walk(value) as T;
}
