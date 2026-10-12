import type { PlayerCard, PlayerRequest } from "../model/player-interaction";

const same = (a: PlayerCard, b: PlayerCard): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Takes up to count cards in preference order while honouring the request's
 * stated constraints: a required card leads, and a capped total is never exceeded.
 */
export function fitChoice(request: Extract<PlayerRequest, { type: "Choose Cards" }>, preferred: readonly PlayerCard[], count: number): PlayerCard[] {
    let ordered = [...preferred];
    const required = request.required;
    if (required?.length && count > 0) {
        const lead = ordered.find((card) => required.some((other) => same(card, other)));
        if (lead) ordered = [lead, ...ordered.filter((card) => card !== lead)];
    }
    const total = request.total;
    if (!total) return ordered.slice(0, count);
    const chosen: PlayerCard[] = [];
    let sum = 0;
    for (const card of ordered) {
        if (chosen.length >= count) break;
        const value = total.values.find((entry) => same(entry.card, card))?.value ?? 0;
        if (sum + value > total.max) continue;
        chosen.push(card);
        sum += value;
    }
    return chosen;
}
