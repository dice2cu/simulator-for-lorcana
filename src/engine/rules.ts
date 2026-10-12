import { getCard } from "../cards";
import { getModifiedStat } from "../model/game-state";
import type { Card } from "../model/card";
import type {
    Amount,
    CardFilter,
    CardSelection,
    Characteristic,
    Comparison,
    Condition,
    Keyword,
    PlayerSelection,
    Stat,
    NumericResult,
    CardResult,
    EventPattern,
    ContinuousRule,
    CardChange,
    PlayerChange,
    PlayerRestriction,
    CardRestriction,
    Ability,
    GrantedAbility,
    KeywordAbility,
    Cost,
} from "../model/ability";
import type { TurnEvent } from "../model/turn";
import type { CardModifier, CardState, EffectSource, GameState, PlayerPosition, PlayerModifier, UnderCard } from "../model/game-state";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import { sameCard } from "./identity";
import { freeze } from "./immutable";

export interface EngineOptions {
    /** Return stable immutable definitions for the lifetime of a game position. */
    card?: (fullName: string) => Card | undefined;
}

type Lookup = (fullName: string) => Card | undefined;
const catalogs = new WeakMap<Lookup, Lookup>();

/**
 * One memoized lookup per supplied catalog, so each definition is looked up once and
 * every query view and evaluator using that catalog shares its position indexes.
 */
export function catalogLookup(lookup: Lookup = getCard): Lookup {
    if (lookup === getCard) return getCard;
    let memoized = catalogs.get(lookup);
    if (!memoized) {
        const definitions = new Map<string, Card>();
        memoized = (name) => {
            const cached = definitions.get(name);
            if (cached) return cached;
            const definition = lookup(name);
            if (definition) definitions.set(name, definition);
            return definition;
        };
        catalogs.set(lookup, memoized);
        catalogs.set(memoized, memoized);
    }
    return memoized;
}

export interface RuleScope {
    source: EffectSource;
    selected: CardIdentifier[];
    parent: CardIdentifier[];
    selectedPlayer?: PlayerNumber;
    affected?: CardIdentifier;
    numbers?: Partial<Readonly<Record<NumericResult, number>>>;
    groups?: Partial<Readonly<Record<CardResult, CardIdentifier[]>>>;
    namedCard?: string;
    event?: TurnEvent;
    before?: GameState;
    /** For a scope another view evaluates, such as an event-time query. Otherwise the evaluating view's own are read. */
    history?: readonly RecordedEvent[];
    challenge?: { attacker: CardIdentifier; defender: CardIdentifier };
}

/** What a view reads beyond the position: the turn's history, the current challenge, the Ready step and ability uses. */
export interface TurnContext {
    history?: readonly RecordedEvent[];
    challenge?: { attacker: CardIdentifier; defender: CardIdentifier };
    usedAbilities?: readonly { card: CardIdentifier; ability: number; uses: number }[];
    /** During-turn rules begin after the Ready step, not while cards are being readied. */
    readying?: boolean;
}

/** Shared immutable snapshots let historical filters read the actual event-time facts. */
export interface RecordedEvent {
    event: TurnEvent;
    before: GameState;
    after: GameState;
    challenge?: { attacker: CardIdentifier; defender: CardIdentifier };
    readying?: boolean;
}

interface ContinuousEntry {
    rule: ContinuousRule;
    /** Shared by every view of the player's cards, so it never holds a view's turn context. */
    scope: RuleScope;
    modifier?: Extract<PlayerModifier, { rule: unknown }>;
    /** A limited printed ability, with its uses per turn. */
    printed?: { card: CardIdentifier; i: number };
    limit?: number;
    origin?: { card: CardIdentifier; i: number };
    conditions?: Condition[];
}

type TypedEntry<T extends ContinuousRule["type"]> = ContinuousEntry & { rule: Extract<ContinuousRule, { type: T }> };

export interface CardLocation {
    player: PlayerNumber;
    zone: "Play" | "Hand" | "Deck" | "Discard" | "Inkwell" | "Under";
    state?: CardState;
    under?: UnderCard;
}

interface CardEntry<V> {
    fullName: string;
    value: V;
    next?: CardEntry<V>;
}

/**
 * Values per physical card, looked up without building string keys. Instance numbers
 * rarely repeat across names, so entries are found by number and confirmed by name.
 */
export class CardTable<V> {
    private readonly entries = new Map<number, CardEntry<V>>();
    private find(card: CardIdentifier): CardEntry<V> | undefined {
        let entry = this.entries.get(card.i);
        while (entry && entry.fullName !== card.fullName) entry = entry.next;
        return entry;
    }
    get(card: CardIdentifier): V | undefined {
        return this.find(card)?.value;
    }
    has(card: CardIdentifier): boolean {
        return this.find(card) !== undefined;
    }
    set(card: CardIdentifier, value: V): void {
        const entry = this.find(card);
        if (entry) entry.value = value;
        else this.entries.set(card.i, { fullName: card.fullName, value, next: this.entries.get(card.i) });
    }
    delete(card: CardIdentifier): void {
        let entry = this.entries.get(card.i);
        if (entry?.fullName === card.fullName) {
            if (entry.next) this.entries.set(card.i, entry.next);
            else this.entries.delete(card.i);
            return;
        }
        while (entry?.next && entry.next.fullName !== card.fullName) entry = entry.next;
        if (entry?.next) entry.next = entry.next.next;
    }
}

interface PositionIndex {
    lookup: (name: string) => Card | undefined;
    seats: readonly PlayerNumber[];
    players: Partial<Record<PlayerNumber, PlayerIndex>>;
    printed?: readonly PrintedRule[];
    /** Cards in play, under them and in hand, which change often. Other zones are indexed with their arrays. */
    locations?: CardTable<CardLocation>;
    zones?: CardTable<CardLocation>[];
}

/**
 * What one player's cards contribute, derived once per frozen player position. Most
 * transitions change one player, and branches share the positions they start from,
 * so the other player's derivations carry over.
 */
interface PlayerIndex {
    player: PlayerNumber;
    lookup: (name: string) => Card | undefined;
    printed?: readonly PrintedRule[];
    /** Printed static abilities and created rules, before conditions, effects' suppression and usage limits. */
    statics?: readonly ContinuousEntry[];
    created?: readonly ContinuousEntry[];
}
const playerIndexes = new WeakMap<PlayerPosition, PlayerIndex>();

/**
 * The deck, discard and inkwell change least, and a frozen zone array is shared by
 * every later position that still holds it. What such a zone contributes is derived
 * once per array.
 */
interface ZoneIndex<T> {
    player: PlayerNumber;
    lookup?: (name: string) => Card | undefined;
    value: T;
}
const zoneRules = new Map<CardLocation["zone"], WeakMap<object, ZoneIndex<readonly PrintedRule[]>>>();
const zoneLocations = new Map<CardLocation["zone"], WeakMap<object, ZoneIndex<CardTable<CardLocation>>>>();

function shared<T>(
    indexes: WeakMap<object, ZoneIndex<T>>,
    zone: readonly unknown[],
    player: PlayerNumber,
    lookup: ZoneIndex<T>["lookup"],
    derive: () => T,
): T {
    const known = indexes.get(zone);
    if (known && known.player === player && known.lookup === lookup) return known.value;
    const value = derive();
    if (Object.isFrozen(zone)) indexes.set(zone, { player, lookup, value });
    return value;
}

/** Support and Vanish as the triggered abilities they stand for. */
const support: Extract<Ability, { type: "Triggered" }> = freeze({
    type: "Triggered",
    trigger: { event: "Quest", card: "Self" },
    effect: {
        type: "Optional",
        effect: {
            type: "Choose Cards",
            from: { zone: "Play", player: "You", cardType: "Character", exclude: "Self" },
            count: 1,
            effect: {
                type: "Modify Cards",
                cards: "Selected Cards",
                modifier: { stat: "Strength", amount: { stat: "Strength", card: "Self" } },
                duration: { until: "End Of Turn" },
            },
        },
    },
});
const vanish: Extract<Ability, { type: "Triggered" }> = freeze({
    type: "Triggered",
    trigger: { event: "Chosen", card: "Self", player: "Opponents", kind: "Action" },
    effect: { type: "Banish", cards: "Self" },
});

/** Where an ability works when its card does not say. */
export const PLAY_ONLY: readonly CardLocation["zone"][] = Object.freeze(["Play"]);

interface PrintedRule {
    card: CardIdentifier;
    player: PlayerNumber;
    zone: CardLocation["zone"];
    ability: Ability;
    slot: number;
}

// Only immutable engine snapshots are shared. Mutable setup positions get a private index.
const positionIndexes = new WeakMap<GameState, PositionIndex>();

export interface RegisteredRule {
    source: EffectSource;
    ability: Exclude<Ability, { type: "Deck Construction" }>;
    slot: number;
    grant?: CardModifier;
    shield?: CardModifier;
    listener?: Extract<PlayerModifier, { trigger: unknown }>;
    affected?: CardIdentifier;
    support?: true;
    vanish?: true;
}

/** Visits the leaf rules of a continuous rule with the conditions each one requires. */
function flatten(rule: ContinuousRule, visit: (rule: ContinuousRule, conditions: Condition[]) => void, conditions: Condition[] = []): void {
    if (rule.type === "Together") for (const nested of rule.rules) flatten(nested, visit, conditions);
    else if (rule.type === "Conditional") {
        flatten(rule.then, visit, [...conditions, rule.if]);
        if (rule.otherwise) flatten(rule.otherwise, visit, [...conditions, { not: rule.if }]);
    } else visit(rule, conditions);
}

function suppressed(ability: Ability, modifiers: readonly CardModifier[]): boolean {
    return modifiers.some(
        (modifier) =>
            ("loseAbility" in modifier && (modifier.loseAbility === "All" || ("name" in ability && ability.name === modifier.loseAbility.name))) ||
            (ability.type === "Keyword" && "loseKeyword" in modifier && modifier.loseKeyword === ability.keyword.name),
    );
}

/** Shared reads for effects, action legality and card characteristics. */
export class Rules {
    private readonly index: PositionIndex;
    private readonly lookup: Lookup;
    private readonly evaluating = new CardTable<true>();
    private readonly modifierCache = new CardTable<readonly CardModifier[]>();
    private readonly factCache = new CardTable<Map<string, CardModifier[]>>();
    private factSources?: Map<string, readonly TypedEntry<"Modify Cards">[]>;
    private continuousCache?: ContinuousEntry[];
    /** Rules that apply in this view by type, settled once outside any condition check. */
    private applying?: Map<ContinuousRule["type"], ContinuousEntry[]>;
    private readonly playerChangeCache = new Map<PlayerNumber, { change: PlayerChange; scope?: RuleScope }[]>();
    private settling = false;
    /**
     * Whether any answer so far used the turn's history, challenge, readying or ability
     * uses. Until one does, every answer depends on the position alone.
     */
    readsTurn = false;
    private readonly checkingConditions = new Set<ContinuousEntry>();
    private readonly suppressionCache = new Map<ContinuousEntry["origin"], boolean>();
    private readonly checkingSuppression = new Set<ContinuousEntry["origin"]>();
    constructor(
        readonly position: GameState,
        lookup?: Lookup,
        private readonly context: TurnContext = {},
    ) {
        this.lookup = catalogLookup(lookup);
        const frozen = Object.isFrozen(position);
        const cached = frozen ? positionIndexes.get(position) : undefined;
        if (cached?.lookup === this.lookup) this.index = cached;
        else {
            // Integer keys enumerate in ascending order.
            this.index = { lookup: this.lookup, seats: Object.freeze(Object.keys(position.players).map(Number) as PlayerNumber[]), players: {} };
            if (frozen && !cached) positionIndexes.set(position, this.index);
        }
    }

    private playerIndex(player: PlayerNumber): PlayerIndex {
        const cached = this.index.players[player];
        if (cached) return cached;
        const p = this.player(player);
        const known = playerIndexes.get(p);
        const index = known?.player === player && known.lookup === this.lookup ? known : { player, lookup: this.lookup };
        if (index !== known && Object.isFrozen(p)) playerIndexes.set(p, index);
        return (this.index.players[player] = index);
    }

    definition(card: CardIdentifier): Card {
        const value = this.lookup(card.fullName);
        if (!value) throw new Error(`Unknown card: ${card.fullName}`);
        return value;
    }

    players(): readonly PlayerNumber[] {
        return this.index.seats;
    }

    /**
     * Printed abilities that work from where each card is: rules, triggers, replacements,
     * Support and Vanish, and activated abilities. Discovery is shared, but suppression,
     * conditions and usage limits are not.
     */
    printedRules(): readonly PrintedRule[] {
        if (this.index.printed) return this.index.printed;
        const entries: PrintedRule[] = [];
        for (const player of this.players()) entries.push(...this.playerRules(player));
        return (this.index.printed = entries);
    }

    private playerRules(player: PlayerNumber): readonly PrintedRule[] {
        const index = this.playerIndex(player);
        if (index.printed) return index.printed;
        const p = this.player(player);
        const entries: PrintedRule[] = [];
        const kept = (zone: "Deck" | "Discard" | "Inkwell", source: readonly unknown[], cards: () => readonly CardIdentifier[]): void => {
            let indexes = zoneRules.get(zone);
            if (!indexes) zoneRules.set(zone, (indexes = new WeakMap()));
            for (const entry of shared(indexes, source, player, this.lookup, () => {
                const rules: PrintedRule[] = [];
                for (const card of cards()) this.zoneRules(card, player, zone, rules);
                return Object.freeze(rules);
            }))
                entries.push(entry);
        };
        kept("Deck", p.deck, () => p.deck);
        for (const card of p.hand) this.zoneRules(card, player, "Hand", entries);
        for (const state of p.play) this.zoneRules(state.card, player, "Play", entries);
        kept("Discard", p.discard, () => p.discard);
        kept("Inkwell", p.inkwell, () => p.inkwell.map((state) => state.card));
        for (const state of p.play) for (const under of state.under ?? []) this.zoneRules(under.card, player, "Under", entries);
        return (index.printed = entries);
    }

    /** Adds the card's printed abilities that work from this zone. */
    private zoneRules(card: CardIdentifier, player: PlayerNumber, zone: CardLocation["zone"], entries: PrintedRule[]): void {
        const abilities = this.definition(card).abilities;
        if (!abilities) return;
        for (let slot = 0; slot < abilities.length; slot++) {
            const ability = abilities[slot];
            const active =
                ability.type === "Static" || ability.type === "Triggered" || ability.type === "Replacement" || ability.type === "Activated"
                    ? (ability.from ?? PLAY_ONLY).includes(zone)
                    : ability.type === "Keyword" && zone === "Play" && (ability.keyword.name === "Support" || ability.keyword.name === "Vanish");
            if (active) entries.push({ card, player, zone, ability, slot });
        }
    }

    /** Ink the player can spend now: ready ink cards plus ink drops. */
    availableInk(player: PlayerNumber): number {
        const p = this.player(player);
        let ready = p.inkDrops ?? 0;
        for (const ink of p.inkwell) if (!ink.exerted) ready++;
        return ready;
    }

    player(number: PlayerNumber): PlayerPosition {
        const value = this.position.players[number];
        if (!value) throw new Error(`Unknown player: ${number}`);
        return value;
    }

    /** The index belongs to this position. A transition creates a new Rules instance. */
    locate(card: CardIdentifier): CardLocation | undefined {
        if (!this.index.locations) {
            const locations = new CardTable<CardLocation>();
            const add = (card: CardIdentifier, location: CardLocation): void => {
                if (!locations.has(card)) locations.set(card, Object.freeze(location));
            };
            for (const player of this.index.seats) {
                const p = this.player(player);
                for (const state of p.play) add(state.card, { player, zone: "Play", state });
                for (const state of p.play) for (const under of state.under ?? []) add(under.card, { player, zone: "Under", under });
                const hand = Object.freeze({ player, zone: "Hand" as const });
                for (const card of p.hand) add(card, hand);
            }
            this.index.locations = locations;
        }
        const found = this.index.locations.get(card);
        if (found) return found;
        this.index.zones ??= this.index.seats.flatMap((player) => {
            const p = this.player(player);
            return (
                [
                    ["Inkwell", p.inkwell, () => p.inkwell.map((ink) => ink.card)],
                    ["Discard", p.discard, () => p.discard],
                    ["Deck", p.deck, () => p.deck],
                ] as const
            ).map(([zone, source, cards]) => {
                let indexes = zoneLocations.get(zone);
                if (!indexes) zoneLocations.set(zone, (indexes = new WeakMap()));
                return shared(indexes, source, player, undefined, () => {
                    // Cards without per-card state share one location for their zone.
                    const table = new CardTable<CardLocation>();
                    const location = Object.freeze({ player, zone });
                    for (const card of cards()) if (!table.has(card)) table.set(card, location);
                    return table;
                });
            });
        });
        for (const zone of this.index.zones) {
            const location = zone.get(card);
            if (location) return location;
        }
        return undefined;
    }

    modifiers(card: CardIdentifier): readonly CardModifier[] {
        const cached = this.modifierCache.get(card);
        if (cached) return cached;
        if (this.evaluating.has(card)) throw new Error("Circular continuous characteristic query");
        this.evaluating.set(card, true);
        try {
            const modifiers = [...(this.locate(card)?.state?.modifiers?.filter((modifier) => !modifier.starts) ?? [])];
            for (const { rule, scope } of this.continuous("Modify Cards")) {
                if (!this.selects(rule.cards, scope, card)) continue;
                const modifier = this.resolveChange(rule.modifier, { ...scope, affected: card });
                if (modifier) modifiers.push(modifier);
            }
            // The list grows as gained abilities add to it, and they are read in turn.
            this.gainedChanges(card, modifiers, modifiers, () => true, (modifier) => modifiers.push(modifier));
            this.modifierCache.set(card, modifiers);
            return modifiers;
        } finally {
            this.evaluating.delete(card);
        }
    }

    /**
     * Changes made by static abilities the card has gained, such as "this character gets +1 strength".
     * A gained static rule may only change cards: anything else needs global continuous evaluation.
     */
    private gainedChanges(
        card: CardIdentifier,
        grants: readonly CardModifier[],
        suppression: readonly CardModifier[],
        include: (change: CardChange) => boolean,
        add: (modifier: CardModifier) => void,
    ): void {
        const player = this.locate(card)?.player;
        if (player === undefined) return;
        for (const grant of grants) {
            if (!("gainAbility" in grant) || grant.gainAbility.type !== "Static" || suppressed(grant.gainAbility, suppression)) continue;
            if (grant.gainAbility.limit) throw new Error("Limited granted static rules need occurrence accounting");
            const scope: RuleScope = { source: { card, player, kind: "Ability" }, selected: [], parent: [] };
            const visit = (rule: ContinuousRule): void => {
                if (rule.type === "Together") rule.rules.forEach(visit);
                else if (rule.type === "Conditional") {
                    const branch = this.condition(rule.if, scope) ? rule.then : rule.otherwise;
                    if (branch) visit(branch);
                } else if (rule.type !== "Modify Cards") throw new Error("This granted static rule needs global continuous evaluation");
                else if (include(rule.modifier) && this.selects(rule.cards, scope, card)) {
                    const modifier = this.resolveChange(rule.modifier, { ...scope, affected: card });
                    if (modifier) add(modifier);
                }
            };
            visit(grant.gainAbility.rule);
        }
    }

    resolveChange(change: CardChange, scope: RuleScope): CardModifier | undefined {
        if ("when" in change && change.when && !this.condition(change.when, scope)) return undefined;
        if ("stat" in change) return { stat: change.stat, amount: this.amount(change.amount, scope) };
        if ("minimumStat" in change) return { minimumStat: change.minimumStat, amount: this.amount(change.amount, scope) };
        if ("gainKeyword" in change && change.amount !== undefined) return { ...change, amount: this.amount(change.amount, scope) };
        return change as CardModifier;
    }

    /** Only ability and keyword removal can suppress an ability, so unrelated modifiers are not evaluated. */
    abilityActive(card: CardIdentifier, ability: Ability): boolean {
        return !suppressed(ability, this.factModifiers(card, "suppression"));
    }

    names(card: CardIdentifier, shift = false): string[] {
        return [
            ...new Set([
                ...this.definition(card).names,
                ...this.factModifiers(card, "countsAsName").flatMap((modifier) =>
                    "countsAsName" in modifier && (!modifier.for || shift) ? [modifier.countsAsName] : [],
                ),
            ]),
        ];
    }

    /** A name or classification read must not evaluate unrelated stat bonuses. */
    private factModifiers(
        card: CardIdentifier,
        property: "countsAsName" | "gainClassification" | "inkable" | "keyword" | "stat" | "ability" | "restriction" | "suppression",
        value?: Keyword | Stat,
    ): CardModifier[] {
        // Keyword and stat names never coincide with property names.
        const key = value ?? property;
        const cached = this.checkingConditions.size === 0 ? this.factCache.get(card)?.get(key) : undefined;
        if (cached) return cached;
        const relevant = (modifier: CardChange | CardModifier): boolean =>
            property === "keyword"
                ? ("gainKeyword" in modifier && modifier.gainKeyword === value) ||
                  ("loseKeyword" in modifier && modifier.loseKeyword === value) ||
                  "loseAbility" in modifier
                : property === "ability"
                  ? "gainAbility" in modifier && modifier.gainAbility.type === "Static"
                  : property === "suppression"
                    ? "loseAbility" in modifier || "loseKeyword" in modifier
                    : property === "stat"
                    ? ("stat" in modifier && modifier.stat === value) || ("minimumStat" in modifier && modifier.minimumStat === value)
                    : property in modifier;
        const place = this.locate(card);
        const modifiers = place?.state?.modifiers?.filter((modifier) => !modifier.starts && relevant(modifier)) ?? [];
        // The rules that could change this fact are the same for every card in a settled view.
        const settled = this.checkingConditions.size === 0 && !this.settling;
        let sources = settled ? this.factSources?.get(key) : undefined;
        if (!sources) {
            sources = this.continuous("Modify Cards", (entry) => relevant(entry.rule.modifier));
            if (settled) (this.factSources ??= new Map()).set(key, sources);
        }
        for (const { rule, scope } of sources)
            if (this.selects(rule.cards, scope, card)) {
                const modifier = this.resolveChange(rule.modifier, { ...scope, affected: card });
                if (modifier && !("gainKeyword" in modifier && !this.canGainKeyword(card, modifier.gainKeyword))) modifiers.push(modifier);
            }
        const abilities = property === "ability" ? [] : this.factModifiers(card, "ability");
        if (abilities.length)
            this.gainedChanges(card, abilities, property === "suppression" ? modifiers : this.factModifiers(card, "suppression"), relevant, (modifier) => {
                if (!("gainKeyword" in modifier && !this.canGainKeyword(card, modifier.gainKeyword))) modifiers.push(modifier);
            });
        if (this.checkingConditions.size === 0) {
            let facts = this.factCache.get(card);
            if (!facts) this.factCache.set(card, (facts = new Map()));
            facts.set(key, modifiers);
        }
        return modifiers;
    }

    shiftGroups(card: CardIdentifier, shift: Extract<KeywordAbility, { name: "Shift" }>, scope: RuleScope): CardIdentifier[][] {
        const permitted: CardIdentifier[] = [];
        let bases = shift.onto
            ? this.cards(shift.onto, scope)
            : this.player(scope.source.player)
                  .play.filter(
                      (state) =>
                          this.definition(state.card).type === "Character" &&
                          this.names(state.card, true).some((name) => (shift.names ?? this.names(card, true)).includes(name)),
                  )
                  .map((state) => state.card);
        for (const entry of this.continuous("Can Shift Onto"))
            if (this.selects(entry.rule.cards, entry.scope, card)) {
                permitted.push(...this.cards(entry.rule.onto, entry.scope));
            }
        // As-if-name permissions do not waive a variant's classification requirement.
        bases.push(...permitted.filter((base) => !shift.onto || bases.some((other) => sameCard(base, other))));
        bases = this.unique(bases).filter((base) => this.locate(base)?.player === scope.source.player && this.locate(base)?.zone === "Play");
        const count = shift.count ?? 1;
        const groups = count === 2 ? [] : bases.map((base) => [base]);
        if (count === 2 || count === "One Or Two")
            for (const first of bases)
                for (const second of bases) {
                    if (sameCard(first, second)) continue;
                    const names = shift.names ?? this.names(card, true);
                    const hasName = (base: CardIdentifier, name: string): boolean =>
                        this.names(base, true).includes(name) || permitted.some((other) => sameCard(base, other));
                    if (
                        names.length === 2 &&
                        !((hasName(first, names[0]) && hasName(second, names[1])) || (hasName(first, names[1]) && hasName(second, names[0])))
                    )
                        continue;
                    groups.push([first, second]);
                }
        return groups.filter((onto) => !shift.when || this.condition(shift.when, { ...scope, selected: onto }));
    }

    grants(card: CardIdentifier): { ability: GrantedAbility; modifier: CardModifier }[] {
        return this.modifiers(card).flatMap((modifier) =>
            "gainAbility" in modifier && this.abilityActive(card, modifier.gainAbility) ? [{ ability: modifier.gainAbility, modifier }] : [],
        );
    }

    /** Deterministic discovery. A live evaluator retains slots when rules retire. */
    registeredRules(): RegisteredRule[] {
        const entries: RegisteredRule[] = [];
        let continuousGrants = false,
            continuousSupport = false,
            continuousVanish = false;
        for (const { rule } of this.continuous("Modify Cards")) {
            if ("gainAbility" in rule.modifier) continuousGrants = true;
            if ("gainKeyword" in rule.modifier && rule.modifier.gainKeyword === "Support") continuousSupport = true;
            if ("gainKeyword" in rule.modifier && rule.modifier.gainKeyword === "Vanish") continuousVanish = true;
        }
        for (const { card, player, ability: printed, slot, zone } of this.printedRules()) {
            // Under-card triggers were not part of registry discovery.
            if (zone === "Under" || printed.type === "Static" || printed.type === "Activated") continue;
            if (!this.abilityActive(card, printed)) continue;
            const ability = printed.type === "Keyword" ? (printed.keyword.name === "Support" ? support : vanish) : printed;
            if (ability.type !== "Triggered" && ability.type !== "Replacement") continue;
            entries.push({
                source: { card, player, kind: "Ability" },
                ability,
                slot,
                ...(printed.type === "Keyword" && printed.keyword.name === "Support" ? { support: true as const } : {}),
                ...(printed.type === "Keyword" && printed.keyword.name === "Vanish" ? { vanish: true as const } : {}),
            });
        }
        for (const player of this.players()) {
            const p = this.player(player);
            for (const state of p.play) {
                for (const modifier of state.modifiers ?? [])
                    if (!modifier.starts && "trigger" in modifier && modifier.uses !== 0)
                        entries.push({
                            source: modifier.source,
                            slot: -1,
                            listener: modifier,
                            affected: state.card,
                            ability: {
                                type: "Triggered",
                                trigger: modifier.trigger,
                                effect: modifier.effect,
                            },
                        });
                if (
                    (continuousSupport || state.modifiers?.some((modifier) => "gainKeyword" in modifier && modifier.gainKeyword === "Support")) &&
                    this.keyword(state.card, "Support") &&
                    !this.definition(state.card).abilities?.some(
                        (ability) => ability.type === "Keyword" && ability.keyword.name === "Support" && this.abilityActive(state.card, ability),
                    )
                ) {
                    const modifier = this.modifiers(state.card).find((modifier) => "gainKeyword" in modifier && modifier.gainKeyword === "Support");
                    if (modifier)
                        entries.push({
                            source: { card: state.card, player, kind: "Ability" },
                            slot: -1,
                            grant: modifier,
                            ability: support,
                            support: true,
                        });
                }
                if (
                    (continuousVanish || state.modifiers?.some((modifier) => "gainKeyword" in modifier && modifier.gainKeyword === "Vanish")) &&
                    this.keyword(state.card, "Vanish") &&
                    !this.definition(state.card).abilities?.some(
                        (ability) => ability.type === "Keyword" && ability.keyword.name === "Vanish" && this.abilityActive(state.card, ability),
                    )
                ) {
                    const modifier = this.modifiers(state.card).find((modifier) => "gainKeyword" in modifier && modifier.gainKeyword === "Vanish");
                    if (modifier)
                        entries.push({
                            source: { card: state.card, player, kind: "Ability" },
                            slot: -1,
                            grant: modifier,
                            ability: vanish,
                            vanish: true,
                        });
                }
                for (const modifier of state.modifiers ?? [])
                    if (!modifier.starts && "preventDamage" in modifier)
                        entries.push({
                            source: { card: state.card, player, kind: "Ability" },
                            slot: -1,
                            shield: modifier,
                            ability: {
                                type: "Replacement",
                                replacement: { event: { event: "Deal Damage", card: "Self" } },
                            },
                        });
            }
            // Without a continuous grant, only cards in play with their own granting modifier can have granted abilities.
            const granting = continuousGrants
                ? ([
                      ["Hand", p.hand],
                      ["Play", p.play.map((state) => state.card)],
                      ["Discard", p.discard],
                  ] as const)
                : ([
                      [
                          "Play",
                          p.play
                              .filter((state) => state.modifiers?.some((modifier) => !modifier.starts && "gainAbility" in modifier))
                              .map((state) => state.card),
                      ],
                  ] as const);
            for (const [zone, cards] of granting)
                for (const card of cards) {
                    for (const { ability, modifier } of this.grants(card)) {
                        if (ability.type === "Keyword" ? ability.keyword.name !== "Shift" && zone !== "Play" : !(ability.from ?? PLAY_ONLY).includes(zone))
                            continue;
                        entries.push({
                            source: { card, player, kind: "Ability" },
                            ability,
                            slot: -1,
                            grant: modifier,
                        });
                    }
                }
            for (const modifier of p.modifiers ?? [])
                if (!modifier.starts && "trigger" in modifier && modifier.uses !== 0)
                    entries.push({
                        source: modifier.source,
                        slot: -1,
                        listener: modifier,
                        ability: {
                            type: "Triggered",
                            trigger: modifier.trigger,
                            effect: modifier.effect,
                        },
                    });
        }
        return entries;
    }

    playerChanges(player: PlayerNumber): PlayerChange[] {
        return this.playerChangeEntries(player).map((entry) => entry.change);
    }

    victoryLore(player: PlayerNumber): number {
        const thresholds = this.playerChanges(player).filter((change) => "victoryLore" in change);
        const last = thresholds[thresholds.length - 1];
        return last && "victoryLore" in last ? last.victoryLore : 20;
    }

    playerRestricted(player: PlayerNumber, restriction: PlayerRestriction): boolean {
        return this.playerChanges(player).some((change) => "restriction" in change && change.restriction === restriction);
    }

    /** Cards currently made public by continuous rules, independently of one-shot reveals. */
    revealedCards(): CardIdentifier[] {
        const cards: CardIdentifier[] = [];
        for (const { rule, scope } of this.continuous("Reveal Cards")) {
            for (const card of this.cards(rule.cards, scope)) if (!cards.some((other) => sameCard(other, card))) cards.push(card);
        }
        return cards;
    }

    permittedZone(card: CardIdentifier, player: PlayerNumber, action: "Ink" | "Play"): boolean {
        const located = this.locate(card);
        if (!located || located.player !== player) return false;
        if (located.zone === "Hand") return true;
        const permission = action === "Ink" ? "Can Ink From Discard" : located.zone === "Under" ? "Can Play From Under" : "Can Play From Discard";
        if (located.zone !== "Discard" && !(action === "Play" && located.zone === "Under")) return false;
        return this.playerChangeEntries(player).some(
            ({ change, scope }) =>
                "permission" in change &&
                change.permission === permission &&
                (!change.cards ||
                    this.cards(
                        change.cards,
                        scope ?? {
                            source: { card, player, kind: "Ability" },
                            selected: [],
                            parent: [],
                        },
                    ).some((other) => sameCard(other, card))),
        );
    }

    permissionExerts(card: CardIdentifier, player: PlayerNumber, action: "Ink" | "Play"): boolean {
        const located = this.locate(card);
        if (!located || located.zone === "Hand") return false;
        const permission = action === "Ink" ? "Can Ink From Discard" : located.zone === "Under" ? "Can Play From Under" : "Can Play From Discard";
        return this.playerChangeEntries(player).some(
            ({ change, scope }) =>
                "permission" in change &&
                change.permission === permission &&
                change.exerted &&
                (!change.cards ||
                    this.cards(
                        change.cards,
                        scope ?? {
                            source: { card, player, kind: "Ability" },
                            selected: [],
                            parent: [],
                        },
                    ).some((other) => sameCard(other, card))),
        );
    }

    private playerChangeEntries(player: PlayerNumber): { change: PlayerChange; scope?: RuleScope }[] {
        const settled = this.checkingConditions.size === 0 && !this.settling;
        const cached = settled ? this.playerChangeCache.get(player) : undefined;
        if (cached) return cached;
        const changes: { change: PlayerChange; scope?: RuleScope }[] = [];
        for (const modifier of this.player(player).modifiers ?? []) {
            if (modifier.starts) continue;
            if ("rule" in modifier || "trigger" in modifier) continue;
            changes.push({ change: modifier });
        }
        for (const { rule, scope } of this.continuous("Modify Players"))
            if (this.selectPlayers(rule.players, scope).includes(player)) changes.push({ change: rule.modifier, scope });
        if (settled) this.playerChangeCache.set(player, changes);
        return changes;
    }

    /** A shared limit counts distinct challengers, not the number of challenges. */
    belowChallengeLimit(card: CardIdentifier, player: PlayerNumber): boolean {
        for (const { change, scope } of this.playerChangeEntries(player)) {
            if (!("challengeLimit" in change)) continue;
            const players = this.selectPlayers(change.players, scope ?? { source: { card, player, kind: "Ability" }, selected: [], parent: [] });
            const challengers = this.history({}).flatMap(({ event }) =>
                event.event === "Challenge" && players.includes(event.player) ? [event.attacker] : [],
            );
            if (challengers.some((other) => sameCard(other, card))) continue;
            const unique = challengers.filter((other, i) => challengers.findIndex((candidate) => sameCard(candidate, other)) === i);
            if (unique.length >= change.challengeLimit) return false;
        }
        return true;
    }

    /** The ink price to play a card. Optional discounts count only when asked for. */
    cost(card: CardIdentifier, optional = false): number {
        let cost = this.definition(card).cost;
        for (const { rule, scope } of this.costChanges(card, "Play", optional))
            cost += rule.optional ? Math.min(0, this.amount(rule.amount, scope)) : this.amount(rule.amount, scope);
        return Math.max(0, cost);
    }

    costChanges(
        card: CardIdentifier,
        kind: "Play" | "Move" | "Shift" = "Play",
        optional = false,
        onto: readonly CardIdentifier[] = [],
    ): (ContinuousEntry & { rule: Extract<ContinuousRule, { type: "Modify Cost" }> })[] {
        return this.continuous("Modify Cost").filter(
            (entry) =>
                entry.rule.for === kind &&
            (optional || !entry.rule.optional) &&
            (entry.rule.for !== "Shift" ||
                !entry.rule.onto ||
                    this.cards(entry.rule.onto, entry.scope).some((base) => onto.some((card) => sameCard(card, base)))) &&
                this.selects(entry.rule.cards, entry.scope, card),
        );
    }

    shiftCosts(card: CardIdentifier, costs: readonly Cost[], scope: RuleScope, onto: readonly CardIdentifier[], optional = true): Cost[] {
        const entries = [...this.costChanges(card, "Play", optional), ...this.costChanges(card, "Shift", optional, onto)];
        return this.adjustedCosts(costs, scope, entries);
    }

    playCosts(card: CardIdentifier, costs: readonly Cost[], scope: RuleScope): Cost[] {
        return this.adjustedCosts(costs, scope, this.costChanges(card, "Play", true));
    }

    movementCosts(card: CardIdentifier, location: CardIdentifier, costs: readonly Cost[], scope: RuleScope): Cost[] {
        return this.adjustedCosts(costs, scope, this.movementChanges(card, location, true));
    }

    private adjustedCosts(costs: readonly Cost[], scope: RuleScope, entries: ReturnType<Rules["costChanges"]>): Cost[] {
        const ink = costs.reduce((sum, cost) => sum + (cost.type === "Ink" ? this.amount(cost.amount, scope) : 0), 0);
        const price = Math.max(
            0,
            ink +
                entries.reduce((sum, entry) => {
                    const change = this.amount(entry.rule.amount, entry.scope);
                    return sum + (entry.rule.optional ? Math.min(0, change) : change);
                }, 0),
        );
        return [...costs.filter((cost) => cost.type !== "Ink"), ...(price ? [{ type: "Ink" as const, amount: price }] : [])];
    }

    entryRules(card: CardIdentifier): (ContinuousEntry & { rule: Extract<ContinuousRule, { type: "Enter Play" }> })[] {
        return this.continuous("Enter Play").filter((entry) => this.selects(entry.rule.cards, entry.scope, card));
    }

    moveCost(card: CardIdentifier, location: CardIdentifier, optional = false): number {
        const definition = this.definition(location);
        if (definition.type !== "Location") throw new Error("Movement destination is not a location");
        let amount = definition.moveCost;
        for (const { rule, scope } of this.movementChanges(card, location, optional)) {
            if (rule.for !== "Move" || (rule.location && !this.cards(rule.location, scope).some((other) => sameCard(other, location)))) continue;
            amount += rule.optional ? Math.min(0, this.amount(rule.amount, scope)) : this.amount(rule.amount, scope);
        }
        return Math.max(0, amount);
    }

    movementChanges(card: CardIdentifier, location: CardIdentifier, optional = false): ReturnType<Rules["costChanges"]> {
        return this.costChanges(card, "Move", optional).filter(
            ({ rule, scope }) => rule.for === "Move" && (!rule.location || this.cards(rule.location, scope).some((other) => sameCard(other, location))),
        );
    }

    challengeDamage(card: CardIdentifier): number {
        let stat: Stat = "Strength";
        for (const { rule, scope } of this.continuous("Challenge Damage")) if (this.selects(rule.cards, scope, card)) stat = rule.stat;
        return this.characteristic(card, stat);
    }

    freeAbility(card: CardIdentifier, ability: Extract<Ability, { type: "Activated" }> | "Boost"): boolean {
        return this.freeAbilityEntries(card, ability).length > 0;
    }

    freeAbilityEntries(card: CardIdentifier, ability: Extract<Ability, { type: "Activated" }> | "Boost"): ContinuousEntry[] {
        return this.continuous("Free Ability").filter(
            ({ rule, scope }) =>
                this.selects(rule.cards, scope, card) &&
                (!rule.keyword || ability === rule.keyword) &&
                (!rule.name || (ability !== "Boost" && ability.name === rule.name)),
        );
    }

    abilityCosts(costs: readonly Cost[], free: boolean): Cost[] {
        if (!free) return [...costs];
        return costs.flatMap<Cost>((cost) =>
            cost.type === "Exert"
                ? [cost]
                : cost.type === "Choose Cards"
                  ? this.abilityCosts(cost.cost, true).length
                      ? [{ ...cost, cost: this.abilityCosts(cost.cost, true) }]
                      : []
                  : [],
        );
    }

    additionalCosts(card: CardIdentifier, action: "Quest" | "Challenge"): Cost[] {
        return this.continuous("Additional Cost").flatMap(({ rule, scope }) => {
            if (!rule.for.includes(action) || !this.selects(rule.cards, scope, card))
                return [];
            return this.bindCosts(rule.cost, { ...scope, affected: card });
        });
    }

    /** Outer operands are concrete, while nested cost choices retain their local operands. */
    bindCosts(costs: readonly Cost[], scope: RuleScope, depth = 0): Cost[] {
        const bind = (selection: CardSelection): CardSelection => {
            const dynamic = (value: unknown): boolean =>
                value === "Selected Cards" ||
                value === "Parent Selected Cards" ||
                (Array.isArray(value) && value.some(dynamic)) ||
                (value !== null && typeof value === "object" && Object.values(value).some(dynamic));
            if (!depth || !dynamic(selection)) return { cards: this.cards(selection, scope) };
            const walk = (value: unknown): unknown => {
                if (value === "Self") return { cards: [scope.source.card] };
                if (value === "Affected Card") return { cards: scope.affected ? [scope.affected] : [] };
                if (value === "Parent Selected Cards" && depth === 1) return { cards: scope.selected };
                if (Array.isArray(value)) return value.map(walk);
                if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
                return value;
            };
            return walk(selection) as CardSelection;
        };
        return costs.map((cost): Cost => {
            if (cost.type === "Choose Cards")
                return {
                    ...cost,
                    from: bind(cost.from),
                    cost: this.bindCosts(cost.cost, scope, depth + 1),
                };
            if (cost.type === "Ink" || cost.type === "Lose Lore")
                return {
                    ...cost,
                    amount: typeof cost.amount === "number" ? cost.amount : { count: bind(cost.amount.count) },
                };
            if (cost.type === "Deal Damage")
                return {
                    ...cost,
                    cards: bind(cost.cards),
                    amount: typeof cost.amount === "number" ? cost.amount : { count: bind(cost.amount.count) },
                };
            if (cost.type === "Move Card" && cost.to === "Under") return { ...cost, cards: bind(cost.cards), under: bind(cost.under) };
            return { ...cost, cards: bind(cost.cards) };
        });
    }

    alternateCosts(
        card: CardIdentifier,
        kind: "Play" | "Move" | "Shift",
        other?: CardIdentifier,
    ): (ContinuousEntry & { rule: Extract<ContinuousRule, { type: "Alternate Cost" }> })[] {
        return this.continuous("Alternate Cost").filter((entry) => {
            const rule = entry.rule;
            if (rule.for !== kind || !this.selects(rule.cards, entry.scope, card)) return false;
            const selection = rule.for === "Move" ? rule.location : rule.for === "Shift" ? rule.onto : undefined;
            if (selection && (!other || !this.cards(selection, entry.scope).some((candidate) => sameCard(candidate, other)))) return false;
            if (!entry.origin) throw new Error("Created alternate costs need a runtime rule reference");
            return true;
        });
    }

    /**
     * The continuous rules of one type that apply in this view. Inside a condition check,
     * the rule being checked must not see itself, so nothing is settled there.
     */
    private continuous<T extends ContinuousRule["type"]>(
        type: T,
        include?: (entry: TypedEntry<T>) => boolean,
    ): readonly TypedEntry<T>[] {
        const entries = (this.continuousCache ??= this.collectContinuous());
        if (this.checkingConditions.size || this.settling)
            return entries.filter(
                (entry): entry is TypedEntry<T> => entry.rule.type === type && (!include || include(entry as TypedEntry<T>)) && this.applies(entry),
            );
        if (!this.applying) {
            this.settling = true;
            try {
                const applying = new Map<ContinuousRule["type"], ContinuousEntry[]>();
                for (const entry of entries)
                    if (this.applies(entry)) {
                        const list = applying.get(entry.rule.type);
                        if (list) list.push(entry);
                        else applying.set(entry.rule.type, [entry]);
                    }
                this.applying = applying;
            } finally {
                this.settling = false;
            }
        }
        const settled = (this.applying.get(type) ?? []) as TypedEntry<T>[];
        return include ? settled.filter(include) : settled;
    }

    /** Every player's printed static abilities, then every player's created rules, in registration order. */
    private collectContinuous(): ContinuousEntry[] {
        const entries: ContinuousEntry[] = [];
        for (const player of this.players()) {
            const index = this.playerIndex(player);
            entries.push(...(index.statics ??= this.playerStatics(player)));
        }
        for (const player of this.players()) {
            const index = this.playerIndex(player);
            entries.push(...(index.created ??= this.playerCreated(player)));
        }
        return entries;
    }

    private playerStatics(player: PlayerNumber): ContinuousEntry[] {
        const entries: ContinuousEntry[] = [];
        for (const { card, ability, slot: i } of this.playerRules(player)) {
            if (ability.type !== "Static") continue;
            if (suppressed(ability, this.locate(card)?.state?.modifiers?.filter((modifier) => !modifier.starts) ?? [])) continue;
            const origin = { card, i };
            const scope: RuleScope = { source: { card, player, kind: "Ability" }, selected: [], parent: [] };
            const limit = ability.limit ? { printed: origin, limit: ability.limit.perTurn } : {};
            flatten(ability.rule, (rule, conditions) => entries.push({ rule, scope, origin, conditions, ...limit }));
        }
        return entries;
    }

    private playerCreated(player: PlayerNumber): ContinuousEntry[] {
        const entries: ContinuousEntry[] = [];
        const p = this.player(player);
        const add = (modifier: CardModifier | PlayerModifier, affected?: CardIdentifier): void => {
            if (modifier.starts || !("rule" in modifier) || modifier.uses === 0) return;
            const scope: RuleScope = { source: modifier.source, selected: [], parent: [], ...(affected ? { affected } : {}) };
            flatten(modifier.rule, (rule, conditions) => entries.push({ rule, scope, modifier, conditions }));
        };
        for (const modifier of p.modifiers ?? []) add(modifier);
        for (const state of p.play) for (const modifier of state.modifiers ?? []) add(modifier, state.card);
        return entries;
    }

    private applies(entry: ContinuousEntry): boolean {
        if (entry.printed && entry.limit !== undefined && this.uses(entry.printed.card, entry.printed.i) >= entry.limit) return false;
        if (this.continuousSuppressed(entry)) return false;
        if (!entry.conditions?.length) return true;
        if (this.checkingConditions.has(entry)) return false;
        this.checkingConditions.add(entry);
        try {
            return entry.conditions.every((condition) => this.condition(condition, entry.scope));
        } finally {
            this.checkingConditions.delete(entry);
        }
    }

    private continuousSuppressed(entry: ContinuousEntry): boolean {
        if (!entry.origin) return false;
        const { card, i } = entry.origin;
        const ability = this.definition(card).abilities?.[i];
        if (!ability) return false;
        // Each printed ability has one origin object per query view.
        const key = entry.origin;
        const cached = this.suppressionCache.get(key);
        if (cached !== undefined) return cached;
        if (this.checkingSuppression.has(key)) return false;
        this.checkingSuppression.add(key);
        try {
            const changes = [...(this.locate(card)?.state?.modifiers?.filter((modifier) => !modifier.starts) ?? [])];
            for (const candidate of this.continuousCache ?? []) {
                if (candidate.rule.type !== "Modify Cards" || !("loseAbility" in candidate.rule.modifier)) continue;
                if (!suppressed(ability, [candidate.rule.modifier])) continue;
                if (candidate.conditions?.some((condition) => !this.condition(condition, candidate.scope))) continue;
                if (this.selects(candidate.rule.cards, candidate.scope, card)) changes.push(candidate.rule.modifier);
            }
            const result = suppressed(ability, changes);
            this.suppressionCache.set(key, result);
            return result;
        } finally {
            this.checkingSuppression.delete(key);
        }
    }

    canGainKeyword(card: CardIdentifier, keyword: Exclude<Keyword, "Sing Together">): boolean {
        const player = this.locate(card)?.player;
        if (player === undefined) return false;
        const scope: RuleScope = { source: { card, player, kind: "Ability" }, selected: [], parent: [], affected: card };
        return !this.factModifiers(card, "restriction").some(
            (modifier) =>
                "restriction" in modifier &&
                modifier.restriction === "Can't Gain Keyword" &&
                (!modifier.keyword || modifier.keyword === keyword) &&
                (!modifier.when || this.condition(modifier.when, scope)),
        );
    }

    keyword(card: CardIdentifier, keyword: Keyword): number {
        const modifiers = this.factModifiers(card, "keyword", keyword);
        if (modifiers.some((m) => ("loseAbility" in m && m.loseAbility === "All") || ("loseKeyword" in m && m.loseKeyword === keyword))) return 0;
        // Singer takes the first value. Resist and Challenger add up. Others are present or not.
        let first: number | undefined,
            total = 0;
        const add = (amount: number): void => {
            first ??= amount;
            total += amount;
        };
        for (const ability of this.definition(card).abilities ?? [])
            if (ability.type === "Keyword" && ability.keyword.name === keyword) add("amount" in ability.keyword ? ability.keyword.amount : 1);
        for (const modifier of modifiers) if ("gainKeyword" in modifier && modifier.gainKeyword === keyword) add(modifier.amount ?? 1);
        if (keyword === "Singer") return first ?? 0;
        return keyword === "Resist" || keyword === "Challenger" ? total : Math.min(1, total);
    }

    characteristic(card: CardIdentifier, stat: Characteristic, printed = false): number {
        const definition = this.definition(card);
        const state = this.locate(card)?.state;
        if (stat === "Cost") return definition.cost;
        if (stat === "Damage") return state?.damage ?? 0;
        if (stat === "Cards Under") return state?.under?.length ?? 0;
        let base = 0;
        if (stat === "Cost To Sing") base = Math.max(definition.cost, printed ? 0 : this.keyword(card, "Singer"));
        if (stat === "Strength" && definition.type === "Character") base = definition.strength;
        if (stat === "Willpower" && (definition.type === "Character" || definition.type === "Location")) base = definition.willpower;
        if (stat === "Lore" && (definition.type === "Character" || definition.type === "Location")) base = definition.lore;
        if (!printed && stat === "Strength" && sameCard(this.challenge({})?.attacker, card))
            base += this.keyword(card, "Challenger");
        return printed ? base : getModifiedStat(base, stat as Stat, this.factModifiers(card, "stat", stat as Stat));
    }

    selectPlayers(selection: PlayerSelection, scope: RuleScope): PlayerNumber[] {
        if (selection === "You") return this.position.players[scope.source.player] ? [scope.source.player] : [];
        if (selection === "All") return [...this.index.seats];
        if (selection === "Opponents") return this.players().filter((player) => player !== scope.source.player);
        if (selection === "Selected Player")
            return scope.selectedPlayer === undefined || !this.position.players[scope.selectedPlayer] ? [] : [scope.selectedPlayer];
        // Ordinary Lorcana has no teammates. Team formats need their own configuration.
        if (selection === "Teammates") return [];
        if (typeof selection !== "object") throw new Error(`Unsupported player selection: ${selection}`);
        if ("players" in selection) return selection.players.filter((player) => this.position.players[player]);
        if ("capture" in selection) return this.selectPlayers(selection.capture, scope);
        if ("together" in selection) return this.selectPlayers(selection.together, scope);
        if ("ownerOf" in selection)
            return [
                ...new Set(
                    this.cards(selection.ownerOf, scope).map((card) => {
                        const located = this.locate(card);
                        if (!located) throw new Error("Owner requested for a card outside a zone");
                        return located.state?.owner ?? located.under?.owner ?? located.player;
                    }),
                ),
            ];
        if ("from" in selection) {
            let players = this.selectPlayers(selection.from, scope).filter(
                (player) => !selection.where || this.condition(selection.where, { ...scope, selectedPlayer: player }),
            );
            if (selection.rank && players.length) {
                const by = selection.rank.by;
                const values = players.map((player) => this.amount(by, { ...scope, selectedPlayer: player }));
                const highest = Math.max(...values);
                players = players.filter((_, i) => values[i] === highest);
            }
            return players;
        }
        if ("event" in selection) return scope.event ? (typeof scope.event.player === "number" ? [scope.event.player] : [...scope.event.player.together]) : [];
        throw new Error("Unsupported player selection");
    }

    cards(selection: CardSelection, scope: RuleScope): CardIdentifier[] {
        if (selection === "Self") return [scope.source.card];
        if (selection === "Selected Cards") return scope.selected;
        if (selection === "Parent Selected Cards") return scope.parent;
        if (selection === "Affected Card") return scope.affected ? [scope.affected] : [];
        if (typeof selection !== "object") throw new Error(`Unsupported card selection: ${selection}`);
        if ("result" in selection) return scope.groups?.[selection.result] ?? [];
        if ("capture" in selection) return this.cards(selection.capture, scope);
        if ("union" in selection) return this.unique(selection.union.flatMap((item) => this.cards(item, scope)));
        if ("filter" in selection) return this.cards(selection.filter, scope).filter((card) => this.matches(card, selection.where, scope));
        if ("difference" in selection) {
            const excluded = this.cards(selection.difference[1], scope);
            return this.cards(selection.difference[0], scope).filter((card) => !excluded.some((other) => sameCard(card, other)));
        }
        if ("locationOf" in selection)
            return this.unique(
                this.cards(selection.locationOf, scope).flatMap((card) => {
                    const location = this.locate(card)?.state?.location;
                    return location ? [location] : [];
                }),
            );
        if ("event" in selection) return this.eventCards(scope.event, selection.event);
        if ("challengeParticipant" in selection) {
            const challenge = this.challenge(scope);
            return challenge ? [selection.challengeParticipant === "Attacker" ? challenge.attacker : challenge.defender] : [];
        }
        if ("atEvent" in selection) {
            if (!scope.before) throw new Error("No event-time position available");
            return new Rules(scope.before, this.lookup, this.eventContext(scope)).cards(selection.cards, scope);
        }
        if ("events" in selection)
            return this.unique(
                this.history(scope)
                    .filter((record) => this.historicalMatch(selection.events, record, scope))
                    .flatMap((record) => this.eventCards(record.event, selection.role ?? "Card")),
            );
        if ("cards" in selection && !("zone" in selection) && Array.isArray(selection.cards)) return selection.cards;
        if (!("zone" in selection)) throw new Error("Event and challenge selectors require an event context");
        const players = selection.player ? this.selectPlayers(selection.player, scope) : this.players();
        // Each player has a separate ordered deck. Taking the top/bottom cards
        // must not treat those decks as one concatenated pile.
        if (selection.zone === "Deck" && selection.position && players.length > 1)
            return players.flatMap((player) => this.cards({ ...selection, player: { players: [player] } }, scope));
        const under = selection.under ? this.cards(selection.under, scope) : undefined;
        let cards = players.flatMap((player) => {
            const p = this.player(player);
            switch (selection.zone) {
                case "Play":
                    return p.play.map((entry) => entry.card);
                case "Hand":
                    return p.hand;
                case "Deck":
                    return p.deck;
                case "Discard":
                    return p.discard;
                case "Inkwell":
                    return p.inkwell.map((entry) => entry.card);
                case "Under":
                    return p.play
                        .filter((entry) => !under || under.some((card) => sameCard(card, entry.card)))
                        .flatMap((entry) => entry.under?.map((item) => item.card) ?? []);
                case "Any":
                    return [
                        ...p.deck,
                        ...p.hand,
                        ...p.discard,
                        ...p.inkwell.map((entry) => entry.card),
                        ...p.play.flatMap((entry) => [entry.card, ...(entry.under?.map((item) => item.card) ?? [])]),
                    ];
            }
        });
        if (selection.cards) cards = cards.filter((card) => selection.cards?.some((other) => sameCard(card, other)));
        if (selection.cardType) cards = cards.filter((card) => this.definition(card).type === selection.cardType);
        if (selection.exclude) {
            const exclude = this.cards(selection.exclude, scope);
            cards = cards.filter((card) => !exclude.some((other) => sameCard(card, other)));
        }
        if (selection.where) cards = cards.filter((card) => this.matches(card, selection.where ?? {}, scope));
        if (selection.position === "Bottom") cards = [...cards].reverse();
        return selection.take === undefined ? cards : cards.slice(0, this.amount(selection.take, scope));
    }

    /**
     * Whether a selection includes one card, without listing everything it selects.
     * Equivalent to searching cards(selection), which remains the fallback for
     * ordered or counted selections.
     */
    selects(selection: CardSelection, scope: RuleScope, card: CardIdentifier): boolean {
        if (selection === "Self") return sameCard(scope.source.card, card);
        if (selection === "Affected Card") return !!scope.affected && sameCard(scope.affected, card);
        if (typeof selection === "object" && "zone" in selection && selection.zone !== "Under" && !selection.position && selection.take === undefined && !selection.under) {
            const located = this.locate(card);
            if (!located || (selection.zone !== "Any" && located.zone !== selection.zone)) return false;
            if (selection.player && !this.selectPlayers(selection.player, scope).includes(located.player)) return false;
            if (selection.cards && !selection.cards.some((other) => sameCard(card, other))) return false;
            if (selection.cardType && this.definition(card).type !== selection.cardType) return false;
            if (selection.exclude && this.selects(selection.exclude, scope, card)) return false;
            return !selection.where || this.matches(card, selection.where, scope);
        }
        return this.cards(selection, scope).some((other) => sameCard(other, card));
    }

    private unique(cards: CardIdentifier[]): CardIdentifier[] {
        return cards.filter((card, i) => !cards.slice(0, i).some((other) => sameCard(card, other)));
    }

    compare(value: number, comparison: Comparison, scope: RuleScope): boolean {
        if ("equal" in comparison) return value === this.amount(comparison.equal, scope);
        if ("lessThan" in comparison) return value < this.amount(comparison.lessThan, scope);
        if ("atMost" in comparison) return value <= this.amount(comparison.atMost, scope);
        if ("greaterThan" in comparison) return value > this.amount(comparison.greaterThan, scope);
        return value >= this.amount(comparison.atLeast, scope);
    }

    matches(card: CardIdentifier, filter: CardFilter, scope: RuleScope): boolean {
        const definition = this.definition(card),
            located = this.locate(card),
            state = located?.state;
        if (filter.zone && filter.zone !== located?.zone) return false;
        if (filter.player && (!located || !this.selectPlayers(filter.player, scope).includes(located.player))) return false;
        if (filter.name && !this.names(card).includes(filter.name)) return false;
        if (filter.sameNameAs && !this.cards(filter.sameNameAs, scope).some((other) => this.names(other).some((name) => this.names(card).includes(name))))
            return false;
        if (filter.namedCard && !this.names(card).includes(scope.namedCard ?? "")) return false;
        if (filter.cardType && definition.type !== filter.cardType) return false;
        if (filter.song !== undefined && definition.subtypes.includes("Song") !== filter.song) return false;
        if (filter.inkable !== undefined && this.inkable(card) !== filter.inkable) return false;
        if (filter.inkType && !definition.colors.includes(filter.inkType)) return false;
        if (
            filter.classification &&
            !definition.subtypes.includes(filter.classification) &&
            !this.factModifiers(card, "gainClassification").some((m) => "gainClassification" in m && m.gainClassification === filter.classification)
        )
            return false;
        if (
            filter.keyword &&
            !(filter.keyword === "Sing Together" ? definition.playRules?.some((rule) => rule.type === "Sing Together") : this.keyword(card, filter.keyword))
        )
            return false;
        if (filter.exerted !== undefined) {
            const ink = located?.zone === "Inkwell" ? this.player(located.player).inkwell.find((entry) => sameCard(entry.card, card)) : undefined;
            if (Boolean(state?.exerted ?? ink?.exerted) !== filter.exerted) return false;
        }
        if (filter.faceDown !== undefined) {
            const under = located
                ? this.player(located.player)
                      .play.flatMap((entry) => entry.under ?? [])
                      .find((entry) => sameCard(entry.card, card))
                : undefined;
            if (Boolean(under?.faceDown) !== filter.faceDown) return false;
        }
        if (filter.at && (!state?.location || !this.cards(filter.at, scope).some((location) => sameCard(location, state.location ?? card)))) return false;
        const comparisons = [
            ["cost", "Cost"],
            ["strength", "Strength"],
            ["willpower", "Willpower"],
            ["lore", "Lore"],
            ["damage", "Damage"],
            ["cardsUnder", "Cards Under"],
        ] as const;
        for (const [key, stat] of comparisons) {
            const comparison = filter[key];
            if (comparison && !this.compare(this.characteristic(card, stat), comparison, scope)) return false;
        }
        if (filter.moveCost && !this.compare(definition.type === "Location" ? definition.moveCost : 0, filter.moveCost, scope)) return false;
        if (filter.and && !filter.and.every((item) => this.matches(card, item, scope))) return false;
        if (filter.or && !filter.or.some((item) => this.matches(card, item, scope))) return false;
        if (filter.not && this.matches(card, filter.not, scope)) return false;
        return true;
    }

    inkable(card: CardIdentifier): boolean {
        const overrides = this.factModifiers(card, "inkable");
        const last = overrides[overrides.length - 1];
        return last && "inkable" in last ? last.inkable : this.definition(card).inkwell;
    }

    restricted(card: CardIdentifier, restriction: CardRestriction, other?: CardIdentifier, byPlayer?: PlayerNumber): boolean {
        const player = this.locate(card)?.player;
        if (!player) return false;
        const scope: RuleScope = {
            source: { card, player, kind: "Ability" },
            selected: [],
            parent: [],
            affected: card,
        };
        return this.modifiers(card).some(
            (modifier) =>
                "restriction" in modifier &&
                modifier.restriction === restriction &&
                (!modifier.when || this.condition(modifier.when, scope)) &&
                (!modifier.by || (other !== undefined && this.matches(other, modifier.by, scope))) &&
                (!modifier.byPlayer || (byPlayer !== undefined && this.selectPlayers(modifier.byPlayer, scope).includes(byPlayer))),
        );
    }

    amount(amount: Amount, scope: RuleScope): number {
        if (typeof amount === "number") return amount;
        if ("count" in amount) return this.cards(amount.count, scope).length;
        if ("distinct" in amount) return new Set(this.cards(amount.cards, scope).flatMap((card) => this.definition(card).colors)).size;
        if ("stat" in amount) {
            const cards = this.cards(amount.card, scope);
            if (!cards.length) return 0;
            if (cards.length !== 1) throw new Error("A characteristic read requires exactly one card");
            return this.lastCharacteristic(cards[0], amount.stat, scope, amount.printed);
        }
        if ("sum" in amount || "highest" in amount || "lowest" in amount) {
            const operand = "sum" in amount ? amount.sum : "highest" in amount ? amount.highest : amount.lowest;
            const values = this.cards(operand.cards, scope).map((card) => this.lastCharacteristic(card, operand.stat, scope, operand.printed));
            if ("sum" in amount) return values.reduce((a, b) => a + b, 0);
            if (!values.length) throw new Error("An empty set has no highest or lowest value");
            return "highest" in amount ? Math.max(...values) : Math.min(...values);
        }
        if ("lore" in amount) return this.selectPlayers(amount.lore, scope).reduce((sum, player) => sum + this.player(player).lore, 0);
        if ("players" in amount) return this.selectPlayers(amount.players, scope).length;
        if ("inkDrops" in amount) return this.selectPlayers(amount.inkDrops, scope).reduce((sum, player) => sum + (this.player(player).inkDrops ?? 0), 0);
        if ("turnsTaken" in amount) return this.selectPlayers(amount.turnsTaken, scope).reduce((sum, player) => sum + this.player(player).turnsTaken, 0);
        if ("result" in amount) return scope.numbers?.[amount.result] ?? 0;
        if ("capture" in amount) return this.amount(amount.capture, scope);
        if ("add" in amount) return amount.add.reduce<number>((sum, item) => sum + this.amount(item, scope), 0);
        if ("subtract" in amount) return this.amount(amount.subtract[0], scope) - this.amount(amount.subtract[1], scope);
        if ("multiply" in amount) return this.amount(amount.multiply[0], scope) * this.amount(amount.multiply[1], scope);
        if ("min" in amount) return Math.min(...amount.min.map((item) => this.amount(item, scope)));
        if ("max" in amount) return Math.max(...amount.max.map((item) => this.amount(item, scope)));
        if ("event" in amount) {
            if (!scope.event) throw new Error("No event available");
            return amount.event === "Amount" && "amount" in scope.event
                ? scope.event.amount
                : amount.event === "Ink Paid" && "inkPaid" in scope.event
                  ? scope.event.inkPaid
                  : 0;
        }
        if ("atEvent" in amount) {
            if (!scope.before) throw new Error("No event-time position available");
            return new Rules(scope.before, this.lookup, this.eventContext(scope)).amount(amount.value, scope);
        }
        if ("countEvents" in amount)
            return this.history(scope).filter((record) => this.historicalMatch(amount.countEvents, record, scope)).length;
        throw new Error("Unsupported amount");
    }

    /** Departed cards retain their last in-play characteristics for a resolving effect. */
    private lastCharacteristic(card: CardIdentifier, stat: Characteristic, scope: RuleScope, printed = false): number {
        if (printed || this.locate(card)?.zone === "Play") return this.characteristic(card, stat, printed);
        const history = this.history(scope);
        for (let i = history.length - 1; i >= 0; i--) {
            const record = history[i];
            if (record.event.event !== "Move Card" || !sameCard(record.event.card, card)) continue;
            if (record.event.from === "Play")
                return new Rules(record.before, this.lookup, {
                    challenge: record.challenge,
                }).characteristic(card, stat);
            break;
        }
        if (scope.before && new Rules(scope.before, this.lookup).locate(card)?.zone === "Play")
            return new Rules(scope.before, this.lookup, this.eventContext(scope)).characteristic(card, stat);
        return this.characteristic(card, stat);
    }

    condition(condition: Condition, scope: RuleScope): boolean {
        if ("value" in condition) return this.compare(this.amount(condition.value, scope), condition.is, scope);
        if ("exists" in condition) return this.cards(condition.exists, scope).length > 0;
        if ("existsPlayer" in condition) return this.selectPlayers(condition.existsPlayer, scope).length > 0;
        if ("isPlayer" in condition) return scope.selectedPlayer !== undefined && this.selectPlayers(condition.isPlayer, scope).includes(scope.selectedPlayer);
        if ("every" in condition) {
            const cards = this.cards(condition.every, scope);
            return cards.length > 0 && cards.every((card) => this.matches(card, condition.where, scope));
        }
        if ("differentNames" in condition) {
            const cards = this.cards(condition.differentNames, scope);
            return cards.every((card, i) => !cards.slice(0, i).some((other) => this.names(other).some((name) => this.names(card).includes(name))));
        }
        if ("duringTurnOf" in condition) return !this.readying() && this.selectPlayers(condition.duringTurnOf, scope).includes(this.position.turn.player);
        if ("and" in condition) return condition.and.every((item) => this.condition(item, scope));
        if ("or" in condition) return condition.or.some((item) => this.condition(item, scope));
        if ("not" in condition) return !this.condition(condition.not, scope);
        if ("atEvent" in condition) {
            if (!scope.before) throw new Error("No event-time position available");
            return new Rules(scope.before, this.lookup, this.eventContext(scope)).condition(condition.if, scope);
        }
        if ("playedUsing" in condition) return scope.event?.event === "Play" && scope.event.method === condition.playedUsing;
        if ("inChallenge" in condition) {
            const challenge = this.challenge(scope);
            if (!challenge) return false;
            const participants =
                condition.role === "Attacker"
                    ? [challenge.attacker]
                    : condition.role === "Defender"
                      ? [challenge.defender]
                      : [challenge.attacker, challenge.defender];
            return this.cards(condition.inChallenge, scope).some((card) => participants.some((other) => sameCard(card, other)));
        }
        throw new Error("Challenge conditions require their execution context");
    }

    private eventCards(event: TurnEvent | undefined, role: string): CardIdentifier[] {
        if (!event) return [];
        switch (role) {
            case "Card":
                return "card" in event ? [event.card] : event.event === "Sing" ? event.singers : [];
            case "Attacker":
                return "attacker" in event && event.attacker ? [event.attacker] : [];
            case "Defender":
                return "defender" in event && event.defender ? [event.defender] : [];
            case "Location":
                return "location" in event ? [event.location] : [];
            case "Song":
                return "song" in event ? [event.song] : [];
            case "Singers":
                return "singers" in event && event.singers ? event.singers : [];
            case "Under":
                return "under" in event ? [event.under] : [];
            case "Source":
                return "source" in event && event.source ? [event.source] : [];
            case "Onto":
                return "onto" in event && event.onto ? event.onto : [];
            default:
                return [];
        }
    }

    private historicalMatch(pattern: EventPattern, record: RecordedEvent, scope: RuleScope): boolean {
        const position = record.event.event === "Leave Play" || record.event.event === "Banish" ? record.before : record.after;
        return new Rules(position, this.lookup, {
            challenge: record.challenge,
            readying: record.readying,
        }).matchesEvent(pattern, record.event, {
            ...scope,
            event: record.event,
            before: record.before,
            history: this.history(scope),
            challenge: record.challenge,
        });
    }

    private eventContext(scope: RuleScope): TurnContext {
        const history = this.history(scope);
        const record = history.find((record) => record.event === scope.event);
        return record ? { readying: record.readying, challenge: record.challenge, history } : this.context;
    }

    // Every read of the turn context goes through these, so readsTurn stays exact.
    private history(scope: Pick<RuleScope, "history">): readonly RecordedEvent[] {
        this.readsTurn = true;
        return scope.history ?? this.context.history ?? [];
    }

    private challenge(scope: Pick<RuleScope, "challenge">): RuleScope["challenge"] {
        this.readsTurn = true;
        return scope.challenge ?? this.context.challenge;
    }

    private readying(): boolean {
        this.readsTurn = true;
        return !!this.context.readying;
    }

    private uses(card: CardIdentifier, ability: number): number {
        this.readsTurn = true;
        return this.context.usedAbilities?.find((use) => sameCard(use.card, card) && use.ability === ability)?.uses ?? 0;
    }

    matchesEvent(pattern: EventPattern, event: TurnEvent, scope: RuleScope): boolean {
        if ("anyOf" in pattern) return pattern.anyOf.some((item) => this.matchesEvent(item, event, scope));
        if (pattern.event !== event.event) return false;
        if ("player" in pattern && pattern.player) {
            const players = typeof event.player === "number" ? [event.player] : event.player.together;
            if (!players.some((player) => this.selectPlayers(pattern.player ?? "You", scope).includes(player))) return false;
        }
        if ("kind" in pattern && pattern.kind && (!("kind" in event) || event.kind !== pattern.kind)) return false;
        if ("from" in pattern && pattern.from && (!("from" in event) || event.from !== pattern.from)) return false;
        if ("to" in pattern && pattern.to && (!("to" in event) || event.to !== pattern.to)) return false;
        const roles = [
            ["card", "Card"],
            ["attacker", "Attacker"],
            ["defender", "Defender"],
            ["source", "Source"],
            ["song", "Song"],
            ["onto", "Onto"],
            ["location", "Location"],
            ["under", "Under"],
        ] as const;
        for (const [key, role] of roles) {
            if (!(key in pattern)) continue;
            const selection = (pattern as Partial<Record<typeof key, CardSelection>>)[key];
            if (!selection) continue;
            const candidates = this.cards(selection, scope);
            if (!this.eventCards(event, role).some((card) => candidates.some((candidate) => sameCard(card, candidate)))) return false;
        }
        return !pattern.when || this.condition(pattern.when, scope);
    }
}
