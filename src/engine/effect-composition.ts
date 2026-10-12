import type { Amount, CardSelection, Effect, PlayerSelection } from "../model/ability";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { GameState } from "../model/game-state";
import type { TurnStep } from "../model/turn";
import type { InputRequest } from "./resolution";
import type { Rules, RuleScope } from "./rules";
import { emptyResults, accumulatedResults } from "./effect-results";
import type { Results } from "./effect-results";

export interface EffectScope extends RuleScope {
    results: Results;
    support?: true;
}

type CompositionEffect = Extract<Effect, { type: "Conditional" | "For Each Player" | "For Each Card" | "Repeat" | "Do Then" | "Sequence" }>;

export interface CompositionContext {
    rules(): Rules;
    position(): GameState;
    ended(): boolean;
    execute(effect: Effect, scope: EffectScope): Generator<InputRequest, Results, TurnStep>;
    selectPlayers(selection: PlayerSelection, scope: EffectScope): PlayerNumber[];
    cards(selection: CardSelection, scope: EffectScope): CardIdentifier[];
    amount(amount: Amount, scope: EffectScope): number;
}

/** Sequencing and iteration share the evaluator's live state and result scope. */
export function* executeComposition(context: CompositionContext, effect: CompositionEffect, scope: EffectScope): Generator<InputRequest, Results, TurnStep> {
    switch (effect.type) {
        case "Conditional": {
            const branch = context.rules().condition(effect.if, {
                ...scope,
                numbers: scope.results,
                groups: scope.results.groups,
            })
                ? effect.then
                : effect.otherwise;
            return branch ? yield* context.execute(branch, scope) : {};
        }
        case "For Each Player": {
            let result = emptyResults(effect.effect);
            for (const player of context.selectPlayers(effect.players, scope))
                result = accumulatedResults(
                    result,
                    yield* context.execute(effect.effect, {
                        ...scope,
                        selectedPlayer: player,
                    }),
                );
            return result;
        }
        case "For Each Card": {
            let result = emptyResults(effect.effect);
            for (const card of context.cards(effect.cards, scope))
                result = accumulatedResults(
                    result,
                    yield* context.execute(effect.effect, {
                        ...scope,
                        parent: scope.selected,
                        selected: [card],
                    }),
                );
            return result;
        }
        case "Repeat": {
            if (effect.times === undefined) {
                let results = scope.results;
                while (true) {
                    const before = context.position();
                    const next = yield* context.execute(effect.effect, { ...scope, results });
                    results = {
                        ...results,
                        ...next,
                        groups: { ...results.groups, ...next.groups },
                    };
                    if (
                        context.rules().condition(effect.until, {
                            ...scope,
                            numbers: results,
                            groups: results.groups,
                        })
                    )
                        return next;
                    if (JSON.stringify(before) === JSON.stringify(context.position())) return next;
                }
            }
            const times = context.amount(effect.times, scope);
            if (!Number.isSafeInteger(times) || times < 0) throw new Error("Invalid repeat count");
            let result = emptyResults(effect.effect);
            for (let i = 0; i < times; i++) result = yield* context.execute(effect.effect, scope);
            return result;
        }
        case "Do Then": {
            const result = yield* context.execute(effect.do, scope);
            const next = result.complete === false ? effect.otherwise : effect.then;
            if (!next) return result;
            return yield* context.execute(next, {
                ...scope,
                results: {
                    ...scope.results,
                    ...result,
                    groups: { ...scope.results.groups, ...result.groups },
                },
            });
        }
        case "Sequence": {
            let results = scope.results;
            let produced: Results = {};
            for (const child of effect.effects) {
                if (context.ended()) break;
                const outputs = yield* context.execute(child, {
                    ...scope,
                    results,
                    namedCard: results.namedCard ?? scope.namedCard,
                });
                // An ordinary nested sequence keeps its results local.
                if (child.type !== "Sequence") {
                    results = {
                        ...results,
                        ...outputs,
                        groups: { ...results.groups, ...outputs.groups },
                    };
                    produced = {
                        ...produced,
                        ...outputs,
                        groups: { ...produced.groups, ...outputs.groups },
                        complete: produced.complete !== false && outputs.complete !== false,
                    };
                }
            }
            return produced;
        }
    }
}
