/** Scope validation for typed catalog definitions. Does not validate untrusted JSON
 * or decide whether an instruction is currently legal on a particular board. */
import type { Ability, CardRules, Cost, EventPattern, ContinuousRule, Effect } from "./ability";

export interface DefinitionIssue {
    path: string;
    message: string;
}

interface Scope {
    cards: number;
    selectedCount?: number;
    parentSelectedCount?: number;
    player: boolean;
    named: boolean;
    affected: boolean;
    /** Undefined: invocation context is not statically known. */
    challenge?: boolean;
    results: Set<string>;
    events: Set<string>;
    /** The event is an action's own Play, which has no earlier state to read. */
    ownPlay?: boolean;
    capture?: Scope;
}

function fresh(capture?: Scope): Scope {
    return { cards: 0, player: false, named: false, affected: false,
        results: new Set(), events: new Set(), capture };
}

function child(scope: Scope): Scope {
    return { ...scope, results: new Set(scope.results) };
}

function selectCards(scope: Scope, count?: number): Scope {
    return { ...child(scope), cards: scope.cards + 1,
        selectedCount: count, parentSelectedCount: scope.selectedCount };
}

function knownCardCount(value: unknown, scope: Scope): number | undefined {
    if (value === "Self" || value === "Affected Card") return 1;
    if (value === "Selected Cards") return scope.selectedCount;
    if (value === "Parent Selected Cards") return scope.parentSelectedCount;
    if (value !== null && typeof value === "object" && "capture" in value) {
        return scope.capture === undefined ? undefined : knownCardCount(value.capture, scope.capture);
    }
    if (value !== null && typeof value === "object" && "atEvent" in value && "cards" in value) {
        return knownCardCount(value.cards, scope);
    }
    if (value !== null && typeof value === "object" && "cards" in value && !("zone" in value) && Array.isArray(value.cards)) return value.cards.length;
    return undefined;
}

function knownPlayerCount(value: unknown, scope: Scope): number | undefined {
    if (["You", "Selected Player"].includes(String(value))) return 1;
    if (value === null || typeof value !== "object") return undefined;
    if ("capture" in value) return scope.capture === undefined ? undefined : knownPlayerCount(value.capture, scope.capture);
    if ("players" in value && Array.isArray(value.players)) return new Set(value.players).size;
    if ("event" in value && value.event === "Player") return 1;
    if ("ownerOf" in value) {
        const cards = knownCardCount(value.ownerOf, scope);
        return cards === 0 || cards === 1 ? cards : undefined;
    }
    if ("from" in value && !("where" in value) && !("rank" in value)) return knownPlayerCount(value.from, scope);
    return undefined;
}

/**
 * These rules consume a use when an action or entry commits, not when queried.
 */
function consumableRule(rule: ContinuousRule): boolean {
    if (rule.type === "Together") return rule.rules.length > 0 && rule.rules.every(consumableRule);
    if (rule.type === "Conditional") return consumableRule(rule.then) && (rule.otherwise === undefined || consumableRule(rule.otherwise));
    return ["Modify Cost", "Alternate Cost", "Free Ability", "Enter Play"].includes(rule.type);
}

/** Fields available on each concrete event (see TurnEvent). Optional source and
 * participants may be absent at runtime, in which case their selectors return no cards. */
function eventFields(event: string): Set<string> {
    const fields = new Set(["Player"]);
    if (!["Turn Start", "Turn End", "Gain Lore", "Lose Lore", "Challenge", "After Challenge", "Sing"].includes(event)) fields.add("Card");
    if (["Deal Damage", "Put Damage", "Remove Damage", "Gain Lore", "Lose Lore"].includes(event)) fields.add("Amount");
    if (["Challenge", "After Challenge", "Banish"].includes(event)) {
        fields.add("Attacker"); fields.add("Defender");
    }
    if (event === "Play") { fields.add("Ink Paid"); fields.add("Singers"); }
    if (event === "Put Under") fields.add("Under");
    if (event === "Move To Location") fields.add("Location");
    if (event === "Sing") { fields.add("Song"); fields.add("Singers"); fields.add("Card"); }
    return fields;
}

/** Only infer contexts guaranteed by the event, not by its spelling alone. */
function challengeContext(pattern: EventPattern): boolean | undefined {
    if ("anyOf" in pattern) {
        const contexts = pattern.anyOf.map(challengeContext);
        return contexts.every(value => value === contexts[0]) ? contexts[0] : undefined;
    }
    if (pattern.event === "Challenge") return true;
    if (["Turn Start", "Turn End", "After Challenge"].includes(pattern.event)) return false;
    if ("kind" in pattern && pattern.kind === "Challenge") return true;
    return undefined;
}

const outputs: Record<string, string[]> = {
    Look: ["Looked At Cards"], Reveal: ["Revealed Cards"], "Reveal Until": ["Revealed Cards"],
    Discard: ["Discarded Cards"], Banish: ["Banished Cards"],
    "Move Card": ["Moved Cards"], "Move To Location": ["Moved Cards"],
    "Remove Damage": ["Damage Removed", "Characters With Damage Removed"],
    "Move Damage": ["Damage Moved"], "Lose Lore": ["Lore Lost"], Ready: ["Readied Cards"],
};

class Validator {
    issues: DefinitionIssue[] = [];

    issue(path: string, message: string): void { this.issues.push({ path, message }); }

    /** Computed amounts are checked after evaluation; only literal bounds are known here. */
    nonnegative(value: unknown, path: string): void {
        if (typeof value === "number" && value < 0) this.issue(path, "This value must be nonnegative.");
    }

    /**
     * Reject known empty/group operands where exactly one card is required.
     * Dynamic selections must also be checked when the instruction resolves.
     */
    singleCard(value: unknown, scope: Scope, path: string): void {
        const count = knownCardCount(value, scope);
        if (count !== undefined && count !== 1) this.issue(path, "This operand requires exactly one card.");
    }

    /**
     * Group selectors need an explicit player choice. Dynamic queries are checked at resolution.
     */
    singlePlayer(value: unknown, scope: Scope, path: string): void {
        if (value !== null && typeof value === "object" && "capture" in value) {
            if (scope.capture !== undefined) this.singlePlayer(value.capture, scope.capture, `${path}.capture`);
            return;
        }
        const count = knownPlayerCount(value, scope);
        const group = value !== null && typeof value === "object" && "together" in value;
        if (group || ["All", "Opponents", "Teammates"].includes(String(value)) || (count !== undefined && count !== 1)) {
            this.issue(path, "This operand requires exactly one player.");
        }
    }

    pattern(pattern: EventPattern, scope: Scope, path: string): Set<string> {
        if ("anyOf" in pattern) {
            const alternatives = pattern.anyOf.map((p, i) => this.pattern(p, scope, `${path}.anyOf[${i}]`));
            const first = alternatives[0];
            return new Set(first === undefined ? [] : [...first].filter(field => alternatives.every(fields => fields.has(field))));
        }
        const events = eventFields(pattern.event);
        this.operands(pattern, { ...scope, events }, path, ["event"]);
        return events;
    }

    /** Walk only operand structures. Effects, abilities and event patterns establish
     * scopes explicitly in the methods below rather than treating them as operands. */
    operand(value: unknown, scope: Scope, path: string): void {
        if (typeof value === "number") {
            if (!Number.isFinite(value) || !Number.isInteger(value)) this.issue(path, "Numeric literals must be finite integers.");
            return;
        }
        if (typeof value === "string") {
            if (value === "Selected Cards" && scope.cards === 0) this.issue(path, "Selected Cards requires an enclosing card selection.");
            if (value === "Parent Selected Cards" && scope.cards < 2) this.issue(path, "Parent Selected Cards requires two enclosing card selections.");
            if (value === "Selected Player" && !scope.player) this.issue(path, "Selected Player requires an enclosing player selection.");
            if (value === "Affected Card" && !scope.affected) this.issue(path, "Affected Card is available only while evaluating a card modifier.");
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((item: unknown, i: number) => this.operand(item, scope, `${path}[${i}]`));
            return;
        }
        if (value === null || typeof value !== "object") return;
        const object = value as Record<string, unknown>;
        if ("whileInPlay" in object) this.singleCard(object.whileInPlay, scope, `${path}.whileInPlay`);
        if (object.type === "Move Card" && object.to === "Under") this.singleCard(object.under, scope, `${path}.under`);
        if (object.type === "Move To Location") this.singleCard(object.location, scope, `${path}.location`);
        if (object.type === "Move Damage") {
            this.singleCard(object.from, scope, `${path}.from`);
            this.singleCard(object.to, scope, `${path}.to`);
        }
        if (object.until === "End Of Challenge" && scope.challenge === false) {
            this.issue(`${path}.until`, "End Of Challenge requires an active challenge.");
        }
        if (object.until === "Start Of Next Turn" || object.until === "End Of Next Turn") this.singlePlayer(object.player, scope, `${path}.player`);
        if ("duringNextTurn" in object) this.singlePlayer(object.duringNextTurn, scope, `${path}.duringNextTurn`);
        if (object.type === "Enter Play") this.nonnegative(object.damage, `${path}.damage`);
        if ("from" in object && !("type" in object)) {
            this.operand(object.from, scope, `${path}.from`);
            const candidate = { ...scope, player: true };
            this.operand(object.where, candidate, `${path}.where`);
            this.operand(object.rank, candidate, `${path}.rank`);
            return;
        }
        if (object.gainKeyword !== undefined) this.nonnegative(object.amount, `${path}.amount`);
        if (object.take !== undefined) this.nonnegative(object.take, `${path}.take`);
        if ("capture" in object) {
            if (scope.capture === undefined) this.issue(path, "Capture is available only inside a created or granted definition.");
            else this.operand(object.capture, scope.capture, `${path}.capture`);
            return;
        }
        if (typeof object.result === "string" && !scope.results.has(object.result)) this.issue(`${path}.result`, `No earlier instruction supplies ${object.result} in this scope.`);
        if (typeof object.event === "string" && !scope.events.has(object.event)) this.issue(`${path}.event`, `${object.event} is unavailable for this event context.`);
        if (object.atEvent !== undefined && (scope.events.size === 0 || scope.ownPlay)) this.issue(`${path}.atEvent`, "Event-time reading requires an event context.");
        if (object.namedCard !== undefined && !scope.named) this.issue(`${path}.namedCard`, "Named Card requires an earlier Name Card instruction.");
        if (object.stat !== undefined && object.card !== undefined) {
            const count = knownCardCount(object.card, scope);
            if (count !== undefined && count !== 1) this.issue(`${path}.card`, "A scalar stat requires one card; use sum for a group.");
        }
        for (const key of ["highest", "lowest"]) {
            const group = object[key];
            if (group !== null && typeof group === "object" && "cards" in group && knownCardCount(group.cards, scope) === 0) this.issue(`${path}.${key}.cards`, "A highest/lowest stat requires a nonempty group.");
        }
        for (const key of ["min", "max"]) {
            if (Array.isArray(object[key]) && object[key].length === 0) this.issue(`${path}.${key}`, "A minimum/maximum requires at least one amount.");
        }
        for (const key of ["lore", "turnsTaken"]) {
            if (key in object) this.singlePlayer(object[key], scope, `${path}.${key}`);
        }
        if (object.playedUsing !== undefined && !scope.events.has("Ink Paid")) this.issue(path, "Played Using requires a Play event context.");
        if ("countEvents" in object) {
            this.pattern(object.countEvents as EventPattern, scope, `${path}.countEvents`);
        }
        if ("events" in object && "during" in object) {
            const fields = this.pattern(object.events as EventPattern, scope, `${path}.events`);
            const role = typeof object.role === "string" ? object.role : "Card";
            if (!fields.has(role)) this.issue(`${path}.role`, `${role} is unavailable for these history events.`);
        }
        if (object.zone !== undefined && object.under !== undefined && object.zone !== "Under") this.issue(`${path}.under`, "An under selector requires zone Under.");
        if (object.zone !== undefined && object.position !== undefined && object.zone !== "Deck") this.issue(`${path}.position`, "A deck position requires zone Deck.");
        this.operands(object, scope, path, ["result", "event", "events", "countEvents", "namedCard"]);
    }

    operands(value: object, scope: Scope, path: string, skip: string[] = []): void {
        for (const [key, item] of Object.entries(value)) {
            // Printed labels are data, even if they happen to match a binding name.
            if (skip.includes(key) || ["name", "names", "id", "classification", "countsAsName", "type"].includes(key)) continue;
            if (["additionalInk", "readyLimit", "challengeLimit", "uses"].includes(key)) this.nonnegative(item, `${path}.${key}`);
            if (key === "victoryLore" && typeof item === "number" && item < 1) this.issue(`${path}.${key}`, "Victory lore must be positive.");
            if (key === "gainAbility") {
                const ability = item as Ability;
                const at = `${path}.gainAbility`;
                if (ability.type === "Deck Construction") this.issue(at, "Deck-construction rules cannot be granted during play.");
                else if (ability.type === "Keyword" && ability.keyword.name !== "Boost" && ability.keyword.name !== "Shift") this.issue(at, "Simple and numeric keyword grants must use gainKeyword.");
                this.ability(ability, at, scope);
            }
            else if (key === "modifier") this.operand(item, { ...scope, affected: true }, `${path}.${key}`);
            else this.operand(item, scope, `${path}.${key}`);
        }
    }

    costs(costs: Cost[], scope: Scope, path: string): void {
        costs.forEach((cost, i) => {
            const at = `${path}[${i}]`;
            if (cost.type === "Move Card" && cost.to === "Under") this.singleCard(cost.under, scope, `${at}.under`);
            this.operands(cost, scope, at, ["cost"]);
            if ("amount" in cost) this.nonnegative(cost.amount, `${at}.amount`);
            if (cost.type === "Choose Cards") {
                if (cost.count < 0) this.issue(`${at}.count`, "Cost choice count must be nonnegative.");
                this.costs(cost.cost, selectCards(scope, cost.count), `${at}.cost`);
            }
        });
    }

    ability(ability: Ability, path: string, capture?: Scope): void {
        if (ability.type === "Deck Construction") {
            if ("maxCopies" in ability && ability.maxCopies !== "Unlimited") {
                this.operand(ability.maxCopies, fresh(), `${path}.maxCopies`);
                this.nonnegative(ability.maxCopies, `${path}.maxCopies`);
            }
            return;
        }
        const scope = fresh(capture);
        if (ability.type === "Activated") scope.challenge = false;
        if (ability.type !== "Keyword" && ability.type !== "Replacement") {
            this.limit(ability.limit, scope, `${path}.limit`);
        }
        if (ability.type === "Triggered") {
            scope.challenge = challengeContext(ability.trigger);
            scope.events = this.pattern(ability.trigger, scope, `${path}.trigger`);
        }
        if (ability.type === "Replacement") {
            this.replacement(ability.replacement, scope, `${path}.replacement`);
        } else if (ability.type === "Static") {
            if (ability.limit !== undefined) {
                if (!consumableRule(ability.rule)) this.issue(`${path}.limit.perTurn`, "A static use limit requires an action/entry rule, not a passive modifier.");
            }
            this.rule(ability.rule, scope, `${path}.rule`);
        } else if (ability.type === "Keyword") {
            this.keyword(ability.keyword, scope, `${path}.keyword`);
        } else {
            if (ability.type === "Activated") {
                this.costs(ability.cost, scope, `${path}.cost`);
                this.operand(ability.when, scope, `${path}.when`);
                scope.results.add("Paid Cards");
            }
            this.effect(ability.effect, scope, `${path}.effect`);
        }
    }

    limit(limit: { perTurn: number } | undefined, scope: Scope, path: string): void {
        if (limit === undefined) return;
        this.operand(limit.perTurn, scope, `${path}.perTurn`);
        this.nonnegative(limit.perTurn, `${path}.perTurn`);
    }

    keyword(keyword: Extract<Ability, { type: "Keyword" }>["keyword"], scope: Scope, path: string): void {
        this.operands(keyword, scope, path, ["cost", "when", "afterShift"]);
        if ("amount" in keyword) this.nonnegative(keyword.amount, `${path}.amount`);
        if ("cost" in keyword) this.costs(keyword.cost, scope, `${path}.cost`);
        if (keyword.name === "Shift") {
            if (keyword.names !== undefined) {
                const count = keyword.count ?? 1;
                if (count === "One Or Two") this.issue(`${path}.names`, "Required name slots need a fixed base count; use onto for a variable-size pool.");
                if (keyword.names.length === 0 || keyword.names.some(name => name.trim().length === 0)) this.issue(`${path}.names`, "Shift names must be nonempty printed names.");
                if ((typeof count === "number" && keyword.names.length !== count) || (count === "One Or Two" && ![1, 2].includes(keyword.names.length))) this.issue(`${path}.names`, "Each required name needs exactly one Shift base.");
            }
            this.operand(keyword.when, selectCards(scope, typeof keyword.count === "number" ? keyword.count : keyword.count === undefined ? 1 : undefined), `${path}.when`);
            if (keyword.afterShift !== undefined) this.effect(keyword.afterShift, { ...scope, events: eventFields("Play") }, `${path}.afterShift`);
        }
    }

    replacement(replacement: Extract<Ability, { type: "Replacement" }>["replacement"], scope: Scope, path: string): void {
        this.limit(replacement.limit, scope, `${path}.limit`);
        scope = { ...scope, challenge: challengeContext(replacement.event) };
        const events = this.pattern(replacement.event, scope, `${path}.event`);
        if (replacement.damage !== undefined) {
            const onlyDamage = (pattern: EventPattern): boolean => "anyOf" in pattern
                ? pattern.anyOf.every(onlyDamage) : pattern.event === "Deal Damage";
            if (!onlyDamage(replacement.event)) this.issue(`${path}.event`, "Damage adjustment requires only Deal Damage events.");
            this.operand(replacement.damage, { ...scope, events }, `${path}.damage`);
            this.nonnegative(replacement.damage.amount, `${path}.damage.amount`);
        }
        if (replacement.instead !== undefined) this.effect(replacement.instead, { ...scope, events }, `${path}.instead`);
    }

    rule(rule: Extract<Ability, { type: "Static" }>["rule"], scope: Scope, path: string): void {
        if (rule.type === "Enter Play") {
            this.nonnegative(rule.damage, `${path}.damage`);
            if (rule.then !== undefined) this.effect(rule.then, { ...fresh(scope.capture), events: eventFields("Play") }, `${path}.then`);
        }
        this.operands(rule, scope, path, ["rules", "then", "otherwise", "cost"]);
        if (rule.type === "Together") rule.rules.forEach((r, i) => this.rule(r, scope, `${path}.rules[${i}]`));
        if (rule.type === "Conditional") {
            this.rule(rule.then, scope, `${path}.then`);
            if (rule.otherwise !== undefined) this.rule(rule.otherwise, scope, `${path}.otherwise`);
        }
        if ("cost" in rule) this.costs(rule.cost, scope, `${path}.cost`);
    }

    /** Returns outputs produced by this instruction, excluding inherited outputs. */
    effect(effect: Effect, scope: Scope, path: string): Set<string> {
        const produced = new Set<string>();
        const publish = (values: Set<string>) => values.forEach(value => { produced.add(value); scope.results.add(value); });
        if ("player" in effect && ["Choose Cards", "Choose Player", "Choose Mode", "Or", "Optional", "Pay Cost", "Play", "Name Card", "Move Card", "Look"].includes(effect.type)) {
            // A group deciding together makes one decision (Tamatoa - Grabby Crab).
            const decider = effect.player;
            if (decider === undefined || typeof decider !== "object" || !("together" in decider)) this.singlePlayer(decider, scope, `${path}.player`);
        }
        if (effect.type === "Move To Location") this.singleCard(effect.location, scope, `${path}.location`);
        if (effect.type === "Move Card" && effect.to === "Under") this.singleCard(effect.under, scope, `${path}.under`);
        if (effect.type === "Move Damage") {
            this.singleCard(effect.from, scope, `${path}.from`);
            this.singleCard(effect.to, scope, `${path}.to`);
        }
        this.operands(effect, scope, path, ["effects", "options", "effect", "do", "then", "otherwise", "cost", "rule", "trigger", "where", "until", "modifier"]);
        if ("amount" in effect) {
            const amount = typeof effect.amount === "object" && "upTo" in effect.amount ? effect.amount.upTo : effect.amount;
            this.nonnegative(amount, `${path}.amount`);
        }
        if ("where" in effect && effect.type !== "Choose Cards") this.operand(effect.where, scope, `${path}.where`);
        switch (effect.type) {
            case "Sequence": {
                const local = child(scope);
                effect.effects.forEach((e, i) => {
                    const values = this.effect(e, local, `${path}.effects[${i}]`);
                    values.forEach(value => { produced.add(value); local.results.add(value); });
                });
                publish(produced);
                break;
            }
            case "Choose Cards": case "Random Cards": case "Search": {
                const count = typeof effect.count === "number" ? effect.count : undefined;
                const maximum = typeof effect.count === "object" && "upTo" in effect.count ? effect.count.upTo : count;
                if (typeof maximum === "number" && maximum < 0) this.issue(`${path}.count`, "Choice count must be nonnegative.");
                const nested = selectCards(scope, count);
                if (effect.type === "Choose Cards") this.operand(effect.where, nested, `${path}.where`);
                publish(this.effect(effect.effect, nested, `${path}.effect`));
                break;
            }
            case "Choose Player": case "For Each Player":
                publish(this.effect(effect.effect, { ...child(scope), player: true }, `${path}.effect`));
                break;
            case "For Each Card":
                publish(this.effect(effect.effect, selectCards(scope, 1), `${path}.effect`));
                break;
            case "Repeat": {
                if (effect.times !== undefined && effect.until !== undefined) this.issue(path, "Repeat requires either times or until, not both.");
                if ("times" in effect && typeof effect.times === "number" && effect.times < 0) this.issue(`${path}.times`, "Repeat count must be nonnegative.");
                const nested = child(scope);
                publish(this.effect(effect.effect, nested, `${path}.effect`));
                if ("until" in effect) this.operand(effect.until, nested, `${path}.until`);
                break;
            }
            case "Choose Mode": case "Or": {
                if (effect.options.length < 2) this.issue(`${path}.options`, "A choice requires at least two alternatives.");
                const branches = effect.options.map((e, i) => this.effect(e, child(scope), `${path}.options[${i}]`));
                branches.forEach(publish);
                break;
            }
            case "Conditional": {
                const before = child(scope);
                publish(this.effect(effect.then, child(before), `${path}.then`));
                if (effect.otherwise !== undefined) publish(this.effect(effect.otherwise, child(before), `${path}.otherwise`));
                break;
            }
            case "Optional": publish(this.effect(effect.effect, child(scope), `${path}.effect`)); break;
            case "Do Then": {
                publish(this.effect(effect.do, child(scope), `${path}.do`));
                const before = child(scope);
                publish(this.effect(effect.then, child(before), `${path}.then`));
                if (effect.otherwise !== undefined) publish(this.effect(effect.otherwise, child(before), `${path}.otherwise`));
                break;
            }
            case "Pay Cost": {
                this.costs(effect.cost, scope, `${path}.cost`);
                const paid = child(scope); paid.results.add("Paid Cards");
                publish(new Set(["Paid Cards"]));
                publish(this.effect(effect.then, child(paid), `${path}.then`));
                if (effect.otherwise !== undefined) publish(this.effect(effect.otherwise, child(paid), `${path}.otherwise`));
                break;
            }
            case "Modify Players":
                // These selectors/conditions remain live, after local bindings disappear.
                this.operand(effect.modifier, fresh(scope), `${path}.modifier`);
                break;
            case "Modify Cards":
                // Numeric changes are computed now. Restrictions retain live predicates;
                // granted abilities establish their own future instruction scopes.
                this.operand(effect.modifier,
                    { ...("restriction" in effect.modifier ? fresh(scope) : scope), affected: true },
                    `${path}.modifier`);
                break;
            case "Create Rule":
                if (effect.uses !== undefined && !consumableRule(effect.rule)) this.issue(`${path}.uses`, "A created rule's use limit requires an action/entry rule, not a passive modifier.");
                this.rule(effect.rule, fresh(scope), `${path}.rule`);
                break;
            case "Create Trigger": {
                const future = fresh(scope);
                future.challenge = challengeContext(effect.trigger);
                future.events = this.pattern(effect.trigger, future, `${path}.trigger`);
                this.effect(effect.effect, future, `${path}.effect`);
                break;
            }
            case "Delay": {
                this.singlePlayer(effect.until.turnEnd, scope, `${path}.until.turnEnd`);
                this.operand(effect.until, scope, `${path}.until`);
                const future = fresh(scope); future.events = eventFields("Turn Start"); future.challenge = false;
                this.effect(effect.effect, future, `${path}.effect`);
                break;
            }
            case "Name Card": scope.named = true; break;
            default: publish(new Set(outputs[effect.type] ?? []));
        }
        return produced;
    }
}

/** Validate once when loading authored definitions. Issues use readable property paths. */
export function validateCardRules(rules: CardRules): DefinitionIssue[] {
    const validator = new Validator();
    rules.playRules?.forEach((rule, i) => {
        const path = `playRules[${i}]`;
        if ("when" in rule) validator.operand(rule.when, fresh(), `${path}.when`);
        if ("cost" in rule && Array.isArray(rule.cost)) validator.costs(rule.cost, fresh(), `${path}.cost`);
        else if ("cost" in rule && typeof rule.cost === "number") {
            validator.operand(rule.cost, fresh(), `${path}.cost`);
            validator.nonnegative(rule.cost, `${path}.cost`);
        }
    });
    // An action resolves as part of being played, so it can read its own Play event (singers, ink paid),
    // but there is no earlier game state to read at event time.
    if (rules.type === "Action") validator.effect(rules.effect, { ...fresh(), events: eventFields("Play"), ownPlay: true }, "effect");
    rules.abilities?.forEach((ability, i) => validator.ability(ability, `abilities[${i}]`));
    return validator.issues;
}
