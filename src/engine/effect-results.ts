import type { Effect, NumericResult, CardResult } from "../model/ability";
import type { CardIdentifier } from "../model/identity";
import { sameCard } from "./identity";

/** Only outputs published by the currently supported instructions. */
const instructionOutputs: Partial<Record<Effect["type"], { number?: NumericResult; cards?: CardResult }>> = {
    "Remove Damage": { number: "Damage Removed", cards: "Characters With Damage Removed" },
    "Move Damage": { number: "Damage Moved" },
    "Lose Lore": { number: "Lore Lost" },
    Look: { cards: "Looked At Cards" },
    Reveal: { cards: "Revealed Cards" },
    "Reveal Until": { cards: "Revealed Cards" },
    Discard: { cards: "Discarded Cards" },
    Banish: { cards: "Banished Cards" },
    "Move Card": { cards: "Moved Cards" },
    "Move To Location": { cards: "Moved Cards" },
    Ready: { cards: "Readied Cards" },
};
export type Results = Partial<Record<NumericResult, number>> & {
    groups?: Partial<Record<CardResult, CardIdentifier[]>>;
    namedCard?: string;
    complete?: boolean;
    accepted?: boolean;
};

export function instructionResults(type: Effect["type"], value: number): Results {
    const key = instructionOutputs[type]?.number;
    if (key) return { [key]: value };
    return {};
}

/** Repeated instructions contribute to one result, rather than replacing the previous iteration. */
export function accumulatedResults(all: Results, next: Results): Results {
    const groups = { ...all.groups };
    const result: Results = { ...all, ...next, groups };
    for (const key of ["Damage Removed", "Damage Moved", "Lore Lost"] as const) if (next[key] !== undefined) result[key] = (all[key] ?? 0) + (next[key] ?? 0);
    for (const key of Object.keys(next.groups ?? {}) as CardResult[]) {
        const cards = [...(all.groups?.[key] ?? []), ...(next.groups?.[key] ?? [])];
        groups[key] = cards.filter((card, index) => cards.findIndex((other) => sameCard(card, other)) === index);
    }
    if (all.complete === false || next.complete === false) result.complete = false;
    return result;
}

export function emptyResults(effect: Effect): Results {
    const outputs = instructionOutputs[effect.type];
    if (outputs)
        return {
            ...instructionResults(effect.type, 0),
            ...(outputs.cards ? { groups: { [outputs.cards]: [] } } : {}),
        };
    switch (effect.type) {
        case "Optional":
        case "Choose Cards":
            return emptyResults(effect.effect);
        case "Sequence":
            return effect.effects
                .filter((child) => child.type !== "Sequence")
                .map(emptyResults)
                .reduce<Results>((all, next) => ({ ...all, ...next, groups: { ...all.groups, ...next.groups } }), {});
        case "Conditional": {
            const then = emptyResults(effect.then);
            const otherwise = effect.otherwise ? emptyResults(effect.otherwise) : {};
            return { ...then, ...otherwise, groups: { ...then.groups, ...otherwise.groups } };
        }
        default:
            return {};
    }
}
