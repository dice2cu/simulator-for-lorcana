import type { Amount, CardSelection, Effect } from "../model/ability";
import type { Card } from "../model/card";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { CardState, GameState } from "../model/game-state";
import type { Decision, TurnEvent, TurnStep } from "../model/turn";
import type { InputRequest, AnswerFor } from "./resolution";
import type { Rules } from "./rules";
import type { EffectScope } from "./effect-composition";
import type { Results } from "./effect-results";
import { instructionResults } from "./effect-results";
import { InvalidInput } from "./invalid-input";

export interface HealingContext {
    rules(): Rules;
    position(): GameState;
    cards(selection: CardSelection, scope: EffectScope): CardIdentifier[];
    amount(amount: Amount, scope: EffectScope): number;
    inPlay(card: CardIdentifier): CardState;
    definition(card: CardIdentifier): Card;
    updateCard(card: CardIdentifier, change: (current: CardState) => Partial<CardState>): void;
    emit(event: TurnEvent, before: GameState): void;
    answer<D extends Decision>(decision: D, validate?: (answer: AnswerFor<D>) => void): Generator<InputRequest, AnswerFor<D>, TurnStep>;
}

/** Healing publishes the actual damage removed, including split-budget choices. */
export function* removeDamage(
    context: HealingContext,
    effect: Extract<Effect, { type: "Remove Damage" }>,
    scope: EffectScope,
): Generator<InputRequest, Results, TurnStep> {
    if (effect.distribution) {
        const cards = context.cards(effect.cards, scope).filter((card) => inPlay(context, card) && !context.rules().restricted(card, "Can't Remove Damage"));
        const candidates = cards.map((card) => ({
            card,
            max: context.inPlay(card).damage ?? 0,
        }));
        const available = candidates.reduce((sum, card) => sum + card.max, 0);
        const value = effect.amount;
        const requested = value === "All" ? available : context.amount(typeof value === "object" && "upTo" in value ? value.upTo : value, scope);
        const max = Math.min(requested, available);
        const optional = typeof value === "object" && "upTo" in value;
        const validate = (answer: AnswerFor<Extract<Decision, { type: "Distribute Damage Removal" }>>): void => {
            if (!optional && answer.amounts.reduce((sum, card) => sum + card.amount, 0) !== max)
                throw new InvalidInput("Remove the full available damage budget");
        };
        const answer = yield* context.answer(
            {
                type: "Distribute Damage Removal",
                player: scope.source.player,
                cards: candidates,
                max,
            },
            validate,
        );
        const before = context.position();
        for (const part of answer.amounts)
            context.updateCard(part.card, (current) => ({
                damage: (current.damage ?? 0) - part.amount,
            }));
        for (const part of answer.amounts)
            if (part.amount)
                context.emit(
                    {
                        event: "Remove Damage",
                        card: part.card,
                        player: scope.source.player,
                        amount: part.amount,
                        source: scope.source.card,
                        kind: scope.source.kind,
                    },
                    before,
                );
        return {
            "Damage Removed": answer.amounts.reduce((sum, part) => sum + part.amount, 0),
            groups: {
                "Characters With Damage Removed": answer.amounts.filter((part) => part.amount > 0).map((part) => part.card),
            },
        };
    }
    let removed = 0;
    const healed: CardIdentifier[] = [];
    for (const card of context.cards(effect.cards, scope)) {
        // A card that left play first, such as King Louie banished alongside the trigger's cause, has no damage to remove.
        if (!inPlay(context, card)) continue;
        const state = context.inPlay(card);
        const definition = context.definition(card);
        if (definition.type !== "Character" && definition.type !== "Location") throw new Error("Target cannot have damage");
        const value = effect.amount;
        let amount = value === "All" ? (state.damage ?? 0) : context.amount(typeof value === "object" && "upTo" in value ? value.upTo : value, scope);
        if (!Number.isInteger(amount) || amount < 0) throw new Error("Invalid damage amount");
        if (typeof value === "object" && "upTo" in value) {
            const max = Math.min(amount, state.damage ?? 0);
            const answer = yield* context.answer({
                type: "Choose Amount",
                player: scope.source.player,
                min: 0,
                max,
            });
            amount = answer.amount;
        }
        if (context.rules().restricted(card, "Can't Remove Damage")) continue;
        const actual = Math.min(amount, context.inPlay(card).damage ?? 0);
        removed += actual;
        const before = context.position();
        context.updateCard(card, (current) => ({
            damage: (current.damage ?? 0) - actual,
        }));
        if (actual) {
            healed.push(card);
            context.emit(
                {
                    event: "Remove Damage",
                    card,
                    player: scope.source.player,
                    amount: actual,
                    source: scope.source.card,
                    kind: scope.source.kind,
                },
                before,
            );
        }
    }
    return {
        ...instructionResults(effect.type, removed),
        groups: { "Characters With Damage Removed": healed },
    };
}

function inPlay(context: HealingContext, card: CardIdentifier): boolean {
    return context.rules().locate(card)?.zone === "Play";
}

export interface DamageContext {
    rules(): Rules;
    cards(selection: CardSelection, scope: EffectScope): CardIdentifier[];
    amount(amount: Amount, scope: EffectScope): number;
    definition(card: CardIdentifier): Card;
    /** Returns true when this instruction opens the batch. Nested damage joins it. */
    begin(): boolean;
    queue(event: Extract<TurnEvent, { card: CardIdentifier; amount: number }>): void;
    commit(): void;
    replace(event: TurnEvent): Generator<InputRequest, TurnEvent | undefined, TurnStep>;
}

export function damageAmount(rules: Rules, card: CardIdentifier, amount: number, source: CardIdentifier, player: PlayerNumber, ignoreResist = false): number {
    if (rules.restricted(card, "Can't Be Dealt Damage", source, player)) return 0;
    return Math.max(0, amount - (ignoreResist ? 0 : rules.keyword(card, "Resist")));
}

/** Prepare simultaneous damage before replacements. Commit only the outer batch. */
export function* dealDamage(
    context: DamageContext,
    effect: Extract<Effect, { type: "Deal Damage" | "Put Damage" }>,
    scope: EffectScope,
): Generator<InputRequest, Results, TurnStep> {
    const prepared: { card: CardIdentifier; amount: number }[] = [];
    for (const card of context.cards(effect.cards, scope)) {
        const definition = context.definition(card);
        if (definition.type !== "Character" && definition.type !== "Location") throw new Error("Target cannot have damage");
        let amount = context.amount(effect.amount, scope);
        if (!Number.isInteger(amount) || amount < 0) throw new Error("Invalid damage amount");
        if (!amount || (effect.type === "Deal Damage" && context.rules().restricted(card, "Can't Be Dealt Damage", scope.source.card, scope.source.player)))
            continue;
        if (effect.type === "Deal Damage") amount = damageAmount(context.rules(), card, amount, scope.source.card, scope.source.player, effect.ignoreResist);
        prepared.push({ card, amount });
    }
    const outer = context.begin();
    for (const { card, amount } of prepared) {
        let event: TurnEvent | undefined = {
            event: effect.type,
            card,
            amount,
            player: scope.source.player,
            source: scope.source.card,
            kind: scope.source.kind,
        };
        if (effect.type === "Deal Damage" && amount) event = yield* context.replace(event);
        if (event?.event === "Deal Damage" || event?.event === "Put Damage") context.queue(event);
    }
    if (outer) context.commit();
    return {};
}
