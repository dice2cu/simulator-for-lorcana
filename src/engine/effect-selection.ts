import type { Amount, CardSelection, Effect, PlayerSelection } from "../model/ability";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { GameState } from "../model/game-state";
import type { Decision, DecisionPlayer, TurnEvent, TurnStep } from "../model/turn";
import type { AnswerFor, InputRequest } from "./resolution";
import type { Rules } from "./rules";
import type { EffectScope } from "./effect-composition";
import type { Results } from "./effect-results";
import { InvalidInput } from "./invalid-input";
import { sameCard } from "./identity";

type SelectionEffect = Extract<Effect, { type: "Choose Cards" | "Choose Player" | "Choose Mode" | "Or" }>;

export interface SelectionContext {
    rules(): Rules;
    position(): GameState;
    holder(card: CardIdentifier): PlayerNumber;
    cards(selection: CardSelection, scope: EffectScope): CardIdentifier[];
    selectPlayers(selection: PlayerSelection, scope: EffectScope): PlayerNumber[];
    decider(selection: PlayerSelection, scope: EffectScope): DecisionPlayer;
    amount(amount: Amount, scope: EffectScope): number;
    alternativeAvailable(effect: Effect, scope: EffectScope): boolean;
    execute(effect: Effect, scope: EffectScope): Generator<InputRequest, Results, TurnStep>;
    answer<D extends Decision>(decision: D, validate?: (answer: AnswerFor<D>) => void): Generator<InputRequest, AnswerFor<D>, TurnStep>;
    emit(event: TurnEvent, before: GameState): void;
}

/** Stops at the first legal group instead of materializing every combination. */
export function hasSelection(cards: readonly CardIdentifier[], min: number, max: number, accepts: (cards: CardIdentifier[]) => boolean): boolean {
    const search = (start: number, chosen: CardIdentifier[]): boolean => {
        if (chosen.length >= min && accepts(chosen)) return true;
        if (chosen.length === max) return false;
        for (let i = start; i < cards.length; i++) if (search(i + 1, [...chosen, cards[i]])) return true;
        return false;
    };
    return search(0, []);
}

/** Target eligibility is identical when resolving a choice or checking whether an optional choice is possible. */
export function choiceCandidates(context: SelectionContext, effect: Extract<Effect, { type: "Choose Cards" }>, scope: EffectScope): CardIdentifier[] {
    const player = context.decider(effect.player ?? "You", scope);
    const choosers = typeof player === "number" ? [player] : player.together;
    return context.cards(effect.from, scope).filter((card) => {
        const holder = context.holder(card);
        if (context.rules().locate(card)?.zone !== "Play") return true;
        if (choosers.some((player) => context.rules().restricted(card, "Can't Be Chosen", scope.source.card, player))) return false;
        return choosers.every((player) => holder === player) || !context.rules().keyword(card, "Ward");
    });
}

export function* executeSelection(context: SelectionContext, effect: SelectionEffect, scope: EffectScope): Generator<InputRequest, Results, TurnStep> {
    switch (effect.type) {
        case "Or":
        case "Choose Mode": {
            const player = context.decider(effect.player ?? "You", scope);
            const options = effect.options.flatMap((option, mode) =>
                effect.type === "Or" && !context.alternativeAvailable(option, scope) ? [] : [{ effect: option, mode }],
            );
            if (!options.length) return { complete: false };
            if (options.length === 1 && effect.type === "Or") return yield* context.execute(options[0].effect, scope);
            const answer = yield* context.answer({ type: "Choose Mode", player, options });
            return yield* context.execute(effect.options[answer.mode], scope);
        }
        case "Choose Player": {
            const player = context.decider(effect.player ?? "You", scope);
            const from = context.selectPlayers(effect.from, scope);
            if (!from.length) return {};
            const answer = yield* context.answer({ type: "Choose Player", player, players: from });
            return yield* context.execute(effect.effect, {
                ...scope,
                selectedPlayer: answer.player,
            });
        }
        case "Choose Cards": {
            const player = context.decider(effect.player ?? "You", scope);
            const choosers = typeof player === "number" ? [player] : player.together;
            const cards = choiceCandidates(context, effect, scope);
            const requested =
                effect.count === "Any"
                    ? cards.length
                    : context.amount(typeof effect.count === "object" && "upTo" in effect.count ? effect.count.upTo : effect.count, scope);
            if (!Number.isInteger(requested) || requested < 0) throw new Error("Invalid choice count");
            const max = Math.min(cards.length, requested);
            const min = effect.count === "Any" || (typeof effect.count === "object" && "upTo" in effect.count) ? 0 : max;
            const fits = (selected: CardIdentifier[]): boolean =>
                !effect.where ||
                context.rules().condition(effect.where, {
                    ...scope,
                    selected,
                    numbers: scope.results,
                    groups: scope.results.groups,
                });
            const mustChoose = cards.filter((card) => choosers.some((player) => context.rules().restricted(card, "Must Be Chosen", scope.source.card, player)));
            const hasRequired = (selected: CardIdentifier[]): boolean =>
                !selected.length || selected.some((card) => mustChoose.some((other) => sameCard(card, other)));
            const required =
                mustChoose.length && (!effect.where || hasSelection(cards, Math.max(1, min), max, (selected) => fits(selected) && hasRequired(selected)))
                    ? mustChoose
                    : [];
            if (effect.where && !hasSelection(cards, min, max, fits)) {
                const result = yield* context.execute(effect.effect, {
                    ...scope,
                    parent: scope.selected,
                    selected: [],
                });
                return { ...result, complete: false };
            }
            const available = max === 1 ? (required.length ? required : cards).filter((card) => fits([card])) : cards;
            const validate = (answer: AnswerFor<Extract<Decision, { type: "Choose Cards" }>>): void => {
                if (
                    effect.where &&
                    !context.rules().condition(effect.where, {
                        ...scope,
                        selected: answer.cards,
                        numbers: scope.results,
                        groups: scope.results.groups,
                    })
                )
                    throw new InvalidInput("Selected group does not meet the choice condition");
                if (answer.cards.length && required.length && !answer.cards.some((card) => required.some((other) => sameCard(card, other))))
                    throw new InvalidInput("This selection must include a character that must be chosen");
            };
            // Players see every constraint the validator enforces.
            const where = effect.where;
            const summed =
                where && "value" in where && typeof where.value === "object" && "sum" in where.value && where.value.sum.cards === "Selected Cards" && "atMost" in where.is
                    ? { stat: where.value.sum.stat, max: where.is.atMost }
                    : undefined;
            const constraints = {
                ...(required.length && max > 1 ? { required } : {}),
                ...(summed && typeof summed.max === "number"
                    ? { total: { max: summed.max, values: available.map((card) => ({ card, value: context.rules().characteristic(card, summed.stat) })) } }
                    : {}),
            };
            const answer =
                max === 0
                    ? { type: "Choose Cards" as const, cards: [] }
                    : yield* context.answer({ type: "Choose Cards", player, cards: available, min, max, ...constraints, effect: effect.effect }, validate);
            const before = context.position();
            for (const card of answer.cards)
                if (context.rules().locate(card)?.zone === "Play")
                    context.emit(
                        {
                            event: "Chosen",
                            player,
                            card,
                            source: scope.source.card,
                            kind: scope.source.kind,
                        },
                        before,
                    );
            if (scope.support)
                for (const card of answer.cards)
                    context.emit(
                        {
                            event: "Chosen For Support",
                            player: scope.source.player,
                            card,
                            source: scope.source.card,
                        },
                        before,
                    );
            const result = yield* context.execute(effect.effect, {
                ...scope,
                parent: scope.selected,
                selected: answer.cards,
            });
            return {
                ...result,
                complete:
                    result.complete !== false &&
                    (effect.count === "Any" || (typeof effect.count === "object" && "upTo" in effect.count) || answer.cards.length === requested),
            };
        }
    }
}
