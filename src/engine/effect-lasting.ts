import type { Amount, CardSelection, ContinuousRule, Duration, Effect, PlayerSelection } from "../model/ability";
import type { CardModifier, CardState, EffectExpiry, PlayerModifier, PlayerPosition } from "../model/game-state";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { TurnStep } from "../model/turn";
import type { InputRequest } from "./resolution";
import type { Rules } from "./rules";
import type { EffectScope } from "./effect-composition";
import type { Results } from "./effect-results";

type LastingEffect = Extract<Effect, { type: "Modify Cards" | "Modify Players" | "Create Trigger" | "Create Rule" | "Delay" }>;

export interface LastingContext {
    rules(): Rules;
    cards(selection: CardSelection, scope: EffectScope): CardIdentifier[];
    selectPlayers(selection: PlayerSelection, scope: EffectScope): PlayerNumber[];
    amount(amount: Amount, scope: EffectScope): number;
    lasting(duration: Duration | undefined, scope: EffectScope): { expires?: EffectExpiry; starts?: { startOfNextTurn: PlayerNumber; afterTurn: number } };
    bindCaptures<T>(definition: T, scope: EffectScope): T;
    updateCard(card: CardIdentifier, change: (current: CardState) => Partial<CardState>): void;
    updatePlayer(player: PlayerNumber, change: (current: PlayerPosition) => Partial<PlayerPosition>): void;
    registerRules(): void;
    execute(effect: Effect, scope: EffectScope): Generator<InputRequest, Results, TurnStep>;
}

/** Installs lasting changes without keeping evaluator state in handler modules. */
export function* executeLasting(context: LastingContext, effect: LastingEffect, scope: EffectScope): Generator<InputRequest, Results, TurnStep> {
    switch (effect.type) {
        case "Modify Players": {
            const change =
                "challengeLimit" in effect.modifier
                    ? {
                          ...effect.modifier,
                          players: {
                              players: context.selectPlayers(effect.modifier.players, scope),
                          },
                      }
                    : "permission" in effect.modifier && effect.modifier.cards
                      ? {
                            ...effect.modifier,
                            cards: { cards: context.cards(effect.modifier.cards, scope) },
                        }
                      : effect.modifier;
            const modifier: PlayerModifier = {
                ...change,
                ...context.lasting(effect.duration, scope),
            };
            for (const player of context.selectPlayers(effect.players, scope))
                context.updatePlayer(player, (p) => ({
                    modifiers: [...(p.modifiers ?? []), modifier],
                }));
            return {};
        }
        case "Create Trigger": {
            const modifier: PlayerModifier = {
                trigger: context.bindCaptures(effect.trigger, scope),
                effect: context.bindCaptures(effect.effect, scope),
                source: scope.source,
                uses: effect.uses,
                ...context.lasting(effect.duration, scope),
            };
            context.updatePlayer(scope.source.player, (p) => ({
                modifiers: [...(p.modifiers ?? []), modifier],
            }));
            context.registerRules();
            return {};
        }
        case "Create Rule": {
            const supported = (rule: ContinuousRule): boolean =>
                rule.type === "Modify Cost" ||
                rule.type === "Enter Play" ||
                rule.type === "Free Ability" ||
                (rule.type === "Together" && rule.rules.every(supported)) ||
                (rule.type === "Conditional" && supported(rule.then) && (!rule.otherwise || supported(rule.otherwise)));
            if (effect.uses !== undefined && !supported(effect.rule)) throw new Error("This consumable rule requires additional action accounting");
            const modifier: PlayerModifier = {
                rule: context.bindCaptures(effect.rule, scope),
                source: scope.source,
                uses: effect.uses,
                ...context.lasting(effect.duration, scope),
            };
            context.updatePlayer(scope.source.player, (p) => ({
                modifiers: [...(p.modifiers ?? []), modifier],
            }));
            return {};
        }
        case "Delay": {
            const players = context.selectPlayers(effect.until.turnEnd, scope);
            // Bind outer choices without freezing future zone queries or future local choices.
            const capture = (value: unknown, depth: number): unknown => {
                if (value === "Self") return { cards: [scope.source.card] };
                if (value === "Selected Cards" && !depth) return { cards: scope.selected };
                if (value === "Parent Selected Cards" && depth <= 1) return { cards: depth ? scope.selected : scope.parent };
                if (Array.isArray(value)) return value.map((item) => capture(item, depth));
                if (value === null || typeof value !== "object") return value;
                const selects = "type" in value && ["Choose Cards", "Random Cards", "Search", "For Each Card"].includes(String(value.type));
                return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, capture(child, depth + (selects && key === "effect" ? 1 : 0))]));
            };
            const delayed = capture(context.bindCaptures(effect.effect, scope), 0) as Effect;
            return yield* context.execute(
                {
                    type: "Create Trigger",
                    trigger: { event: "Turn End", player: { players } },
                    effect: delayed,
                    uses: 1,
                },
                scope,
            );
        }
        case "Modify Cards": {
            for (const card of context.cards(effect.cards, scope)) {
                if (context.rules().locate(card)?.zone !== "Play") continue;
                const timing = context.lasting(effect.duration, scope);
                const change = effect.modifier;
                if ("gainKeyword" in change && !context.rules().canGainKeyword(card, change.gainKeyword)) continue;
                if ("gainAbility" in change && change.gainAbility.type === "Keyword" && !context.rules().canGainKeyword(card, change.gainAbility.keyword.name))
                    continue;
                let modifier: CardModifier;
                if ("stat" in change) {
                    const amount = context.amount(change.amount, { ...scope, affected: card });
                    modifier = change.when
                        ? {
                              rule: {
                                  type: "Modify Cards",
                                  cards: "Affected Card",
                                  modifier: { ...change, amount },
                              },
                              source: scope.source,
                              ...timing,
                          }
                        : { stat: change.stat, amount, ...timing };
                } else if ("minimumStat" in change)
                    modifier = {
                        minimumStat: change.minimumStat,
                        amount: context.amount(change.amount, scope),
                        ...timing,
                    };
                else if ("gainKeyword" in change && change.amount !== undefined)
                    modifier = {
                        ...change,
                        amount: context.amount(change.amount, scope),
                        ...timing,
                    };
                else {
                    modifier = { ...change, ...timing } as CardModifier;
                }
                context.updateCard(card, (current) => ({
                    modifiers: [...(current.modifiers ?? []), modifier],
                }));
            }
            return {};
        }
    }
}
