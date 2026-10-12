import { choiceCandidates, executeSelection, hasSelection } from "./effect-selection";
import type { SelectionContext } from "./effect-selection";
import { executeLasting } from "./effect-lasting";
import type { LastingContext } from "./effect-lasting";
import { removeDamage, dealDamage, damageAmount } from "./effect-damage";
import type { HealingContext, DamageContext } from "./effect-damage";
import { executeComposition } from "./effect-composition";
import type { EffectScope as Scope, CompositionContext } from "./effect-composition";
import { cards as catalog } from "../cards";
import { Resolution } from "./resolution";
import { freeze, immutable, mapKept } from "./immutable";
import { moveCard, moveToLocation } from "./movement";
import type { MovementContext, MoveOptions } from "./movement";
import { sameCard } from "./identity";
import { InvalidInput } from "./invalid-input";
import { assertRequestedInput } from "./turn-input";
import { getLegalActions, winners, canPayCosts } from "./actions";
import { PLAY_ONLY, Rules, catalogLookup } from "./rules";
import { assertSupportedBoard, assertSupportedDefinition } from "./capabilities";
import { instructionResults, emptyResults } from "./effect-results";
import type { Results } from "./effect-results";
import { matchPayment, matchTogether, canPayTogether } from "./costs";
import type { InputRequest, CardObservation, AnswerFor } from "./resolution";
import type { Amount, CardSelection, Effect, PlayerSelection, Duration, Cost } from "../model/ability";
import type { Card } from "../model/card";
import type { CardState, CardModifier, PlayerModifier, EffectExpiry, EffectSource, GameState, PlayerPosition } from "../model/game-state";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { Decision, DecisionAnswer, DecisionPlayer, TurnStep, TurnEvent, PendingTrigger, PlayerAction } from "../model/turn";
import type { RecordedEvent, EngineOptions, RegisteredRule } from "./rules";

export type { EngineOptions } from "./rules";

const printedNames = new Set(catalog.flatMap((card) => card.names));

/** A fresh scope for a source's instructions, with nothing selected or produced yet. */
function scopeFor(source: EffectSource): Scope {
    return { source, selected: [], parent: [], results: {} };
}

/** Filters an array, keeping it when every element remains. */
function filterKept<T>(items: T[], keep: (item: T) => boolean): T[] {
    const result = items.filter(keep);
    return result.length === items.length ? items : result;
}

/** Executes parsed instructions against the new state. Unsupported mechanics fail explicitly. */
class Evaluator {
    private readonly observations: CardObservation[] = [];
    private state: GameState;
    private readonly lookup: (fullName: string) => Card | undefined;
    /** Attribution survives an action leaving play during its own resolution. */
    private resolving?: EffectSource;
    private readonly generated: {
        source: EffectSource;
        effect: Effect;
        afterwards?: "Deck Bottom";
        retain?: boolean;
        scope?: Scope;
    }[] = [];
    private readonly generatedSources: EffectSource[] = [];
    private inked = 0;
    private ended = false;
    private deckedOut?: PlayerNumber;
    private winners?: PlayerNumber[];
    private readying = false;
    private challenge?: { attacker: CardIdentifier; defender: CardIdentifier };
    private damageBatch?: {
        before: GameState;
        events: Extract<TurnEvent, { card: CardIdentifier; amount: number }>[];
    };
    private readonly damageSources = new Map<string, { source: CardIdentifier; kind: "Challenge" | "Ability" | "Action" }>();
    private readonly usedAbilities: { card: CardIdentifier; ability: number; uses: number }[] = [];
    private readonly events: RecordedEvent[] = [];
    private readonly registry: (RegisteredRule & {
        active: boolean;
        retired?: boolean;
        uses: number;
        occurrences: number;
        remaining?: number;
    })[] = [];
    private readonly bag: { trigger: PendingTrigger; scope: Scope; rule: number }[] = [];
    private bagPlayer?: PlayerNumber;
    private readonly installed = new Map<Extract<PlayerModifier, { trigger: unknown }>, number>();
    /** Waiting for the turn player's next intention, where the turn can branch. */
    private intention = false;
    /** The legal actions offered at that intention, which a branch offers again unchanged. */
    private offered?: PlayerAction[];

    private readonly composition: CompositionContext = {
        rules: () => this.rules(),
        position: () => this.state,
        ended: () => this.ended,
        execute: (effect, scope) => this.execute(effect, scope),
        selectPlayers: (selection, scope) => this.selectPlayers(selection, scope),
        cards: (selection, scope) => this.cards(selection, scope),
        amount: (amount, scope) => this.amount(amount, scope),
    };

    private readonly lastingEffects: LastingContext = {
        rules: () => this.rules(),
        cards: (selection, scope) => this.cards(selection, scope),
        selectPlayers: (selection, scope) => this.selectPlayers(selection, scope),
        amount: (amount, scope) => this.amount(amount, scope),
        lasting: (duration, scope) => this.lasting(duration, scope),
        bindCaptures: (definition, scope) => this.bindCaptures(definition, scope),
        updateCard: (card, change) => this.updateCard(card, change),
        updatePlayer: (player, change) => this.updatePlayer(player, change),
        registerRules: () => this.registerRules(),
        execute: (effect, scope) => this.execute(effect, scope),
    };

    private readonly selection: SelectionContext = {
        rules: () => this.rules(),
        position: () => this.state,
        holder: (card) => this.holder(card),
        cards: (selection, scope) => this.cards(selection, scope),
        selectPlayers: (selection, scope) => this.selectPlayers(selection, scope),
        decider: (selection, scope) => this.decider(selection, scope),
        amount: (amount, scope) => this.amount(amount, scope),
        alternativeAvailable: (effect, scope) => this.alternativeAvailable(effect, scope),
        execute: (effect, scope) => this.execute(effect, scope),
        answer: (decision, validate) => this.answer(decision, validate),
        emit: (event, before) => this.emit(event, before),
    };

    private readonly healing: HealingContext = {
        rules: () => this.rules(),
        position: () => this.state,
        cards: (selection, scope) => this.cards(selection, scope),
        amount: (amount, scope) => this.amount(amount, scope),
        inPlay: (card) => this.inPlay(card),
        definition: (card) => this.definition(card),
        updateCard: (card, change) => this.updateCard(card, change),
        emit: (event, before) => this.emit(event, before),
        answer: (decision, validate) => this.answer(decision, validate),
    };

    private readonly movement: MovementContext = {
        rules: () => this.rules(),
        position: () => this.state,
        players: () => this.players(),
        definition: (card) => this.definition(card),
        holder: (card) => this.holder(card),
        updatePlayer: (player, change) => this.updatePlayer(player, change),
        updateCard: (card, change) => this.updateCard(card, change),
        expireDepartures: (cards) => this.expireDepartures(cards),
        emit: (event, before) => this.emit(event, before),
        payMovement: (card, destination, player, free) => this.payMovement(card, destination, player, free),
    };

    private readonly damageEffects: DamageContext = {
        rules: () => this.rules(),
        cards: (selection, scope) => this.cards(selection, scope),
        amount: (amount, scope) => this.amount(amount, scope),
        definition: (card) => this.definition(card),
        replace: (event) => this.replace(event),
        begin: () => {
            const outer = !this.damageBatch;
            if (outer) this.damageBatch = { before: this.state, events: [] };
            return outer;
        },
        queue: (event) => {
            if (!this.damageBatch) throw new Error("Damage batch was lost during replacement");
            this.damageBatch.events.push(event);
        },
        commit: () => this.commitDamage(),
    };

    private cachedRules?: Rules;
    private rules(): Rules {
        if (this.cachedRules?.position !== this.state)
            this.cachedRules = new Rules(this.state, this.lookup, {
                challenge: this.challenge,
                history: this.events,
                usedAbilities: this.usedAbilities,
                readying: this.readying,
            });
        return this.cachedRules;
    }

    private outcome(): import("./resolution").GameOutcome | undefined {
        if (this.deckedOut !== undefined)
            return {
                reason: "Empty Deck",
                winners: this.players().filter((player) => player !== this.deckedOut),
            };
        const winners = this.winners ?? [];
        return winners.length ? { reason: "Lore", winners } : undefined;
    }

    /** The position and query view the registry was last brought up to date with. */
    private registered?: { state: GameState; rules: Rules };

    private registerRules(): void {
        const rules = this.rules();
        // Unless discovery read the turn's history or limits, it depends on the position alone.
        if (this.registered?.state === this.state && !this.registered.rules.readsTurn) return;
        this.registered = { state: this.state, rules };
        const previous = this.registry.filter((rule) => !rule.retired);
        const matched = new Set<RegisteredRule>();
        for (const rule of this.registry) rule.active = false;
        for (const candidate of rules.registeredRules()) {
            const known = candidate.listener ? this.installed.get(candidate.listener) : undefined;
            const existing =
                known !== undefined
                    ? this.registry[known]
                    : previous.find(
                          (entry) =>
                              !matched.has(entry) &&
                              entry.slot === candidate.slot &&
                              entry.grant === candidate.grant &&
                              entry.shield === candidate.shield &&
                              entry.listener === candidate.listener &&
                              sameCard(entry.source.card, candidate.source.card),
                      );
            if (existing) {
                existing.active = true;
                existing.source = candidate.source;
                existing.ability = candidate.ability;
                existing.affected = candidate.affected;
                matched.add(existing);
            } else {
                if (candidate.listener) this.installed.set(candidate.listener, this.registry.length);
                this.registry.push({
                    ...candidate,
                    active: true,
                    uses: 0,
                    occurrences: 0,
                    remaining: candidate.listener?.uses,
                });
            }
        }
    }

    private legalActions(): PlayerAction[] {
        this.registerRules();
        return getLegalActions(
            this.state,
            { card: this.lookup },
            {
                inked: this.inked,
                usedAbilities: this.usedAbilities,
                history: this.events,
                grantedRules: this.registry.flatMap((entry, rule) => (entry.active && entry.grant ? [{ ...entry, rule, uses: entry.uses }] : [])),
            },
            this.rules(),
        );
    }

    private emit(event: TurnEvent, before: GameState): void {
        if ((event.event === "Deal Damage" || event.event === "Put Damage") && event.amount > 0 && event.source && event.kind) {
            this.damageSources.set(`${event.card.fullName}|${event.card.i}`, {
                source: event.source,
                kind: event.kind,
            });
        }
        const previouslyActive = this.registry.map((rule) => rule.active);
        this.registerRules();
        const index = this.events.length;
        this.events.push(
            freeze({
                event,
                before,
                after: this.state,
                ...(this.challenge ? { challenge: this.challenge } : {}),
                ...(this.readying ? { readying: true } : {}),
            }),
        );
        // Queries that never read the turn's history are still exact with one more event.
        if (this.cachedRules?.readsTurn) this.cachedRules = undefined;
        const departure = event.event === "Leave Play" || event.event === "Banish";
        // One query view per position for the whole event, shared by every listening rule.
        let earlier: Rules | undefined;
        const matching = departure
            ? new Rules(before, this.lookup, { readying: this.readying, challenge: this.challenge, history: this.events, usedAbilities: this.usedAbilities })
            : this.rules();
        for (const [rule, entry] of this.registry.entries()) {
            if (entry.ability.type !== "Triggered") continue;
            if (!entry.active && !previouslyActive[rule]) {
                // A rule that just left with its card can still see the event it left by.
                const oldLocation = (earlier ??= new Rules(before, this.lookup)).locate(entry.source.card);
                const wasPresent =
                    oldLocation &&
                    (entry.ability.from ?? PLAY_ONLY).includes(oldLocation.zone) &&
                    !this.registry
                        .slice(rule + 1)
                        .some(
                            (other) =>
                                other.slot === entry.slot &&
                                other.grant === entry.grant &&
                                other.shield === entry.shield &&
                                sameCard(other.source.card, entry.source.card) &&
                                other.source.player === entry.source.player,
                        );
                if (!wasPresent) continue;
            }
            const scope: Scope = {
                source: entry.source,
                selected: [],
                parent: [],
                results: {},
                event,
                before,
                history: this.events,
                support: entry.support,
                affected: entry.affected,
            };
            if (!matching.matchesEvent(entry.ability.trigger, event, scope)) continue;
            // A batch trigger fires once for cards moved together: it waits in the bag until they have all moved.
            if ("batch" in entry.ability.trigger && entry.ability.trigger.batch && this.bag.some((item) => item.rule === rule)) continue;
            entry.occurrences++;
            const limit = entry.ability.limit;
            if (limit && (limit.count === "Occurrences" ? entry.occurrences > limit.perTurn : entry.uses >= limit.perTurn)) continue;
            this.bag.push({
                rule,
                scope,
                trigger: {
                    reference: { rule, event: index },
                    player: entry.source.player,
                    source: entry.source,
                    effect: entry.ability.effect,
                },
            });
        }
    }

    /** Replacements operate on proposed events. Replaced events never reach the bag. */
    private *replace(proposed: TurnEvent): Generator<InputRequest, TurnEvent | undefined, TurnStep> {
        const before = this.state;
        let event = proposed;
        const considered = new Set<number>();
        const applied = new Set<string>();
        const allowed = new Set<number>();
        const seen = new Set<number>();
        while (true) {
            this.registerRules();
            const options = this.registry.flatMap((entry, reference) => {
                if (!entry.active || entry.ability.type !== "Replacement" || considered.has(reference)) return [];
                const replacement = entry.ability.replacement;
                if (applied.has(JSON.stringify(replacement))) return [];
                const scope: Scope = {
                    source: entry.source,
                    selected: [],
                    parent: [],
                    results: {},
                    event,
                    before,
                    history: this.events,
                };
                if (!this.rules().matchesEvent(replacement.event, event, scope)) return [];
                if (!seen.has(reference)) {
                    seen.add(reference);
                    entry.occurrences++;
                    if (!replacement.limit || entry.occurrences <= replacement.limit.perTurn) allowed.add(reference);
                }
                return allowed.has(reference)
                    ? [
                          {
                              reference,
                              player: entry.source.player,
                              source: entry.source,
                              replacement,
                              scope,
                          },
                      ]
                    : [];
            });
            if (!options.length) return event;
            const decider = "card" in event ? (this.rules().locate(event.card)?.player ?? event.player) : event.player;
            if (typeof decider !== "number") throw new Error("Collective replacement ordering is not defined");
            const player = decider;
            let option = options[0];
            if (options.length > 1) {
                const answer = yield* this.answer({
                    type: "Choose Replacement",
                    player,
                    options: options.map(({ reference, player, source, replacement }) => ({ reference, player, source, replacement })),
                });
                const selected = options.find((option) => option.reference === answer.replacement);
                if (!selected) throw new Error("Validated replacement is missing");
                option = selected;
            }
            considered.add(option.reference);
            if (option.replacement.optional) {
                const answer = yield* this.answer({
                    type: "Optional",
                    player,
                    effect: option.replacement.instead ?? { type: "Sequence", effects: [] },
                });
                if (!answer.accept) continue;
            }
            const shield = this.registry[option.reference].shield;
            if (shield)
                this.updateCard(option.source.card, (card) => ({
                    modifiers: card.modifiers?.filter((modifier) => modifier !== shield),
                }));
            applied.add(JSON.stringify(option.replacement));
            if (option.replacement.damage) {
                if (event.event !== "Deal Damage") throw new Error("Damage replacement matched a non-damage event");
                event = {
                    ...event,
                    amount: this.amount(option.replacement.damage.amount, option.scope),
                };
                continue;
            }
            if (option.replacement.instead) yield* this.execute(option.replacement.instead, option.scope);
            return undefined;
        }
    }

    private *drain(): Generator<InputRequest, void, TurnStep> {
        while (this.generated.length && !this.ended && !winners(this.rules()).length) {
            const action = this.generated.shift();
            if (!action) throw new Error("Missing generated action");
            yield* this.execute(action.effect, action.scope ?? scopeFor(action.source));
            yield* this.cleanup();
            if (!action.retain) {
                if (this.rules().locate(action.source.card)?.zone === "Play")
                    this.moveCard(action.source.card, action.afterwards ? "Deck" : "Discard", {
                        position: action.afterwards ? "Bottom" : undefined,
                    });
                this.generatedSources.splice(this.generatedSources.indexOf(action.source), 1);
            }
        }
        while (this.bag.length && !this.ended && !winners(this.rules()).length) {
            const seats = this.turnOrder(),
                first = this.bagPlayer === undefined ? 0 : seats.indexOf(this.bagPlayer);
            const order = [...seats.slice(first), ...seats.slice(0, first)];
            const player = order.find((player) => this.bag.some((item) => item.trigger.player === player));
            if (!player) throw new Error("Trigger has no deciding player");
            const options = this.bag.filter((item) => item.trigger.player === player);
            let pending = options[0];
            if (options.length > 1) {
                const answer = yield* this.answer({
                    type: "Choose Trigger",
                    player,
                    options: options.map((item) => item.trigger),
                });
                const found = options.find(
                    (item) => item.trigger.reference.rule === answer.trigger.rule && item.trigger.reference.event === answer.trigger.event,
                );
                if (!found) throw new Error("Accepted trigger is missing");
                pending = found;
            }
            this.bag.splice(this.bag.indexOf(pending), 1);
            this.bagPlayer = player;
            const entry = this.registry[pending.rule];
            if (entry.ability.type !== "Triggered") throw new Error("Trigger refers to a non-triggered rule");
            if (
                entry.vanish &&
                this.events
                    .slice(pending.trigger.reference.event + 1)
                    .some(({ event }) => event.event === "Move Card" && event.from === "Play" && sameCard(event.card, entry.source.card))
            )
                continue;
            if (entry.remaining === 0) continue;
            if (entry.ability.limit?.count === "Uses" && entry.uses >= entry.ability.limit.perTurn) continue;
            const result = yield* this.execute(pending.trigger.effect, pending.scope);
            if (pending.trigger.effect.type !== "Optional" || result.accepted) entry.uses++;
            if (entry.remaining !== undefined) {
                entry.remaining--;
                const installed = [...this.installed].find(([, rule]) => rule === pending.rule);
                if (installed) {
                    const [modifier] = installed;
                    this.installed.delete(modifier);
                    for (const player of this.players())
                        if (this.player(player).modifiers?.includes(modifier)) {
                            const remaining = { ...modifier, uses: entry.remaining };
                            this.updatePlayer(player, (p) => ({
                                modifiers: p.modifiers?.flatMap((item) => (item !== modifier ? [item] : entry.remaining ? [remaining] : [])),
                            }));
                            if (entry.remaining) this.installed.set(remaining, pending.rule);
                        }
                    for (const player of this.players())
                        for (const state of this.player(player).play)
                            if (state.modifiers?.includes(modifier)) {
                                const remaining = { ...modifier, uses: entry.remaining };
                                this.updateCard(state.card, (card) => ({
                                    modifiers: card.modifiers?.flatMap((item) => (item !== modifier ? [item] : entry.remaining ? [remaining] : [])),
                                }));
                                if (entry.remaining) this.installed.set(remaining, pending.rule);
                            }
                    if (!entry.remaining) entry.active = false;
                }
            }
            yield* this.cleanup();
            if (this.generated.length) yield* this.drain();
        }
        if (!this.bag.length) this.bagPlayer = undefined;
    }

    constructor(
        state: GameState,
        private readonly options: EngineOptions = {},
    ) {
        this.state = immutable(state);
        this.lookup = catalogLookup(options.card);
    }

    /** A change that keeps every field leaves the position, and every query cached for it, as it was. */
    private updatePlayer(number: PlayerNumber, change: (current: PlayerPosition) => Partial<PlayerPosition>): void {
        const current = this.player(number);
        const changes = change(current);
        let changed = false;
        for (const key in changes)
            if (changes[key as keyof PlayerPosition] !== current[key as keyof PlayerPosition]) {
                changed = true;
                break;
            }
        if (!changed) return;
        this.state = freeze({
            ...this.state,
            players: { ...this.state.players, [number]: { ...current, ...changes } },
        });
    }

    private updateCard(card: CardIdentifier, change: (current: CardState) => Partial<CardState>): void {
        const number = this.holder(card);
        this.updatePlayer(number, (current) => ({
            play: current.play.map((state) => (sameCard(state.card, card) ? { ...state, ...change(state) } : state)),
        }));
    }

    private definition(card: CardIdentifier): Card {
        const definition = this.lookup(card.fullName);
        if (!definition) throw new Error(`Unknown card: ${card.fullName}`);
        return definition;
    }

    private player(number: PlayerNumber): PlayerPosition {
        const player = this.state.players[number];
        if (!player) throw new Error(`Unknown player: ${number}`);
        return player;
    }

    private players(): readonly PlayerNumber[] {
        return this.rules().players();
    }

    private turnOrder(): PlayerNumber[] {
        const players = this.players(),
            first = players.indexOf(this.state.turn.player);
        return [...players.slice(first), ...players.slice(0, first)];
    }

    private holder(card: CardIdentifier): PlayerNumber {
        if (this.resolving && sameCard(this.resolving.card, card)) return this.resolving.player;
        const generated = this.generatedSources.find((source) => sameCard(source.card, card));
        if (generated) return generated.player;
        const located = this.rules().locate(card);
        if (located) return located.player;
        for (const number of this.players()) if (this.player(number).removed?.some((other) => sameCard(other, card))) return number;
        throw new Error(`Card is not in the game: ${card.fullName}:${card.i}`);
    }

    private inPlay(card: CardIdentifier): CardState {
        const found = this.player(this.holder(card)).play.find((c) => sameCard(c.card, card));
        if (!found) throw new Error(`Card is not in play: ${card.fullName}`);
        return found;
    }

    private selectPlayers(selection: PlayerSelection, scope: Scope): PlayerNumber[] {
        const order = this.turnOrder();
        return this.rules()
            .selectPlayers(selection, {
                ...scope,
                numbers: scope.results,
                groups: scope.results.groups,
            })
            .sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }

    private cards(selection: CardSelection, scope: Scope): CardIdentifier[] {
        return this.rules().cards(selection, {
            ...scope,
            numbers: scope.results,
            groups: scope.results.groups,
        });
    }

    private amount(amount: Amount, scope: Scope): number {
        return this.rules().amount(amount, {
            ...scope,
            numbers: scope.results,
            groups: scope.results.groups,
        });
    }

    private *answer<D extends Decision>(decision: D, validate?: (answer: AnswerFor<D>) => void): Generator<InputRequest, AnswerFor<D>, TurnStep> {
        const step = yield {
            request: decision,
            validate: validate ? (answer) => validate(answer as AnswerFor<D>) : undefined,
        };
        if (step.type !== "Decision") throw new Error("Expected a decision answer");
        // Resolution checks the discriminant and constraints before resuming us.
        return step.answer as AnswerFor<D>;
    }

    private decider(selection: PlayerSelection, scope: Scope): DecisionPlayer {
        const players = this.selectPlayers(selection, scope),
            first = players[0];
        if (first === undefined) throw new Error("Decision has no player");
        if (typeof selection === "object" && "together" in selection) return { together: [first, ...players.slice(1)] };
        if (players.length !== 1) throw new Error("Decision requires one player or an explicit collective decider");
        return first;
    }

    /** Starts synchronous resolution and stops at the first input request. */
    startAction(action: PlayerAction): Resolution {
        assertSupportedBoard(this.rules());
        this.registerRules();
        const owned = immutable(action);
        return new Resolution(
            this.finish(this.play(owned)),
            freeze([{ type: "Action", action: owned }]),
            () => this.state,
            () => this.outcome(),
            () => this.rules(),
            () => this.observations,
        );
    }

    startTurn(): Resolution {
        assertSupportedBoard(this.rules());
        this.registerRules();
        return new Resolution(
            this.turn(),
            [],
            () => this.state,
            () => this.outcome(),
            () => this.rules(),
            () => this.observations,
            () => this.branch(),
        );
    }

    /**
     * An independent continuation of this turn from the current intention, with the
     * turn's history, usage limits and registered rules. Nothing is pending between
     * intentions, so this is the complete turn context.
     */
    private branch(): Resolution | undefined {
        if (!this.intention) return undefined;
        const copy = new Evaluator(this.state, this.options);
        copy.inked = this.inked;
        copy.events.push(...this.events);
        copy.usedAbilities.push(...this.usedAbilities.map((use) => ({ ...use })));
        copy.registry.push(...this.registry.map((entry) => ({ ...entry })));
        copy.generatedSources.push(...this.generatedSources);
        for (const [key, value] of this.damageSources) copy.damageSources.set(key, value);
        for (const [key, value] of this.installed) copy.installed.set(key, value);
        copy.offered = this.offered;
        // The position was checked, its rules registered and its actions listed when this intention was requested.
        return copy.intentions();
    }

    /** Requests the turn player's next intention without start processing or earlier turn history. */
    continueTurn(): Resolution {
        assertSupportedBoard(this.rules());
        if (winners(this.rules()).length) throw new InvalidInput("The game has already ended");
        this.registerRules();
        return this.intentions();
    }

    private intentions(): Resolution {
        return new Resolution(
            this.actions(this.state.turn.player),
            [],
            () => this.state,
            () => this.outcome(),
            () => this.rules(),
            () => this.observations,
            () => this.branch(),
        );
    }

    startGame(): Resolution {
        return new Resolution(
            this.setup(),
            [],
            () => this.state,
            undefined,
            () => this.rules(),
        );
    }

    /** Setup has no active abilities. Shuffles and hand alterations are ordinary recorded inputs. */
    private *setup(): Generator<InputRequest, GameState, TurnStep> {
        const players = this.players(),
            first = players.indexOf(this.state.turn.player);
        if (first < 0 || players.length < 2 || this.state.turn.number !== 1) throw new InvalidInput("Setup needs an initial position and a starting player");
        const order = [...players.slice(first), ...players.slice(0, first)];
        const identities = new Set<string>();
        for (const number of order) {
            const p = this.player(number);
            if (
                p.turnsTaken ||
                p.lore ||
                p.hand.length ||
                p.play.length ||
                p.inkwell.length ||
                p.discard.length ||
                p.removed?.length ||
                p.modifiers?.length ||
                p.inkDrops ||
                p.deck.length < 7
            ) {
                throw new InvalidInput("Setup requires decks of at least seven cards and otherwise empty player positions");
            }
            for (const card of p.deck) {
                this.definition(card);
                const key = `${card.fullName}|${card.i}`;
                if (identities.has(key)) throw new InvalidInput("A physical card appears more than once");
                identities.add(key);
            }
        }
        for (const number of order) {
            const step = yield { request: { type: "Shuffle", cards: this.player(number).deck } };
            if (step.type !== "Random" || step.outcome.type !== "Shuffle") throw new Error("Expected the validated setup shuffle");
            this.updatePlayer(number, () => ({
                deck: step.outcome.cards.slice(7),
                hand: step.outcome.cards.slice(0, 7),
            }));
        }
        const altered: PlayerNumber[] = [];
        for (const number of order) {
            const hand = this.player(number).hand;
            const actions: PlayerAction[] = [];
            const subsets = (index: number, cards: CardIdentifier[]): void => {
                if (index === hand.length) {
                    actions.push({ type: "Alter Hand", player: number, cards });
                    return;
                }
                subsets(index + 1, cards);
                subsets(index + 1, [...cards, hand[index]]);
            };
            subsets(0, []);
            const step = yield { request: { type: "Action", player: number, actions } };
            if (step.type !== "Action" || step.action.type !== "Alter Hand") throw new Error("Expected the validated hand alteration");
            const selected = step.action.cards;
            if (!selected.length) continue;
            altered.push(number);
            this.updatePlayer(number, (p) => {
                const deck = [...p.deck, ...selected],
                    kept = p.hand.filter((card) => !selected.some((other) => sameCard(other, card)));
                const count = 7 - kept.length;
                return { deck: deck.slice(count), hand: [...kept, ...deck.slice(0, count)] };
            });
        }
        for (const number of altered) {
            const step = yield { request: { type: "Shuffle", cards: this.player(number).deck } };
            if (step.type !== "Random" || step.outcome.type !== "Shuffle") throw new Error("Expected the validated alteration shuffle");
            this.updatePlayer(number, () => ({ deck: step.outcome.cards }));
        }
        return this.state;
    }

    private boundary(kind: "Start" | "End" | "Challenge"): void {
        const turn = this.state.turn;
        const expires = (expiry: EffectExpiry): boolean => {
            if ("endOfTurn" in expiry) return kind === "End" && expiry.endOfTurn <= turn.number;
            if ("startOfNextTurn" in expiry) return kind === "Start" && expiry.startOfNextTurn === turn.player && expiry.afterTurn < turn.number;
            if ("endOfNextTurn" in expiry) return kind === "End" && expiry.endOfNextTurn === turn.player && expiry.afterTurn < turn.number;
            if ("anyOf" in expiry) return expiry.anyOf.some(expires);
            if ("endOfChallenge" in expiry) return kind === "Challenge";
            return false;
        };
        for (const number of this.players())
            this.updatePlayer(number, (p) => {
                const active = <
                    T extends {
                        starts?: { startOfNextTurn: PlayerNumber; afterTurn: number };
                        expires?: EffectExpiry;
                    },
                >(
                    modifiers: T[],
                ): T[] =>
                    mapKept(
                        filterKept(modifiers, (m) => !m.expires || !expires(m.expires)),
                        (m) => {
                            if (kind !== "Start" || !m.starts || m.starts.startOfNextTurn !== turn.player || m.starts.afterTurn >= turn.number) return m;
                            const { starts, ...rest } = m;
                            return rest as T;
                        },
                    );
                return {
                    modifiers: p.modifiers && active(p.modifiers),
                    play: mapKept(p.play, (card) => {
                        const modifiers = card.modifiers && active(card.modifiers);
                        return modifiers === card.modifiers ? card : { ...card, modifiers };
                    }),
                };
            });
    }

    private *turn(): Generator<InputRequest, GameState, TurnStep> {
        if (winners(this.rules()).length) throw new InvalidInput("The game has already ended");
        const number = this.state.turn.player;
        this.readying = true;
        this.cachedRules = undefined;
        const eligible = this.player(number)
            .play.filter(
                (card) =>
                    this.definition(card.card).type !== "Location" &&
                    card.exerted &&
                    !this.rules().restricted(card.card, "Can't Ready") &&
                    !this.rules().restricted(card.card, "Can't Ready At Start Of Turn"),
            )
            .map((card) => card.card);
        const limits = this.rules()
            .playerChanges(number)
            .flatMap((change) => ("readyLimit" in change ? [change.readyLimit] : []));
        const count = Math.min(eligible.length, ...limits);
        const readied =
            count < eligible.length
                ? (yield* this.answer({
                      type: "Choose Cards",
                      player: number,
                      cards: eligible,
                      min: count,
                      max: count,
                  })).cards
                : eligible;
        const beforeReady = this.state;
        const readiedInk = this.player(number)
            .inkwell.filter((card) => card.exerted)
            .map((card) => card.card);
        this.updatePlayer(number, (p) => ({
            inkwell: mapKept(p.inkwell, (card) => (card.exerted ? { ...card, exerted: false } : card)),
            play: mapKept(p.play, (card) => (readied.some((other) => sameCard(other, card.card)) ? { ...card, exerted: false } : card)),
        }));
        for (const card of [...readied, ...readiedInk]) this.emit({ event: "Ready", player: number, card }, beforeReady);
        this.readying = false;
        this.cachedRules = undefined;
        this.boundary("Start");
        this.emit({ event: "Turn Start", player: number }, this.state);
        yield* this.cleanup();
        if (this.ended) return this.state;
        // The Set step dries characters and grants location lore before the bag resolves.
        this.updatePlayer(number, (p) => ({
            play: mapKept(p.play, (card) => (card.drying === false ? card : { ...card, drying: false })),
        }));
        const locationLore = this.rules()
            .playerChanges(number)
            .some((change) => "restriction" in change && change.restriction === "Can't Gain Lore")
            ? 0
            : this.player(number).play.reduce(
                  (sum, card) => (this.definition(card.card).type === "Location" ? sum + this.rules().characteristic(card.card, "Lore") : sum),
                  0,
              );
        if (locationLore) {
            const before = this.state;
            this.updatePlayer(number, (p) => ({ lore: p.lore + locationLore }));
            this.emit({ event: "Gain Lore", player: number, amount: locationLore }, before);
        }
        yield* this.cleanup();
        yield* this.drain();
        if (this.ended) return this.state;
        // Only the first player skips their first normal draw.
        if (!(this.state.turn.number === 1 && this.player(number).turnsTaken === 0)) {
            const p = this.player(number);
            if (
                !this.rules()
                    .playerChanges(number)
                    .some((m) => "skipDrawStep" in m)
            ) {
                const before = this.state,
                    card = p.deck[0];
                if (card) {
                    this.updatePlayer(number, (current) => ({
                        deck: current.deck.slice(1),
                        hand: [...current.hand, card],
                    }));
                    this.emit({ event: "Draw", player: number, card }, before);
                    this.emit({ event: "Move Card", player: number, card, from: "Deck", to: "Hand" }, before);
                }
            }
        }
        yield* this.cleanup();
        yield* this.drain();
        return yield* this.actions(number);
    }

    /** Requests intentions from the turn player until the turn ends or the game is decided. */
    private *actions(number: PlayerNumber): Generator<InputRequest, GameState, TurnStep> {
        while (!this.ended && !winners(this.rules()).length) {
            this.offered ??= this.legalActions();
            this.intention = true;
            const step = yield {
                request: { type: "Action", player: number, actions: this.offered },
            };
            this.intention = false;
            this.offered = undefined;
            if (step.type !== "Action") throw new Error("Expected an action");
            if (step.action.type === "End Turn") {
                this.emit({ event: "Turn End", player: number }, this.state);
                yield* this.drain();
                if (this.ended || winners(this.rules()).length) return this.state;
                this.boundary("End");
                yield* this.cleanup();
                yield* this.drain();
                if (this.ended) return this.state;
                if (!this.player(number).deck.length) {
                    if (this.players().length <= 2) {
                        this.ended = true;
                        this.deckedOut = number;
                    } else {
                        const players = this.players(),
                            next = players[(players.indexOf(number) + 1) % players.length];
                        this.leaveGame(number);
                        this.state = freeze({
                            ...this.state,
                            turn: { number: this.state.turn.number + 1, player: next },
                        });
                        yield* this.cleanup();
                    }
                    return this.state;
                }
                this.updatePlayer(number, (p) => ({ turnsTaken: p.turnsTaken + 1 }));
                const players = this.players();
                this.state = freeze({
                    ...this.state,
                    turn: {
                        number: this.state.turn.number + 1,
                        player: players[(players.indexOf(number) + 1) % players.length],
                    },
                });
                return this.state;
            }
            // Resolution has already checked the action against this request's legal actions.
            yield* this.play(step.action, true);
            yield* this.cleanup();
            yield* this.drain();
        }
        return this.state;
    }

    /** Isolates a parsed effect without adapting the engine to legacy test state. */
    startEffect(effect: Effect, source: EffectSource): Resolution {
        assertSupportedBoard(this.rules());
        this.registerRules();
        return new Resolution(
            this.finish(this.execute(immutable(effect), scopeFor(immutable(source)))),
            [],
            () => this.state,
            () => this.outcome(),
            () => this.rules(),
            () => this.observations,
        );
    }

    private *finish(work: Generator<InputRequest, unknown, TurnStep>): Generator<InputRequest, GameState, TurnStep> {
        yield* work;
        yield* this.cleanup();
        yield* this.drain();
        return this.state;
    }

    private *shift(action: Extract<PlayerAction, { type: "Shift" }>, free = false): Generator<InputRequest, void, TurnStep> {
        const ability = action.ability !== undefined ? this.definition(action.card).abilities?.[action.ability] : this.registry[action.rule].ability;
        if (ability?.type !== "Keyword" || ability.keyword.name !== "Shift") throw new Error("Missing Shift ability");
        const scope: Scope = {
            source: { card: action.card, player: action.player, kind: "Ability" },
            selected: action.onto,
            parent: [],
            results: {},
        };
        assertSupportedDefinition(this.definition(action.card));
        let inkPaid = 0;
        if (!free) {
            const alternate = action.alternateCost
                ? this.rules()
                      .alternateCosts(action.card, "Shift", action.onto[0])
                      .find(
                          (entry) =>
                              entry.origin &&
                              sameCard(entry.origin.card, action.alternateCost?.card ?? action.card) &&
                              entry.origin.i === action.alternateCost?.i,
                      )
                : undefined;
            if (action.alternateCost && !alternate) throw new Error("Validated alternate Shift cost is missing");
            const costs = alternate?.rule.cost ?? ability.keyword.cost;
            const paymentScope: Scope = alternate ? { ...alternate.scope, results: {} } : scope;
            const baseInk = costs.reduce((sum, cost) => sum + (cost.type === "Ink" ? this.amount(cost.amount, paymentScope) : 0), 0);
            const quote = yield* this.quotePlay(action.card, action.player, baseInk, action.onto);
            inkPaid = quote.amount;
            yield* this.payCosts(
                action.player,
                [...costs.filter((cost) => cost.type !== "Ink"), ...(inkPaid ? [{ type: "Ink" as const, amount: inkPaid }] : [])],
                paymentScope,
            );
            this.consumePrice(quote.entries);
        } else this.consumePrice([...this.rules().costChanges(action.card, "Play"), ...this.rules().costChanges(action.card, "Shift", false, action.onto)]);
        const before = this.state,
            origin = this.rules().locate(action.card),
            bases = action.onto.map((card) => this.inPlay(card));
        if (!origin || origin.zone === "Play") throw new Error("Shift card must come from outside play");
        const locations = bases
            .flatMap((base) => (base.location ? [base.location] : []))
            .filter((card, i, cards) => cards.findIndex((other) => sameCard(other, card)) === i);
        const location =
            locations.length > 1
                ? (yield* this.answer({
                      type: "Choose Cards",
                      player: action.player,
                      cards: locations,
                      min: 1,
                      max: 1,
                  })).cards[0]
                : locations[0];
        const top: CardState = {
            card: action.card,
            damage: bases.reduce((sum, base) => sum + (base.damage ?? 0), 0),
            drying: bases.some((base) => base.drying),
            exerted: bases.some((base) => base.exerted),
            location,
            modifiers: bases.flatMap((base) => base.modifiers ?? []),
            under: bases.flatMap((base) => [
                {
                    card: base.card,
                    faceDown: false,
                    ...(base.owner !== undefined ? { owner: base.owner } : {}),
                },
                ...(base.under ?? []),
            ]),
        };
        const insertion = this.player(action.player).play.find((state) => action.onto.some((card) => sameCard(state.card, card)))?.card;
        this.updatePlayer(origin.player, (p) => {
            if (origin.zone === "Hand") return { hand: p.hand.filter((card) => !sameCard(card, action.card)) };
            if (origin.zone === "Discard") return { discard: p.discard.filter((card) => !sameCard(card, action.card)) };
            if (origin.zone === "Deck") return { deck: p.deck.filter((card) => !sameCard(card, action.card)) };
            if (origin.zone === "Inkwell") return { inkwell: p.inkwell.filter((entry) => !sameCard(entry.card, action.card)) };
            return {
                play: p.play.map((state) => ({
                    ...state,
                    under: state.under?.filter((entry) => !sameCard(entry.card, action.card)),
                })),
            };
        });
        this.updatePlayer(action.player, (p) => ({
            play: p.play.flatMap((state) => {
                if (!action.onto.some((card) => sameCard(state.card, card))) return [state];
                return insertion && sameCard(state.card, insertion) ? [top] : [];
            }),
        }));
        this.inheritTargets(action.onto, action.card);
        yield* this.arrive(action.card, action.player, Boolean(top.exerted));
        for (const base of bases)
            this.emit(
                {
                    event: "Move Card",
                    player: action.player,
                    card: base.card,
                    from: "Play",
                    to: "Under",
                },
                before,
            );
        this.emit(
            {
                event: "Move Card",
                player: action.player,
                card: action.card,
                from: origin.zone,
                to: "Play",
            },
            before,
        );
        this.emit(
            {
                event: "Play",
                player: action.player,
                card: action.card,
                inkPaid,
                method: "Shift",
                onto: action.onto,
            },
            before,
        );
        this.emit({ event: "Shift", player: action.player, card: action.card, onto: action.onto }, before);
        if (ability.keyword.afterShift) yield* this.execute(ability.keyword.afterShift, scope);
    }

    private *play(action: PlayerAction, offered = false): Generator<InputRequest, void, TurnStep> {
        if (action.player !== this.state.turn.player) throw new InvalidInput("It is not this player's turn");
        if (winners(this.rules()).length || this.ended) throw new InvalidInput("The game has already ended");
        if (action.type === "Play" && !action.alternateCost && this.rules().availableInk(action.player) < this.rules().cost(action.card, true)) {
            throw new InvalidInput("Not enough ready ink");
        }
        if (!offered) assertRequestedInput({ type: "Action", player: action.player, actions: this.legalActions() }, { type: "Action", action });
        if (action.type === "Shift") {
            yield* this.shift(action);
            return;
        }
        if (action.type === "Boost") return yield* this.boostAction(action);
        if (action.type === "Activate") return yield* this.activateAction(action);
        if (action.type === "Ink") return yield* this.inkAction(action);
        if (action.type === "Quest") return yield* this.questAction(action);
        if (action.type === "Challenge") return yield* this.challengeAction(action);
        if (action.type === "Move") return yield* this.moveAction(action);
        if (action.type === "End Turn") throw new Error("End Turn requires startTurn, not startAction");
        if (action.type !== "Play" && action.type !== "Sing") throw new Error(`Unsupported action: ${action.type}`);
        yield* this.playCard(action);
    }

    private *boostAction(action: Extract<PlayerAction, { type: "Boost" }>): Generator<InputRequest, void, TurnStep> {
        const occurrence = action.rule !== undefined ? this.registry[action.rule] : undefined;
        const ability = occurrence?.ability ?? (action.ability !== undefined ? this.definition(action.card).abilities?.[action.ability] : undefined);
        if (ability?.type !== "Keyword" || ability.keyword.name !== "Boost") throw new Error("Missing Boost ability");
        const scope = scopeFor({ card: action.card, player: action.player, kind: "Ability" });
        yield* this.payCosts(action.player, this.rules().abilityCosts(ability.keyword.cost, action.free ?? false), scope);
        if (action.free) this.consumePrice(this.rules().freeAbilityEntries(action.card, "Boost").slice(0, 1));
        const before = this.state,
            card = this.player(action.player).deck[0];
        this.moveCard(card, "Under", { under: action.card, faceDown: true, actor: action.player });
        if (occurrence) occurrence.uses++;
        else if (action.ability !== undefined) this.usedAbilities.push({ card: action.card, ability: action.ability, uses: 1 });
        this.emit({ event: "Boost", player: action.player, card: action.card }, before);
        return;
    }

    private *activateAction(action: Extract<PlayerAction, { type: "Activate" }>): Generator<InputRequest, void, TurnStep> {
        const occurrence = "rule" in action ? this.registry[action.rule] : undefined;
        const card = "ability" in action ? action.ability.card : action.card;
        const ability = occurrence?.ability ?? ("ability" in action ? this.definition(card).abilities?.[action.ability.i] : undefined);
        if (!ability || ability.type !== "Activated") throw new Error("Missing activated ability");
        const scope = scopeFor({ card, player: this.holder(card), kind: "Ability" });
        const together = ability.by && typeof ability.by === "object" && "together" in ability.by ? this.selectPlayers(ability.by, scope) : undefined;
        const first = together?.[0];
        scope.results = yield* this.payCosts(
            first !== undefined && together ? [first, ...together.slice(1)] : action.player,
            this.rules().abilityCosts(ability.cost, action.free ?? false),
            scope,
        );
        if (action.free) this.consumePrice(this.rules().freeAbilityEntries(card, ability).slice(0, 1));
        if (occurrence) occurrence.uses++;
        else if ("ability" in action) {
            const used = this.usedAbilities.find((use) => sameCard(use.card, card) && use.ability === action.ability.i);
            if (used) used.uses++;
            else this.usedAbilities.push({ card, ability: action.ability.i, uses: 1 });
        }
        yield* this.execute(ability.effect, scope);
        yield* this.cleanup();
        return;
    }

    private *inkAction(action: Extract<PlayerAction, { type: "Ink" }>): Generator<InputRequest, void, TurnStep> {
        const exerted = this.rules().permissionExerts(action.card, action.player, "Ink");
        this.moveCard(action.card, "Inkwell", { exerted });
        this.inked++;
        return;
    }

    private *questAction(action: Extract<PlayerAction, { type: "Quest" }>): Generator<InputRequest, void, TurnStep> {
        const source: EffectSource = { card: action.card, player: action.player, kind: "Ability" };
        yield* this.payCosts(action.player, this.rules().additionalCosts(action.card, "Quest"), scopeFor(source));
        const before = this.state;
        const lore = this.rules().characteristic(action.card, "Lore");
        this.updateCard(action.card, () => ({ exerted: true }));
        const gained = this.rules()
            .playerChanges(action.player)
            .some((change) => "restriction" in change && change.restriction === "Can't Gain Lore")
            ? 0
            : lore;
        this.updatePlayer(action.player, (p) => ({ lore: p.lore + gained }));
        this.emit({ event: "Exert", card: action.card, player: action.player }, before);
        this.emit({ event: "Quest", card: action.card, player: action.player }, before);
        if (gained) this.emit({ event: "Gain Lore", player: action.player, amount: gained }, before);
        return;
    }

    private *challengeAction(action: Extract<PlayerAction, { type: "Challenge" }>): Generator<InputRequest, void, TurnStep> {
        const source: EffectSource = { card: action.attacker, player: action.player, kind: "Ability" };
        yield* this.payCosts(action.player, this.rules().additionalCosts(action.attacker, "Challenge"), scopeFor(source));
        this.challenge = { attacker: action.attacker, defender: action.defender };
        this.cachedRules = undefined;
        const declaration = this.state;
        this.updateCard(action.attacker, () => ({ exerted: true }));
        this.emit({ event: "Exert", card: action.attacker, player: action.player }, declaration);
        this.emit(
            {
                event: "Challenge",
                player: action.player,
                attacker: action.attacker,
                defender: action.defender,
            },
            declaration,
        );
        yield* this.cleanup();
        yield* this.drain();
        if (this.ended) return;
        if (this.rules().locate(action.attacker)?.zone !== "Play" || this.rules().locate(action.defender)?.zone !== "Play") {
            this.boundary("Challenge");
            this.challenge = undefined;
            this.cachedRules = undefined;
            this.emit(
                {
                    event: "After Challenge",
                    player: action.player,
                    attacker: action.attacker,
                    defender: action.defender,
                },
                this.state,
            );
            yield* this.drain();
            return;
        }
        const rules = this.rules();
        const attack = rules.challengeDamage(action.attacker);
        const target = this.definition(action.defender);
        const defend = target.type === "Character" ? rules.challengeDamage(action.defender) : 0;
        const before = this.state;
        const damageToAttacker = this.damageAmount(action.attacker, defend, action.defender, this.holder(action.defender));
        const damageToDefender = this.damageAmount(action.defender, attack, action.attacker, action.player);
        const defendingProposal: TurnEvent | undefined =
            defend > 0 && !rules.restricted(action.attacker, "Can't Be Dealt Damage", action.defender, this.holder(action.defender))
                ? {
                      event: "Deal Damage",
                      card: action.attacker,
                      player: this.holder(action.defender),
                      amount: damageToAttacker,
                      source: action.defender,
                      kind: "Challenge",
                  }
                : undefined;
        const attackingProposal: TurnEvent | undefined =
            attack > 0 && !rules.restricted(action.defender, "Can't Be Dealt Damage", action.attacker, action.player)
                ? {
                      event: "Deal Damage",
                      card: action.defender,
                      player: action.player,
                      amount: damageToDefender,
                      source: action.attacker,
                      kind: "Challenge",
                  }
                : undefined;
        this.damageBatch = { before, events: [] };
        const defendingEvent = damageToAttacker && defendingProposal ? yield* this.replace(defendingProposal) : defendingProposal;
        const attackingEvent = damageToDefender && attackingProposal ? yield* this.replace(attackingProposal) : attackingProposal;
        if (defendingEvent?.event === "Deal Damage") this.damageBatch.events.push(defendingEvent);
        if (attackingEvent?.event === "Deal Damage") this.damageBatch.events.push(attackingEvent);
        this.commitDamage();
        yield* this.cleanup();
        yield* this.drain();
        this.boundary("Challenge");
        this.challenge = undefined;
        this.cachedRules = undefined;
        this.emit(
            {
                event: "After Challenge",
                player: action.player,
                attacker: action.attacker,
                defender: action.defender,
            },
            before,
        );
        yield* this.drain();
        return;
    }

    private *moveAction(action: Extract<PlayerAction, { type: "Move" }>): Generator<InputRequest, void, TurnStep> {
        if (action.alternateCost) {
            const entry = this.rules()
                .alternateCosts(action.card, "Move", action.location)
                .find(
                    (entry) =>
                        entry.origin && sameCard(entry.origin.card, action.alternateCost?.card ?? action.card) && entry.origin.i === action.alternateCost?.i,
                );
            if (!entry) throw new Error("Validated alternate movement cost is missing");
            const scope: Scope = { ...entry.scope, results: {} };
            const base = entry.rule.cost.reduce((sum, cost) => sum + (cost.type === "Ink" ? this.amount(cost.amount, scope) : 0), 0);
            const quote = yield* this.quoteCost(action.player, base, this.rules().movementChanges(action.card, action.location, true));
            yield* this.payCosts(
                action.player,
                [...entry.rule.cost.filter((cost) => cost.type !== "Ink"), ...(quote.amount ? [{ type: "Ink" as const, amount: quote.amount }] : [])],
                scope,
            );
            this.consumePrice(quote.entries);
        }
        yield* this.moveToLocation(action.card, action.location, action.player, Boolean(action.alternateCost));
        return;
    }

    private *playCard(action: Extract<PlayerAction, { type: "Play" | "Sing" }>): Generator<InputRequest, void, TurnStep> {
        const card = action.type === "Play" ? action.card : action.song;
        if (!this.rules().permittedZone(card, action.player, "Play")) throw new InvalidInput("Played card is not in a permitted zone");
        const definition = this.definition(card);
        assertSupportedDefinition(definition);
        const alternate = action.type === "Play" && action.alternateCost;
        const rule = alternate && "playRule" in alternate ? definition.playRules?.[alternate.playRule] : undefined;
        const supplied =
            alternate && !("playRule" in alternate)
                ? this.rules()
                      .alternateCosts(card, "Play")
                      .find((entry) => entry.origin && sameCard(entry.origin.card, alternate.card) && entry.origin.i === alternate.i)
                : undefined;
        const alternateCosts = rule?.type === "Alternate Cost" ? rule.cost : supplied?.rule.cost;
        const paymentScope: Scope = supplied ? { ...supplied.scope, results: {} } : scopeFor({ card, player: action.player, kind: "Ability" });
        const baseInk = alternateCosts
            ? alternateCosts.reduce((sum, cost) => sum + (cost.type === "Ink" ? this.amount(cost.amount, paymentScope) : 0), 0)
            : definition.cost;
        const quote = action.type === "Play" ? yield* this.quotePlay(card, action.player, baseInk) : undefined;
        const inkPaid = quote?.amount ?? 0;
        if (action.type === "Sing") {
            const before = this.state;
            for (const singer of action.singers) this.updateCard(singer, () => ({ exerted: true }));
            for (const singer of action.singers) this.emit({ event: "Exert", player: action.player, card: singer }, before);
        } else if (alternateCosts)
            yield* this.payCosts(
                action.player,
                [...alternateCosts.filter((cost) => cost.type !== "Ink"), ...(inkPaid ? [{ type: "Ink" as const, amount: inkPaid }] : [])],
                paymentScope,
            );
        else yield* this.payInk(action.player, inkPaid);
        this.consumePrice(quote?.entries ?? this.rules().costChanges(card, "Play"));
        const before = this.state;
        const exerted = this.rules().permissionExerts(card, action.player, "Play");
        this.moveCard(card, "Play", { player: action.player, exerted });
        if (definition.type !== "Action") {
            yield* this.arrive(card, action.player, exerted);
            this.emit({ event: "Play", card, player: action.player, inkPaid }, before);
            return;
        }
        this.resolving = { card, player: action.player, kind: "Action" };
        const playEvent: TurnEvent =
            action.type === "Sing"
                ? {
                      event: "Play",
                      card,
                      player: action.player,
                      inkPaid: 0,
                      method: action.singers.length > 1 || definition.playRules?.some((rule) => rule.type === "Sing Together") ? "Sing Together" : "Sing",
                      singers: action.singers,
                  }
                : { event: "Play", card, player: action.player, inkPaid };
        this.emit(playEvent, before);
        if (action.type === "Sing") this.emit({ event: "Sing", player: action.player, song: card, singers: action.singers }, before);
        yield* this.execute(definition.effect, {
            source: this.resolving,
            selected: [],
            parent: [],
            results: {},
            event: playEvent,
            before,
        });
        yield* this.cleanup();
        if (this.rules().locate(card)?.zone === "Play") this.moveCard(card, "Discard");
        this.resolving = undefined;
    }

    private *payInk(player: PlayerNumber, amount: number): Generator<InputRequest, void, TurnStep> {
        const p = this.player(player);
        const source = p.hand[0] ?? p.play[0]?.card ?? p.inkwell[0]?.card;
        if (!source && amount) throw new InvalidInput("No payment source");
        if (!amount || !source) return;
        yield* this.payCosts(player, [{ type: "Ink", amount }], scopeFor({ card: source, player, kind: "Ability" }));
    }

    private *quotePlay(
        card: CardIdentifier,
        player: PlayerNumber,
        base = this.definition(card).cost,
        onto?: CardIdentifier[],
    ): Generator<InputRequest, { amount: number; entries: ReturnType<Rules["costChanges"]> }, TurnStep> {
        const rules = this.rules();
        const available = [...rules.costChanges(card, "Play", true), ...(onto ? rules.costChanges(card, "Shift", true, onto) : [])];
        return yield* this.quoteCost(player, base, available);
    }

    private *quoteCost(
        player: PlayerNumber,
        base: number,
        available: ReturnType<Rules["costChanges"]>,
    ): Generator<InputRequest, { amount: number; entries: ReturnType<Rules["costChanges"]> }, TurnStep> {
        const rules = this.rules();
        const entries = available.filter((entry) => !entry.rule.optional);
        let amount = base + entries.reduce((sum, entry) => sum + rules.amount(entry.rule.amount, entry.scope), 0);
        const optional = available.filter((entry) => entry.rule.optional);
        const ink = this.rules().availableInk(player);
        for (const [i, entry] of optional.entries()) {
            const change = rules.amount(entry.rule.amount, entry.scope);
            const remaining = optional.slice(i + 1).reduce((sum, next) => sum + Math.min(0, rules.amount(next.rule.amount, next.scope)), 0);
            // Declining is no choice when the price would then be unpayable, and players cannot see that in the request.
            if (change < 0 && Math.max(0, amount + remaining) > ink && Math.max(0, amount + change + remaining) <= ink) {
                amount += change;
                entries.push(entry);
                continue;
            }
            const answer = yield* this.answer({ type: "Optional Cost Rule", player, rule: entry.rule }, (answer) => {
                if (Math.max(0, amount + (answer.accept ? change : 0) + remaining) > ink) throw new InvalidInput("The proposed price must remain payable");
            });
            if (answer.accept) {
                amount += change;
                entries.push(entry);
            }
        }
        return { amount: Math.max(0, amount), entries };
    }

    private consumePrice(entries: ReturnType<Rules["freeAbilityEntries"]>): void {
        const consumed = new Set<CardModifier | PlayerModifier>(
            entries.flatMap((entry) => (entry.modifier && entry.modifier.uses !== undefined ? [entry.modifier] : [])),
        );
        for (const player of this.players())
            if (this.player(player).modifiers?.some((modifier) => consumed.has(modifier))) {
                this.updatePlayer(player, (p) => ({
                    modifiers: p.modifiers?.flatMap((modifier) =>
                        !consumed.has(modifier) || !("uses" in modifier) || modifier.uses === undefined
                            ? [modifier]
                            : modifier.uses > 1
                              ? [{ ...modifier, uses: modifier.uses - 1 }]
                              : [],
                    ),
                }));
            }
        for (const player of this.players())
            for (const state of this.player(player).play)
                if (state.modifiers?.some((modifier) => consumed.has(modifier))) {
                    this.updateCard(state.card, (card) => ({
                        modifiers: card.modifiers?.flatMap((modifier) =>
                            !consumed.has(modifier) || !("uses" in modifier) || modifier.uses === undefined
                                ? [modifier]
                                : modifier.uses > 1
                                  ? [{ ...modifier, uses: modifier.uses - 1 }]
                                  : [],
                        ),
                    }));
                }
        const printed = entries
            .flatMap((entry) => (entry.printed ? [entry.printed] : []))
            .filter((ref, i, refs) => refs.findIndex((other) => sameCard(ref.card, other.card) && ref.i === other.i) === i);
        for (const ref of printed) {
            const use = this.usedAbilities.find((use) => sameCard(use.card, ref.card) && use.ability === ref.i);
            if (use) use.uses++;
            else this.usedAbilities.push({ card: ref.card, ability: ref.i, uses: 1 });
        }
        this.cachedRules = undefined;
    }

    private *payCosts(payer: PlayerNumber | [PlayerNumber, ...PlayerNumber[]], costs: Cost[], scope: Scope): Generator<InputRequest, Results, TurnStep> {
        scope = { ...scope, numbers: scope.results, groups: scope.results.groups };
        if (!costs.length) return { groups: { "Paid Cards": [] } };
        if (!(typeof payer === "number" ? canPayCosts(this.rules(), payer, costs, scope) : canPayTogether(this.rules(), payer, costs, scope)))
            throw new InvalidInput("Cannot pay the complete cost");
        const match = (payment: Extract<DecisionAnswer, { type: "Pay Cost"; pay: true }>["payment"]) =>
            typeof payer === "number" ? matchPayment(this.rules(), payer, costs, scope, payment) : matchTogether(this.rules(), payer, costs, scope, payment);
        const validate = (answer: AnswerFor<Extract<Decision, { type: "Pay Cost" }>>): void => {
            if (!answer.pay || !match(answer.payment)) throw new InvalidInput("Expected complete payment matching all costs");
        };
        const answer = yield* this.answer(
            {
                type: "Pay Cost",
                player: typeof payer === "number" ? payer : { together: payer },
                cost: this.rules().bindCosts(costs, scope),
                optional: false,
            },
            validate,
        );
        if (!answer.pay) throw new Error("Mandatory payment was declined");
        const parts = match(answer.payment);
        if (!parts) throw new Error("Validated payment no longer matches");
        const paidCards: CardIdentifier[] = [];
        for (const [i, payment] of answer.payment.entries()) {
            const player = payment.player;
            const before = this.state;
            if ("cards" in payment && payment.type !== "Ink")
                for (const card of payment.cards) {
                    if (payment.type === "Exert" && sameCard(card, scope.source.card)) continue;
                    if (!paidCards.some((other) => sameCard(other, card))) paidCards.push(card);
                }
            if (payment.type === "Ink") {
                this.updatePlayer(player, (p) => ({
                    inkDrops: (p.inkDrops ?? 0) - (payment.inkDrops ?? 0),
                    inkwell: p.inkwell.map((ink) => (payment.cards.some((card) => sameCard(card, ink.card)) ? { ...ink, exerted: true } : ink)),
                }));
                if (payment.inkDrops) this.emit({ event: "Remove Ink Drop", player, amount: payment.inkDrops }, before);
                for (const card of payment.cards) this.emit({ event: "Exert", player, card }, before);
            } else if (payment.type === "Lose Lore") {
                this.updatePlayer(player, (p) => ({ lore: p.lore - payment.amount }));
                if (payment.amount) this.emit({ event: "Lose Lore", player, amount: payment.amount }, before);
            } else if (payment.type === "Exert")
                for (const card of payment.cards) {
                    this.updateCard(card, () => ({ exerted: true }));
                    this.emit({ event: "Exert", player, card }, before);
                }
            else if (payment.type === "Banish") yield* this.banishCards(payment.cards, scope.source);
            else if (payment.type === "Discard")
                for (const card of payment.cards) {
                    this.moveCard(card, "Discard");
                    this.emit({ event: "Discard", player, card, kind: "Cost" }, before);
                }
            else if (payment.type === "Deal Damage")
                for (const card of payment.cards) {
                    this.updateCard(card, (state) => ({
                        damage: (state.damage ?? 0) + payment.amount,
                    }));
                    if (payment.amount)
                        this.emit(
                            {
                                event: "Deal Damage",
                                player,
                                card,
                                amount: payment.amount,
                                source: scope.source.card,
                                kind: scope.source.kind,
                            },
                            before,
                        );
                }
            else if (payment.type === "Move Card") {
                let cards = payment.cards;
                const cost = parts[i].cost;
                if (cost.type === "Move Card" && cost.to === "Deck Bottom" && cost.order === "Random" && cards.length > 1) {
                    const step = yield { request: { type: "Shuffle" as const, cards } };
                    if (step.type !== "Random") throw new Error("Expected random payment order");
                    cards = step.outcome.cards;
                }
                for (const card of cards)
                    this.moveCard(card, payment.to === "Deck Bottom" ? "Deck" : payment.to, {
                        position: payment.to === "Deck Bottom" ? "Bottom" : undefined,
                        under: payment.to === "Under" ? payment.under : undefined,
                        actor: payment.player,
                    });
            }
        }
        return { groups: { "Paid Cards": paidCards } };
    }

    private *cleanup(): Generator<InputRequest, void, TurnStep> {
        while (true) {
            const reached = winners(this.rules());
            if (reached.length) {
                this.winners = reached;
                this.ended = true;
                this.damageSources.clear();
                return;
            }
            const cards = this.players()
                .flatMap((player) => this.player(player).play)
                .filter((state) => {
                    const definition = this.definition(state.card);
                    return (
                        (definition.type === "Character" || definition.type === "Location") &&
                        (state.damage ?? 0) >= this.rules().characteristic(state.card, "Willpower")
                    );
                })
                .map((state) => state.card);
            if (!cards.length) {
                this.damageSources.clear();
                return;
            }
            const before = this.state;
            yield* this.banishCards(cards, "Damage");
            if (this.state === before) {
                this.damageSources.clear();
                return;
            }
        }
    }

    private damageAmount(card: CardIdentifier, amount: number, source: CardIdentifier, player: PlayerNumber, ignoreResist = false): number {
        return damageAmount(this.rules(), card, amount, source, player, ignoreResist);
    }

    private commitDamage(): void {
        const batch = this.damageBatch;
        if (!batch) throw new Error("Missing damage batch");
        this.damageBatch = undefined;
        const events = batch.events.filter((event) => (event.event === "Deal Damage" || event.amount > 0) && this.rules().locate(event.card)?.zone === "Play");
        for (const event of events)
            if (event.amount)
                this.updateCard(event.card, (card) => ({
                    damage: (card.damage ?? 0) + event.amount,
                }));
        for (const event of events) this.emit(event, batch.before);
    }

    private *moveToLocation(
        card: CardIdentifier,
        destination: CardIdentifier,
        player: PlayerNumber,
        free: boolean,
    ): Generator<InputRequest, boolean, TurnStep> {
        return yield* moveToLocation(this.movement, card, destination, player, free);
    }

    private *payMovement(card: CardIdentifier, destination: CardIdentifier, player: PlayerNumber, free: boolean): Generator<InputRequest, boolean, TurnStep> {
        const definition = this.definition(destination);
        if (definition.type !== "Location") throw new Error("Expected a location");
        if (!free && this.rules().moveCost(card, destination, true) > this.rules().availableInk(player)) return false;
        const quote = free ? undefined : yield* this.quoteCost(player, definition.moveCost, this.rules().movementChanges(card, destination, true));
        const amount = quote?.amount ?? 0;
        const scope = scopeFor({ card, player, kind: "Ability" });
        if (!canPayCosts(this.rules(), player, [{ type: "Ink", amount }], scope)) return false;
        yield* this.payInk(player, amount);
        if (quote) this.consumePrice(quote.entries);
        return true;
    }

    /**
     * A character, item or location that has just entered play: Bodyguard may exert it,
     * then entry rules apply. Both come before the Play event, so play triggers see them.
     */
    private *arrive(card: CardIdentifier, player: PlayerNumber, exerted: boolean): Generator<InputRequest, void, TurnStep> {
        if (!exerted && this.rules().keyword(card, "Bodyguard")) {
            const entry = yield* this.answer({ type: "Optional", player, effect: { type: "Exert", cards: "Self" } });
            if (entry.accept) this.updateCard(card, () => ({ exerted: true }));
        }
        yield* this.applyEntryRules(card, player);
    }

    private *applyEntryRules(card: CardIdentifier, player: PlayerNumber): Generator<InputRequest, void, TurnStep> {
        for (const entry of this.rules().entryRules(card)) {
            const { rule, scope } = entry;
            const inner: Scope = { ...scope, selected: [card], affected: card, results: {} };
            if (rule.optional) {
                const answer = yield* this.answer({
                    type: "Optional",
                    player,
                    effect: rule.then ?? { type: "Sequence", effects: [] },
                });
                if (!answer.accept) continue;
            }
            this.updateCard(card, (current) => ({
                ...(rule.exerted ? { exerted: true } : {}),
                ...(rule.damage !== undefined ? { damage: (current.damage ?? 0) + this.amount(rule.damage, inner) } : {}),
            }));
            if (rule.modifier)
                yield* this.execute(
                    {
                        type: "Modify Cards",
                        cards: { cards: [card] },
                        modifier: rule.modifier,
                        duration: rule.duration,
                    },
                    inner,
                );
            if (rule.then)
                this.generated.push({
                    source: inner.source,
                    effect: rule.then,
                    retain: true,
                    scope: inner,
                });
            this.consumePrice([entry]);
        }
    }

    private lasting(duration: Duration | undefined, scope: Scope): { expires?: EffectExpiry; starts?: { startOfNextTurn: PlayerNumber; afterTurn: number } } {
        if (!duration) return {};
        const afterTurn = this.state.turn.number;
        if ("until" in duration) {
            if (duration.until === "End Of Turn") return { expires: { endOfTurn: afterTurn } };
            if (duration.until === "End Of Challenge") {
                if (!this.challenge) throw new Error("End Of Challenge requires an active challenge");
                return { expires: { endOfChallenge: true } };
            }
            if (!("player" in duration)) throw new Error("Unsupported duration");
            const players = this.selectPlayers(duration.player, scope);
            if (players.length !== 1) throw new Error(`Duration requires one player: ${JSON.stringify(duration)} from ${scope.source.card.fullName}`);
            return {
                expires: duration.until === "Start Of Next Turn" ? { startOfNextTurn: players[0], afterTurn } : { endOfNextTurn: players[0], afterTurn },
            };
        }
        if ("duringNextTurn" in duration) {
            const players = this.selectPlayers(duration.duringNextTurn, scope);
            if (players.length !== 1) throw new Error(`Duration requires one player: ${JSON.stringify(duration)} from ${scope.source.card.fullName}`);
            return {
                starts: { startOfNextTurn: players[0], afterTurn },
                expires: { endOfNextTurn: players[0], afterTurn },
            };
        }
        const cards = this.cards(duration.whileInPlay, scope);
        if (cards.length !== 1) throw new Error("Duration requires one source card");
        return { expires: { leavesPlay: cards[0] } };
    }

    /** A lost player's seat disappears. Timed static effects keep their original boundary. */
    private leaveGame(number: PlayerNumber): void {
        const order = this.players(),
            previous = order[(order.indexOf(number) + order.length - 1) % order.length];
        const departing = this.player(number);
        const owned = [
            ...departing.hand,
            ...departing.deck,
            ...departing.discard,
            ...(departing.removed ?? []),
            ...departing.inkwell.map((ink) => ink.card),
            ...this.players().flatMap((player) =>
                this.player(player).play.flatMap((state) => [
                    ...((state.owner ?? player) === number ? [state.card] : []),
                    ...(state.under ?? []).filter((under) => (under.owner ?? player) === number).map((under) => under.card),
                ]),
            ),
        ];
        const gone = (card: CardIdentifier): boolean => owned.some((other) => sameCard(card, other));
        const expiry = (value: EffectExpiry): EffectExpiry => {
            if ("anyOf" in value)
                return {
                    anyOf: value.anyOf.map(expiry) as [EffectExpiry, EffectExpiry, ...EffectExpiry[]],
                };
            if (("startOfNextTurn" in value && value.startOfNextTurn === number) || ("endOfNextTurn" in value && value.endOfNextTurn === number)) {
                // The absent turn would occur immediately after this surviving player's turn.
                return { endOfNextTurn: previous, afterTurn: this.state.turn.number };
            }
            return value;
        };
        const retained = <T extends CardModifier | PlayerModifier>(modifier: T): T[] => {
            if (modifier.starts?.startOfNextTurn === number) return [];
            if ("source" in modifier && modifier.source.player === number && (!("rule" in modifier) || !modifier.expires)) return [];
            return [{ ...modifier, ...(modifier.expires ? { expires: expiry(modifier.expires) } : {}) }];
        };
        this.expireDepartures(owned);
        const timed = this.player(number).modifiers?.flatMap((modifier) => ("rule" in modifier && modifier.expires ? retained(modifier) : [])) ?? [];
        for (const player of order.filter((player) => player !== number))
            this.updatePlayer(player, (p) => ({
                play: [...p.play, ...departing.play.filter((state) => state.owner === player).map(({ owner: _owner, ...state }) => state)]
                    .filter((state) => !gone(state.card))
                    .map((state) => ({
                        ...state,
                        ...(state.location && gone(state.location) ? { location: undefined } : {}),
                        under: state.under?.filter((under) => !gone(under.card)),
                        modifiers: state.modifiers?.flatMap(retained),
                    })),
                modifiers: [...(p.modifiers?.flatMap(retained) ?? []), ...(player === previous ? timed : [])],
            }));
        const players = { ...this.state.players };
        delete players[number];
        this.state = freeze({ ...this.state, players });
        this.cachedRules = undefined;
        for (let i = this.bag.length - 1; i >= 0; i--) if (this.bag[i].trigger.player === number) this.bag.splice(i, 1);
        for (let i = this.generated.length - 1; i >= 0; i--) if (this.generated[i].source.player === number) this.generated.splice(i, 1);
        this.registerRules();
    }

    /** Editing a lasting trigger preserves its turn-local uses and already assigned slot. */
    private retainListener<T extends CardModifier | PlayerModifier>(previous: T, next: T): T {
        if (previous === next || !("trigger" in previous) || !("trigger" in next)) return next;
        const slot = this.installed.get(previous);
        if (slot !== undefined) {
            this.installed.delete(previous);
            this.installed.set(next, slot);
            this.registry[slot].listener = next;
        }
        return next;
    }

    /** Captured character targets follow a Shift. Attribution still names the original source. */
    private inheritTargets(bases: readonly CardIdentifier[], top: CardIdentifier): void {
        const replace = (card: CardIdentifier): CardIdentifier => (bases.some((base) => sameCard(base, card)) ? top : card);
        const rewrite = (value: unknown): unknown => {
            if (!value || typeof value !== "object") return value;
            if (Array.isArray(value)) {
                const next = value.map(rewrite);
                return next.every((item, i) => item === value[i]) ? value : next;
            }
            let changed = false;
            const next = Object.fromEntries(
                Object.entries(value).map(([key, item]) => {
                    let updated: unknown;
                    if (key === "source") updated = item;
                    else if (key === "leavesPlay" && item && typeof item === "object" && "fullName" in item && "i" in item)
                        updated = replace(item as CardIdentifier);
                    else if (
                        key === "cards" &&
                        Array.isArray(item) &&
                        item.every((card) => card && typeof card === "object" && "fullName" in card && "i" in card)
                    ) {
                        const targets = item.map((card) => replace(card as CardIdentifier));
                        updated = targets.filter((card, i) => targets.findIndex((other) => sameCard(other, card)) === i);
                        if ((updated as CardIdentifier[]).length === item.length && (updated as CardIdentifier[]).every((card, i) => card === item[i]))
                            updated = item;
                    } else updated = rewrite(item);
                    if (updated !== item) changed = true;
                    return [key, updated];
                }),
            );
            return changed ? next : value;
        };
        for (const player of this.players())
            this.updatePlayer(player, (p) => ({
                modifiers: p.modifiers && mapKept(p.modifiers, (modifier) => this.retainListener(modifier, rewrite(modifier) as PlayerModifier)),
                play: mapKept(p.play, (state) => {
                    const modifiers =
                        state.modifiers && mapKept(state.modifiers, (modifier) => this.retainListener(modifier, rewrite(modifier) as CardModifier));
                    return modifiers === state.modifiers ? state : { ...state, modifiers };
                }),
            }));
    }

    private expireDepartures(cards: CardIdentifier[]): void {
        for (const entry of this.registry) if (!entry.listener && cards.some((card) => sameCard(card, entry.source.card))) entry.retired = true;
        this.registered = undefined;
        for (let i = this.usedAbilities.length - 1; i >= 0; i--) {
            if (cards.some((card) => sameCard(card, this.usedAbilities[i].card))) this.usedAbilities.splice(i, 1);
        }
        const expired = (expiry: EffectExpiry): boolean =>
            "leavesPlay" in expiry ? cards.some((card) => sameCard(card, expiry.leavesPlay)) : "anyOf" in expiry && expiry.anyOf.some(expired);
        const forget = (value: unknown, sourceLeft = false): unknown => {
            if (sourceLeft && value === "Self") return { cards: [] };
            if (value === null || typeof value !== "object") return value;
            if (Array.isArray(value)) {
                const next = value.map((item) => forget(item, sourceLeft));
                return next.every((item, i) => item === value[i]) ? value : next;
            }
            let changed = false;
            const next = Object.fromEntries(
                Object.entries(value).map(([key, item]) => {
                    const updated =
                        key === "cards" &&
                        Array.isArray(item) &&
                        item.every((card) => card !== null && typeof card === "object" && "fullName" in card && "i" in card)
                            ? item.filter((card) => !cards.some((other) => sameCard(card as CardIdentifier, other)))
                            : key === "source"
                              ? item
                              : forget(item, sourceLeft);
                    const kept =
                        Array.isArray(item) && Array.isArray(updated) && item.length === updated.length && item.every((entry, i) => entry === updated[i])
                            ? item
                            : updated;
                    if (kept !== item) changed = true;
                    return [key, kept];
                }),
            );
            return changed ? next : value;
        };
        // Fixed in-play targets refer to this incarnation, not a later replay of the same card.
        const departed = (modifier: CardModifier | PlayerModifier): boolean =>
            "source" in modifier && cards.some((card) => sameCard(card, modifier.source.card));
        const remaining = <T extends CardModifier | PlayerModifier>(modifiers: T[]): T[] =>
            mapKept(
                filterKept(modifiers, (modifier) => !modifier.expires || !expired(modifier.expires)),
                (modifier) => this.retainListener(modifier, forget(modifier, departed(modifier)) as T),
            );
        for (const player of this.players())
            this.updatePlayer(player, (p) => ({
                modifiers: p.modifiers && remaining(p.modifiers),
                play: mapKept(p.play, (state) => {
                    const modifiers = state.modifiers && remaining(state.modifiers);
                    return modifiers === state.modifiers ? state : { ...state, modifiers };
                }),
            }));
    }

    /** Only explicit capture operands bind now. Future event operands stay declarative. */
    private bindCaptures<T>(definition: T, scope: Scope): T {
        const walk = (value: unknown): unknown => {
            if (Array.isArray(value)) return value.map(walk);
            if (value === null || typeof value !== "object") return value;
            if ("capture" in value) {
                const operand = value.capture;
                const player =
                    (typeof operand === "string" && ["You", "Opponents", "All", "Selected Player", "Teammates"].includes(operand)) ||
                    (operand !== null &&
                        typeof operand === "object" &&
                        ("players" in operand ||
                            "ownerOf" in operand ||
                            "together" in operand ||
                            ("from" in operand && !("zone" in operand)) ||
                            ("event" in operand && operand.event === "Player")));
                if (player) return { players: this.selectPlayers(operand as PlayerSelection, scope) };
                const numeric =
                    typeof operand === "number" ||
                    (operand !== null &&
                        typeof operand === "object" &&
                        Object.keys(operand).some((key) =>
                            [
                                "count",
                                "distinct",
                                "stat",
                                "sum",
                                "highest",
                                "lowest",
                                "lore",
                                "inkDrops",
                                "turnsTaken",
                                "countEvents",
                                "add",
                                "subtract",
                                "multiply",
                                "min",
                                "max",
                                "value",
                            ].includes(key),
                        ));
                if (numeric) return this.amount(operand as Amount, scope);
                if (
                    operand !== null &&
                    typeof operand === "object" &&
                    (("event" in operand && (operand.event === "Amount" || operand.event === "Ink Paid")) ||
                        ("result" in operand && ["Damage Removed", "Damage Moved", "Lore Lost"].includes(String(operand.result))))
                )
                    return this.amount(operand as Amount, scope);
                return { cards: this.cards(operand as CardSelection, scope) };
            }
            return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, walk(nested)]));
        };
        return walk(definition) as T;
    }

    /** Leaves play reset card state. The physical identifier and ownership survive. */
    private moveCard(
        card: CardIdentifier,
        to: "Hand" | "Discard" | "Deck" | "Inkwell" | "Under" | "Play" | "Resolving",
        options: MoveOptions = {},
    ): CardIdentifier[] {
        return moveCard(this.movement, card, to, options);
    }

    /**
     * Banishes cards in play together, after each one's replacements. Lethal damage
     * names whatever dealt the damage as the cause; otherwise the cause is the source.
     */
    private *banishCards(cards: CardIdentifier[], cause: EffectSource | "Damage"): Generator<InputRequest, CardIdentifier[], TurnStep> {
        const remaining: CardIdentifier[] = [];
        for (const card of cards) {
            const found = this.rules().locate(card);
            if (found?.zone !== "Play") continue;
            if (yield* this.replace(this.banishEvent(card, found.player, cause))) remaining.push(card);
        }
        return this.commitBanish(remaining, cause);
    }

    private banishEvent(card: CardIdentifier, player: PlayerNumber, cause: EffectSource | "Damage"): TurnEvent {
        const attribution = cause === "Damage" ? this.damageSources.get(`${card.fullName}|${card.i}`) : { source: cause.card, kind: cause.kind };
        const challenge = attribution?.kind === "Challenge" ? this.challenge : undefined;
        return {
            event: "Banish",
            card,
            player,
            source: attribution?.source,
            kind: attribution?.kind,
            attacker: challenge?.attacker,
            defender: challenge?.defender,
        };
    }

    private commitBanish(cards: CardIdentifier[], cause: EffectSource | "Damage"): CardIdentifier[] {
        const before = this.state;
        const found = cards.flatMap((card) => {
            const located = this.rules().locate(card);
            return located?.zone === "Play" && located.state ? [{ card, player: located.player, state: located.state }] : [];
        });
        if (!found.length) return [];
        for (const player of this.players())
            this.updatePlayer(player, (p) => {
                const leaving = found.filter((entry) => entry.player === player);
                const discarded = found.flatMap((entry) => [
                    ...((entry.state.owner ?? entry.player) === player ? [entry.card] : []),
                    ...(entry.state.under ?? []).filter((under) => (under.owner ?? entry.player) === player).map((under) => under.card),
                ]);
                return {
                    discard: discarded.length ? [...p.discard, ...discarded] : p.discard,
                    play: mapKept(
                        filterKept(p.play, (state) => !leaving.some((entry) => sameCard(entry.card, state.card))),
                        (state) => {
                            if (!state.location || !found.some((entry) => sameCard(entry.card, state.location ?? state.card))) return state;
                            const { location, ...rest } = state;
                            return rest;
                        },
                    ),
                };
            });
        for (const entry of found) {
            this.emit(this.banishEvent(entry.card, entry.player, cause), before);
            this.emit({ event: "Leave Play", card: entry.card, player: entry.player }, before);
            this.emit(
                {
                    event: "Move Card",
                    card: entry.card,
                    player: entry.state.owner ?? entry.player,
                    from: "Play",
                    to: "Discard",
                },
                before,
            );
            for (const under of entry.state.under ?? [])
                this.emit(
                    {
                        event: "Move Card",
                        card: under.card,
                        player: under.owner ?? entry.player,
                        from: "Under",
                        to: "Discard",
                    },
                    before,
                );
        }
        this.expireDepartures(found.flatMap((entry) => [entry.card, ...(entry.state.under?.map((under) => under.card) ?? [])]));
        return found.map((entry) => entry.card);
    }

    private alternativeAvailable(effect: Effect, scope: Scope): boolean {
        if (effect.type === "Banish") return this.cards(effect.cards, scope).some((card) => this.rules().locate(card)?.zone === "Play");
        if (effect.type === "Choose Cards") {
            if (!this.selectPlayers(effect.player ?? "You", scope).length) return false;
            const cards = choiceCandidates(this.selection, effect, scope);
            const where = effect.where;
            const required = effect.count === "Any" || (typeof effect.count === "object" && "upTo" in effect.count) ? 0 : this.amount(effect.count, scope);
            const max =
                effect.count === "Any"
                    ? cards.length
                    : this.amount(typeof effect.count === "object" && "upTo" in effect.count ? effect.count.upTo : effect.count, scope);
            return (
                cards.length >= required &&
                (!where ||
                    hasSelection(cards, required, Math.min(max, cards.length), (selected) =>
                        this.rules().condition(where, {
                            ...scope,
                            selected,
                            numbers: scope.results,
                            groups: scope.results.groups,
                        }),
                    ))
            );
        }
        throw new Error(`Alternative legality is not implemented for ${effect.type}`);
    }

    private *execute(effect: Effect, scope: Scope): Generator<InputRequest, Results, TurnStep> {
        if (this.ended) return {};
        switch (effect.type) {
            case "Conditional":
            case "For Each Player":
            case "For Each Card":
            case "Repeat":
            case "Do Then":
            case "Sequence":
                return yield* executeComposition(this.composition, effect, scope);

            case "Gain Ink Drops": {
                const amount = this.amount(effect.amount, scope);
                for (const player of this.selectPlayers(effect.player, scope)) this.updatePlayer(player, (p) => ({ inkDrops: (p.inkDrops ?? 0) + amount }));
                return {};
            }
            case "Gain Control": {
                for (const card of this.cards(effect.cards, scope)) {
                    const found = this.rules().locate(card);
                    if (!found?.state || found.zone !== "Play" || found.player === scope.source.player) continue;
                    const owner = found.state.owner ?? found.player;
                    const { owner: previousOwner, ...state } = found.state;
                    const controlled: CardState = {
                        ...state,
                        ...(owner !== scope.source.player ? { owner } : {}),
                        under: state.under?.map((under) => {
                            const owner = under.owner ?? found.player;
                            const { owner: previousOwner, ...rest } = under;
                            return { ...rest, ...(owner !== scope.source.player ? { owner } : {}) };
                        }),
                    };
                    this.updatePlayer(found.player, (p) => ({
                        play: p.play.filter((entry) => !sameCard(entry.card, card)),
                    }));
                    this.updatePlayer(scope.source.player, (p) => ({
                        play: [...p.play, controlled],
                    }));
                    this.registerRules();
                }
                return {};
            }
            case "Play": {
                const players = this.selectPlayers(effect.player ?? "You", scope);
                if (players.length !== 1) throw new Error("Play requires one acting player");
                const player = players[0],
                    cards = this.cards(effect.cards, scope);
                let played = 0;
                for (const card of cards) {
                    const found = this.rules().locate(card);
                    if (!found || found.zone === "Play") continue;
                    const definition = this.definition(card);
                    assertSupportedDefinition(definition);
                    const inner: Scope = {
                        source: {
                            card,
                            player,
                            kind: definition.type === "Action" ? "Action" : "Ability",
                        },
                        selected: [],
                        parent: [],
                        results: {},
                    };
                    if (definition.playRules?.some((rule) => rule.type === "Requirement" && !this.rules().condition(rule.when, inner))) continue;
                    if (this.rules().restricted(card, "Can't Be Played")) continue;
                    if (
                        this.rules()
                            .playerChanges(player)
                            .some(
                                (change) =>
                                    "restriction" in change &&
                                    change.restriction === "Can't Play" &&
                                    (!change.where || this.rules().matches(card, change.where, inner)),
                            )
                    )
                        continue;
                    if (effect.method) {
                        const actions: PlayerAction[] = [];
                        if (
                            effect.method === "Play Or Shift" &&
                            (effect.free ||
                                canPayCosts(
                                    this.rules(),
                                    player,
                                    [
                                        {
                                            type: "Ink",
                                            amount: this.rules().cost(card, true),
                                        },
                                    ],
                                    inner,
                                ))
                        )
                            actions.push({ type: "Play", player, card });
                        for (const [i, ability] of (definition.abilities ?? []).entries()) {
                            if (ability.type !== "Keyword" || ability.keyword.name !== "Shift" || !this.rules().abilityActive(card, ability)) continue;
                            if (!effect.free && !canPayCosts(this.rules(), player, ability.keyword.cost, inner)) continue;
                            for (const onto of this.rules().shiftGroups(card, ability.keyword, inner))
                                actions.push({ type: "Shift", player, card, onto, ability: i });
                        }
                        for (const [rule, entry] of this.registry.entries()) {
                            if (
                                !entry.active ||
                                !sameCard(entry.source.card, card) ||
                                !entry.grant ||
                                entry.ability.type !== "Keyword" ||
                                entry.ability.keyword.name !== "Shift"
                            )
                                continue;
                            if (!effect.free && !canPayCosts(this.rules(), player, entry.ability.keyword.cost, inner)) continue;
                            for (const onto of this.rules().shiftGroups(card, entry.ability.keyword, inner))
                                actions.push({ type: "Shift", player, card, onto, rule });
                        }
                        if (!actions.length) continue;
                        const step = yield { request: { type: "Action", player, actions } };
                        if (step.type !== "Action") throw new Error("Expected a play method");
                        if (step.action.type === "Shift") {
                            yield* this.shift(step.action, effect.free ?? false);
                            played++;
                            continue;
                        }
                    }
                    if (!effect.free && this.rules().cost(card, true) > this.rules().availableInk(player)) continue;
                    const quote = effect.free ? undefined : yield* this.quotePlay(card, player);
                    const cost = quote?.amount ?? 0;
                    if (!canPayCosts(this.rules(), player, [{ type: "Ink", amount: cost }], inner)) continue;
                    yield* this.payCosts(player, cost ? [{ type: "Ink", amount: cost }] : [], inner);
                    this.consumePrice(quote?.entries ?? this.rules().costChanges(card, "Play"));
                    const before = this.state;
                    if (definition.type === "Action") {
                        this.moveCard(card, "Play", { player });
                        this.generatedSources.push(inner.source);
                        this.generated.push({
                            source: inner.source,
                            effect: definition.effect,
                            afterwards: effect.afterwards,
                        });
                    } else {
                        this.moveCard(card, "Play", { player, exerted: effect.exerted });
                        yield* this.arrive(card, player, effect.exerted ?? false);
                    }
                    this.emit({ event: "Play", player, card, inkPaid: cost }, before);
                    played++;
                }
                return { complete: played === cards.length };
            }
            case "Move To Location": {
                const locations = this.cards(effect.location, scope);
                if (!locations.length) return { complete: false, groups: { "Moved Cards": [] } };
                if (locations.length !== 1) throw new Error("Movement requires exactly one location");
                let complete = true;
                const moved: CardIdentifier[] = [];
                for (const card of this.cards(effect.cards, scope)) {
                    if (yield* this.moveToLocation(card, locations[0], scope.source.player, effect.free ?? false)) moved.push(card);
                    else complete = false;
                }
                return { complete, groups: { "Moved Cards": moved } };
            }
            case "Modify Players":
            case "Create Trigger":
            case "Create Rule":
            case "Delay":
            case "Modify Cards":
                return yield* executeLasting(this.lastingEffects, effect, scope);

            case "Or":
            case "Choose Mode":
            case "Choose Player":
            case "Choose Cards":
                return yield* executeSelection(this.selection, effect, scope);

            case "Random Cards": {
                const cards = this.cards(effect.from, scope),
                    count = Math.min(cards.length, this.amount(effect.count, scope));
                const step = yield { request: { type: "Random Cards", cards, count } };
                if (step.type !== "Random") throw new Error("Expected random cards");
                return yield* this.execute(effect.effect, {
                    ...scope,
                    parent: scope.selected,
                    selected: step.outcome.cards,
                });
            }
            case "Look": {
                const cards = this.cards(effect.cards, scope);
                this.observations.push({ type: "Look", cards, players: this.selectPlayers(effect.player ?? "You", scope) });
                return { groups: { "Looked At Cards": cards } };
            }
            case "Reveal": {
                const cards = this.cards(effect.cards, scope);
                this.observations.push({ type: "Reveal", cards });
                return { groups: { "Revealed Cards": cards } };
            }
            case "Name Card": {
                const players = this.selectPlayers(effect.player ?? "You", scope);
                if (players.length !== 1) throw new Error("Naming requires one player");
                const answer = yield* this.answer({ type: "Name Card", player: players[0] }, (answer) => {
                    if (!printedNames.has(answer.name) && !this.lookup(answer.name)?.names.includes(answer.name))
                        throw new InvalidInput("Name a printed card name, not a subtitle");
                });
                return { namedCard: answer.name };
            }
            case "Shuffle": {
                for (const player of this.selectPlayers(effect.player, scope)) {
                    const step = yield {
                        request: { type: "Shuffle", cards: this.player(player).deck },
                    };
                    if (step.type !== "Random") throw new Error("Expected shuffled cards");
                    this.updatePlayer(player, () => ({ deck: step.outcome.cards }));
                }
                return {};
            }
            case "Move Card": {
                let cards = this.cards(effect.cards, scope);
                if (effect.to === "Deck" && effect.position !== "Shuffle" && effect.order && cards.length > 1) {
                    if (effect.order === "Random") {
                        const step = yield { request: { type: "Shuffle", cards } };
                        if (step.type !== "Random") throw new Error("Expected shuffled cards");
                        cards = step.outcome.cards;
                    } else {
                        const players = this.selectPlayers(effect.player ?? "You", scope);
                        if (players.length !== 1) throw new Error("Ordering requires one player");
                        cards = (yield* this.answer({
                            type: "Order Cards",
                            player: players[0],
                            cards,
                        })).cards;
                    }
                }
                const under = effect.to === "Under" ? this.cards(effect.under, scope) : [];
                if (effect.to === "Under" && !under.length) return { groups: { "Moved Cards": [] }, complete: false };
                if (effect.to === "Under" && under.length !== 1) throw new Error("Under requires one destination");
                const moved: CardIdentifier[] = [];
                const ordered = effect.to === "Deck" && effect.position === "Top" ? [...cards].reverse() : cards;
                for (const card of ordered)
                    moved.push(
                        ...this.moveCard(card, effect.to, {
                            wholeStack: effect.wholeStack,
                            position: effect.to === "Deck" ? effect.position : undefined,
                            exerted: effect.to === "Inkwell" ? effect.exerted : undefined,
                            under: under[0],
                            actor: scope.source.player,
                            faceDown: effect.to === "Under" ? effect.faceDown : undefined,
                        }),
                    );
                if (effect.to === "Deck" && effect.position === "Shuffle") {
                    const owners = [...new Set(moved.map((card) => this.holder(card)))];
                    yield* this.execute({ type: "Shuffle", player: { players: owners } }, scope);
                }
                const requested =
                    typeof effect.cards === "object" && "zone" in effect.cards && effect.cards.take !== undefined
                        ? this.amount(effect.cards.take, scope)
                        : cards.length;
                return { groups: { "Moved Cards": moved }, complete: moved.length >= requested };
            }

            case "Exert":
            case "Ready": {
                const readied: CardIdentifier[] = [];
                for (const card of this.cards(effect.cards, scope)) {
                    const located = this.rules().locate(card);
                    if (effect.type === "Ready" && located?.zone === "Play") readied.push(card);
                    if (effect.type === "Ready" && this.rules().restricted(card, "Can't Ready")) continue;
                    if (located?.zone === "Play" && this.definition(card).type !== "Location") {
                        const before = this.state;
                        const changed = Boolean(located.state?.exerted) !== (effect.type === "Exert");
                        this.updateCard(card, () => ({ exerted: effect.type === "Exert" }));
                        if (changed) this.emit({ event: effect.type, card, player: located.player }, before);
                    } else if (located?.zone === "Inkwell") {
                        const before = this.state;
                        const changed = this.player(located.player).inkwell.some(
                            (entry) => sameCard(entry.card, card) && entry.exerted !== (effect.type === "Exert"),
                        );
                        this.updatePlayer(located.player, (p) => ({
                            inkwell: p.inkwell.map((entry) => (sameCard(entry.card, card) ? { ...entry, exerted: effect.type === "Exert" } : entry)),
                        }));
                        if (changed) this.emit({ event: effect.type, card, player: located.player }, before);
                    }
                }
                return effect.type === "Ready" ? { groups: { "Readied Cards": readied } } : {};
            }
            case "Search": {
                const cards = this.cards(effect.from, scope),
                    value = effect.count;
                const requested = this.amount(typeof value === "object" && "upTo" in value ? value.upTo : value, scope);
                const max = Math.min(requested, cards.length);
                const hidden =
                    effect.from.zone === "Deck" ||
                    effect.from.zone === "Hand" ||
                    effect.from.zone === "Inkwell" ||
                    (effect.from.zone === "Under" && cards.every((card) => this.rules().locate(card)?.under?.faceDown));
                const min = hidden || (typeof value === "object" && "upTo" in value) ? 0 : max;
                const selected = max
                    ? (yield* this.answer({
                          type: "Choose Cards",
                          player: scope.source.player,
                          cards,
                          min,
                          max,
                      })).cards
                    : [];
                return yield* this.execute(effect.effect, {
                    ...scope,
                    parent: scope.selected,
                    selected,
                });
            }
            case "Reveal Until": {
                const players = this.selectPlayers(effect.player, scope);
                const revealed: CardIdentifier[] = [];
                for (const player of players)
                    for (const card of this.player(player).deck) {
                        revealed.push(card);
                        if (this.rules().matches(card, effect.where, scope)) break;
                    }
                this.observations.push({ type: "Reveal", cards: revealed });
                return { groups: { "Revealed Cards": revealed } };
            }
            case "Pay Cost": {
                const players = this.selectPlayers(effect.player ?? "You", scope);
                const first = players[0];
                if (first === undefined) return {};
                const together = typeof effect.player === "object" && "together" in effect.player;
                if (!together && players.length !== 1) throw new Error("Payment requires one player or a collective decider");
                const next = (together ? canPayTogether(this.rules(), players, effect.cost, scope) : canPayCosts(this.rules(), first, effect.cost, scope))
                    ? effect.then
                    : effect.otherwise;
                const paid =
                    next === effect.then
                        ? yield* this.payCosts(together ? [first, ...players.slice(1)] : first, effect.cost, scope)
                        : { groups: { "Paid Cards": [] } };
                return next
                    ? yield* this.execute(next, {
                          ...scope,
                          results: {
                              ...scope.results,
                              ...paid,
                              groups: { ...scope.results.groups, ...paid.groups },
                          },
                      })
                    : paid;
            }
            case "Move Damage": {
                const from = this.cards(effect.from, scope),
                    to = this.cards(effect.to, scope);
                if (!from.length || !to.length) return { "Damage Moved": 0, complete: false };
                if (from.length !== 1 || to.length !== 1) throw new Error("Move Damage requires two individual cards");
                if (sameCard(from[0], to[0]) || this.rules().restricted(from[0], "Can't Remove Damage")) return { "Damage Moved": 0, complete: false };
                const available = this.inPlay(from[0]).damage ?? 0;
                const value = effect.amount;
                let amount = Math.min(available, this.amount(typeof value === "object" && "upTo" in value ? value.upTo : value, scope));
                if (typeof value === "object" && "upTo" in value)
                    amount = (yield* this.answer({
                        type: "Choose Amount",
                        player: scope.source.player,
                        min: 0,
                        max: amount,
                    })).amount;
                const before = this.state;
                this.updateCard(from[0], (c) => ({ damage: (c.damage ?? 0) - amount }));
                this.updateCard(to[0], (c) => ({ damage: (c.damage ?? 0) + amount }));
                if (amount) {
                    this.emit(
                        {
                            event: "Remove Damage",
                            card: from[0],
                            player: scope.source.player,
                            amount,
                            source: scope.source.card,
                            kind: scope.source.kind,
                        },
                        before,
                    );
                    this.emit(
                        {
                            event: "Put Damage",
                            card: to[0],
                            player: scope.source.player,
                            amount,
                            source: scope.source.card,
                            kind: scope.source.kind,
                        },
                        before,
                    );
                }
                return { "Damage Moved": amount };
            }

            case "Optional": {
                if (!this.selectPlayers(effect.player ?? "You", scope).length) return { ...emptyResults(effect.effect), complete: false, accepted: false };
                const player = this.decider(effect.player ?? "You", scope);
                const answer = yield* this.answer({
                    type: "Optional",
                    player,
                    effect: effect.effect,
                });
                if (answer.accept && effect.effect.type === "Choose Cards" && !this.alternativeAvailable(effect.effect, scope))
                    return { ...emptyResults(effect.effect), complete: false, accepted: true };
                return answer.accept
                    ? { ...(yield* this.execute(effect.effect, scope)), accepted: true }
                    : { ...emptyResults(effect.effect), complete: false, accepted: false };
            }

            case "Draw":
            case "Gain Lore":
            case "Lose Lore": {
                const amount = this.amount(effect.amount, scope);
                if (!Number.isInteger(amount) || amount < 0) throw new Error("Invalid amount");
                let lost = 0;
                for (const number of this.selectPlayers(effect.player, scope)) {
                    const before = this.state;
                    if (effect.type === "Draw") {
                        for (let i = 0; i < amount; i++) {
                            const deck = this.player(number).deck;
                            const card = effect.from === "Bottom" ? deck[deck.length - 1] : deck[0];
                            if (!card) break;
                            const before = this.state;
                            this.updatePlayer(number, (current) => ({
                                deck: effect.from === "Bottom" ? current.deck.slice(0, -1) : current.deck.slice(1),
                                hand: [...current.hand, card],
                            }));
                            this.emit({ event: "Draw", player: number, card }, before);
                            this.emit(
                                {
                                    event: "Move Card",
                                    player: number,
                                    card,
                                    from: "Deck",
                                    to: "Hand",
                                },
                                before,
                            );
                        }
                    } else {
                        const restriction = effect.type === "Gain Lore" ? "Can't Gain Lore" : "Can't Lose Lore";
                        if (
                            this.rules()
                                .playerChanges(number)
                                .some((change) => "restriction" in change && change.restriction === restriction)
                        )
                            continue;
                        const actual = effect.type === "Gain Lore" ? amount : Math.min(amount, this.player(number).lore);
                        if (effect.type === "Lose Lore") lost += actual;
                        this.updatePlayer(number, (current) => ({
                            lore: effect.type === "Gain Lore" ? current.lore + actual : current.lore - actual,
                        }));
                        if (actual) this.emit({ event: effect.type, player: number, amount: actual }, before);
                    }
                }
                return effect.type === "Lose Lore" ? instructionResults(effect.type, lost) : {};
            }
            case "Banish": {
                const cards = this.cards(effect.cards, scope);
                const banished = yield* this.banishCards(cards, scope.source);
                return {
                    groups: { "Banished Cards": banished },
                    complete: banished.length === cards.length,
                };
            }
            case "Discard": {
                const discarded: CardIdentifier[] = [];
                for (const card of this.cards(effect.cards, scope)) {
                    const owner = this.holder(card);
                    const p = this.player(owner);
                    if (p.hand.some((c) => sameCard(c, card))) {
                        const before = this.state;
                        if (
                            !(yield* this.replace({
                                event: "Discard",
                                player: owner,
                                card,
                                kind: "Effect",
                            }))
                        )
                            continue;
                        this.moveCard(card, "Discard");
                        this.emit({ event: "Discard", player: owner, card, kind: "Effect" }, before);
                        discarded.push(card);
                    }
                }
                return { groups: { "Discarded Cards": discarded } };
            }
            case "Deal Damage":
            case "Put Damage":
                return yield* dealDamage(this.damageEffects, effect, scope);
            case "Remove Damage":
                return yield* removeDamage(this.healing, effect, scope);
            default: {
                const unexpected: never = effect;
                throw new Error(`Unknown effect: ${JSON.stringify(unexpected)}`);
            }
        }
    }
}

/** Starts an independent action transition without changing the supplied position. */
export function startAction(position: GameState, action: PlayerAction, options: EngineOptions = {}): Resolution {
    return new Evaluator(position, options).startAction(action);
}

/** Begins the upcoming turn and requests intentions until its end processing completes. */
export function startTurn(position: GameState, options: EngineOptions = {}): Resolution {
    return new Evaluator(position, options).startTurn();
}

/**
 * Continues the current turn at its next intention, skipping start processing.
 * Turn-local history and usage limits begin empty, so this suits hypothetical
 * branches where the earlier part of the turn cannot be reconstructed.
 */
export function continueTurn(position: GameState, options: EngineOptions = {}): Resolution {
    return new Evaluator(position, options).continueTurn();
}

/** Shuffles fresh decks, draws opening hands and offers each player one hand alteration. */
export function startGame(position: GameState, options: EngineOptions = {}): Resolution {
    return new Evaluator(position, options).startGame();
}

/** Resolves an isolated effect using the same evaluator as ordinary actions. */
export function startEffect(position: GameState, effect: Effect, source: EffectSource, options: EngineOptions = {}): Resolution {
    return new Evaluator(position, options).startEffect(effect, source);
}

/** Optional asynchronous decision adapter. Random outcomes use explicit submit calls. */
export async function drive(resolution: Resolution, decide: (decision: Decision) => DecisionAnswer | Promise<DecisionAnswer>): Promise<GameState> {
    for (let request = resolution.request; request; request = resolution.request) {
        if (request.type === "Action") throw new Error("This adapter does not choose turn actions");
        if (request.type === "Shuffle" || request.type === "Random Cards") throw new Error("This adapter does not supply random outcomes");
        resolution.submit({ type: "Decision", answer: await decide(request) });
    }
    const result = resolution.result;
    if (!result) throw new Error("Resolution did not produce a position");
    return result;
}
