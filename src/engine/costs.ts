import type { Cost } from "../model/ability";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { CostPayment, Decision } from "../model/turn";
import type { GameState, EffectSource } from "../model/game-state";
import type { RuleScope, EngineOptions } from "./rules";
import { Rules } from "./rules";
import { sameCard } from "./identity";

export interface CostPart {
    cost: Exclude<Cost, { type: "Choose Cards" }>;
    scope: RuleScope;
}

/** Choices are carried by the payment's cards. Nothing is committed during planning. */
export function* costPlans(
    rules: Rules,
    costs: readonly Cost[],
    scope: RuleScope,
): Generator<CostPart[]> {
    if (!costs.length) {
        yield [];
        return;
    }
    const [cost, ...rest] = costs;
    if (cost.type !== "Choose Cards") {
        for (const tail of costPlans(rules, rest, scope)) yield [{ cost, scope }, ...tail];
        return;
    }
    const candidates = rules.cards(cost.from, scope);
    const count = cost.count;
    function* choices(start: number, selected: CardIdentifier[]): Generator<CardIdentifier[]> {
        if (selected.length === count) {
            yield selected;
            return;
        }
        for (let i = start; i <= candidates.length - (count - selected.length); i++)
            yield* choices(i + 1, [...selected, candidates[i]]);
    }
    for (const selected of choices(0, [])) {
        for (const head of costPlans(rules, cost.cost, {
            ...scope,
            parent: scope.selected,
            selected,
        })) {
            for (const tail of costPlans(rules, rest, scope)) yield [...head, ...tail];
        }
    }
}

/** Reserves resources in order so one card cannot pay two incompatible costs. */
export function payable(rules: Rules, player: PlayerNumber, parts: readonly CostPart[]): boolean {
    let ink = rules.availableInk(player);
    let lore = rules.player(player).lore;
    const exerted: CardIdentifier[] = [],
        moved: CardIdentifier[] = [];
    for (const { cost, scope } of parts) {
        if (cost.type === "Ink") {
            ink -= rules.amount(cost.amount, scope);
            if (ink < 0) return false;
            continue;
        }
        if (cost.type === "Lose Lore") {
            if (
                rules
                    .playerChanges(player)
                    .some(
                        (change) =>
                            "restriction" in change && change.restriction === "Can't Lose Lore",
                    )
            )
                return false;
            lore -= rules.amount(cost.amount, scope);
            if (lore < 0) return false;
            continue;
        }
        const cards = rules.cards(cost.cards, scope);
        if (!cards.length) return false;
        for (const card of cards) {
            const found = rules.locate(card);
            if (!found || found.player !== player || moved.some((other) => sameCard(other, card)))
                return false;
            if (cost.type === "Discard" && found.zone !== "Hand") return false;
            if (
                (cost.type === "Exert" || cost.type === "Banish" || cost.type === "Deal Damage") &&
                found.zone !== "Play"
            )
                return false;
            if (cost.type === "Exert") {
                if (
                    found.state?.exerted ||
                    (rules.definition(card).type === "Character" && found.state?.drying) ||
                    exerted.some((other) => sameCard(other, card))
                )
                    return false;
                exerted.push(card);
            } else if (cost.type === "Deal Damage") {
                const amount = rules.amount(cost.amount, scope);
                if (
                    rules.restricted(card, "Can't Be Dealt Damage", scope.source.card, player) ||
                    rules.keyword(card, "Resist") ||
                    rules.modifiers(card).some((modifier) => "preventDamage" in modifier)
                )
                    return false;
                if (amount < 0) return false;
            } else {
                if (
                    cost.type === "Move Card" &&
                    cost.to === "Under" &&
                    rules.cards(cost.under, scope).length !== 1
                )
                    return false;
                moved.push(card);
            }
        }
    }
    return true;
}

export function canPayCosts(
    rules: Rules,
    player: PlayerNumber,
    costs: readonly Cost[],
    scope: RuleScope,
): boolean {
    for (const plan of costPlans(rules, costs, scope))
        if (payable(rules, player, plan)) return true;
    return false;
}

/** Matches the entire flattened answer, including all nested card selections. */
export function matchPayment(
    rules: Rules,
    player: PlayerNumber,
    costs: readonly Cost[],
    scope: RuleScope,
    payment: readonly CostPayment[],
): CostPart[] | undefined {
    for (const parts of costPlans(rules, costs, scope)) {
        if (parts.length !== payment.length || !payable(rules, player, parts)) continue;
        let drops = rules.player(player).inkDrops ?? 0;
        const valid = parts.every(({ cost, scope }, i) => {
            const paid = payment[i];
            if (paid.player !== player || cost.type !== paid.type) return false;
            if (cost.type === "Ink" && paid.type === "Ink") {
                drops -= paid.inkDrops ?? 0;
                return (
                    drops >= 0 &&
                    paid.cards.length + (paid.inkDrops ?? 0) === rules.amount(cost.amount, scope) &&
                    paid.cards.every((card) =>
                        rules
                            .player(player)
                            .inkwell.some((ink) => !ink.exerted && sameCard(ink.card, card)),
                    )
                );
            }
            if (cost.type === "Lose Lore" && paid.type === "Lose Lore")
                return paid.amount === rules.amount(cost.amount, scope);
            if (!("cards" in cost) || !("cards" in paid)) return false;
            const cards = rules.cards(cost.cards, scope);
            if (
                cards.length !== paid.cards.length ||
                !cards.every((card) => paid.cards.some((other) => sameCard(other, card)))
            )
                return false;
            if (cost.type === "Deal Damage" && paid.type === "Deal Damage")
                return paid.amount === rules.amount(cost.amount, scope);
            if (cost.type === "Move Card" && paid.type === "Move Card") {
                if (cost.to !== paid.to) return false;
                if (cost.to === "Under")
                    return (
                        paid.to === "Under" &&
                        rules.cards(cost.under, scope).some((card) => sameCard(card, paid.under))
                    );
            }
            return true;
        });
        if (valid) return parts;
    }
    return undefined;
}

/** Shared ink/lore costs reserve balances across the whole group. */
export function canPayTogether(
    rules: Rules,
    players: readonly PlayerNumber[],
    costs: readonly Cost[],
    scope: RuleScope,
): boolean {
    const ink = players.map(
        (player) => rules.availableInk(player),
    );
    const lore = players.map((player) =>
        rules
            .playerChanges(player)
            .some((change) => "restriction" in change && change.restriction === "Can't Lose Lore")
            ? 0
            : rules.player(player).lore,
    );
    let eachInk = 0,
        sharedInk = 0,
        sharedLore = 0;
    for (const cost of costs) {
        if (cost.type !== "Ink" && cost.type !== "Lose Lore")
            throw new Error("Collective card costs need a shared selection plan");
        const amount = rules.amount(cost.amount, scope);
        if (cost.type === "Lose Lore") sharedLore += amount;
        else if (cost.each) eachInk += amount;
        else sharedInk += amount;
    }
    return (
        ink.every((balance) => balance >= eachInk) &&
        ink.reduce((sum, balance) => sum + balance - eachInk, 0) >= sharedInk &&
        lore.reduce((sum, balance) => sum + balance, 0) >= sharedLore
    );
}

export function matchTogether(
    rules: Rules,
    players: readonly PlayerNumber[],
    costs: readonly Cost[],
    scope: RuleScope,
    payments: readonly CostPayment[],
): CostPart[] | undefined {
    const initial = players.map((player) => ({
        player,
        ink: rules.availableInk(player),
        drops: rules.player(player).inkDrops ?? 0,
        lore: rules.player(player).lore,
    }));
    function match(
        index: number,
        cursor: number,
        balances: typeof initial,
    ): CostPart[] | undefined {
        if (index === costs.length) return cursor === payments.length ? [] : undefined;
        const cost = costs[index];
        if (cost.type !== "Ink" && cost.type !== "Lose Lore")
            throw new Error("Collective card costs need a shared selection plan");
        const amount = rules.amount(cost.amount, scope);
        for (
            let length = 1;
            length <= players.length && cursor + length <= payments.length;
            length++
        ) {
            const next = balances.map((balance) => ({ ...balance }));
            const contributions = payments.slice(cursor, cursor + length);
            const payers = new Set<PlayerNumber>();
            let total = 0;
            const valid = contributions.every((payment) => {
                const balance = next.find((balance) => balance.player === payment.player);
                if (!balance || payers.has(payment.player) || payment.type !== cost.type)
                    return false;
                payers.add(payment.player);
                if (payment.type === "Ink" && cost.type === "Ink") {
                    const paid = payment.cards.length + (payment.inkDrops ?? 0);
                    if (
                        (cost.each && paid !== amount) ||
                        balance.ink < paid ||
                        balance.drops < (payment.inkDrops ?? 0)
                    )
                        return false;
                    if (
                        !payment.cards.every((card) =>
                            rules
                                .player(payment.player)
                                .inkwell.some((ink) => !ink.exerted && sameCard(ink.card, card)),
                        )
                    )
                        return false;
                    balance.ink -= paid;
                    balance.drops -= payment.inkDrops ?? 0;
                    total += paid;
                } else if (payment.type === "Lose Lore") {
                    if (
                        balance.lore < payment.amount ||
                        (payment.amount &&
                            rules
                                .playerChanges(payment.player)
                                .some(
                                    (change) =>
                                        "restriction" in change &&
                                        change.restriction === "Can't Lose Lore",
                                ))
                    )
                        return false;
                    balance.lore -= payment.amount;
                    total += payment.amount;
                }
                return true;
            });
            if (
                !valid ||
                total !== amount * (cost.type === "Ink" && cost.each ? players.length : 1) ||
                (cost.type === "Ink" && cost.each && payers.size !== players.length)
            )
                continue;
            const tail = match(index + 1, cursor + length, next);
            if (tail) return [...contributions.map(() => ({ cost, scope })), ...tail];
        }
        return undefined;
    }
    return match(0, 0, initial);
}

/**
 * A legal, deterministic default, not a strategic choice. Temporary ink drops are
 * spent first. Ink cards use zone order, which a caller can override when identity matters.
 * Pass the bound costs from the engine's request so outer targets are already fixed.
 */
export function getDefaultPayment(
    position: GameState,
    request: Extract<Decision, { type: "Pay Cost" }>,
    source: EffectSource,
    options: EngineOptions = {},
): CostPayment[] | undefined {
    const rules = new Rules(position, options.card),
        scope: RuleScope = { source, selected: [], parent: [] };
    const players = typeof request.player === "number" ? [request.player] : request.player.together;
    const balances = players.map((player) => ({
        player,
        drops: rules.player(player).inkDrops ?? 0,
        cards: rules
            .player(player)
            .inkwell.filter((ink) => !ink.exerted)
            .map((ink) => ink.card),
        lore: rules.player(player).lore,
    }));
    const payInk = (balance: (typeof balances)[number], amount: number): CostPayment => {
        const inkDrops = Math.min(amount, balance.drops);
        const cards = balance.cards.splice(0, amount - inkDrops);
        balance.drops -= inkDrops;
        return { type: "Ink", player: balance.player, cards, ...(inkDrops ? { inkDrops } : {}) };
    };
    if (typeof request.player === "number") {
        for (const plan of costPlans(rules, request.cost, scope)) {
            if (!payable(rules, request.player, plan)) continue;
            const balance = balances[0];
            return plan.map(({ cost, scope }): CostPayment => {
                if (cost.type === "Ink") return payInk(balance, rules.amount(cost.amount, scope));
                if (cost.type === "Lose Lore")
                    return {
                        type: cost.type,
                        player: balance.player,
                        amount: rules.amount(cost.amount, scope),
                    };
                const cards = rules.cards(cost.cards, scope);
                if (cost.type === "Deal Damage")
                    return {
                        type: cost.type,
                        player: balance.player,
                        cards,
                        amount: rules.amount(cost.amount, scope),
                    };
                if (cost.type === "Move Card") {
                    if (cost.to !== "Under")
                        return { type: cost.type, player: balance.player, cards, to: cost.to };
                    const [under] = rules.cards(cost.under, scope);
                    if (!under) throw new Error("Payable cost has no destination");
                    return { type: cost.type, player: balance.player, cards, to: "Under", under };
                }
                return { type: cost.type, player: balance.player, cards };
            });
        }
        return undefined;
    }
    if (!canPayTogether(rules, players, request.cost, scope)) return undefined;
    let reserved = request.cost.reduce(
        (sum, cost) =>
            sum + (cost.type === "Ink" && cost.each ? rules.amount(cost.amount, scope) : 0),
        0,
    );
    const payments: CostPayment[] = [];
    for (const cost of request.cost) {
        if (cost.type !== "Ink" && cost.type !== "Lose Lore")
            throw new Error("Collective card costs need a shared selection plan");
        const amount = rules.amount(cost.amount, scope);
        if (cost.type === "Ink" && cost.each) {
            reserved -= amount;
            for (const balance of balances) payments.push(payInk(balance, amount));
            continue;
        }
        let remaining = amount;
        for (const balance of balances) {
            const available =
                cost.type === "Ink"
                    ? balance.cards.length + balance.drops - reserved
                    : rules
                            .playerChanges(balance.player)
                            .some(
                                (change) =>
                                    "restriction" in change &&
                                    change.restriction === "Can't Lose Lore",
                            )
                      ? 0
                      : balance.lore;
            const contribution = Math.min(remaining, Math.max(0, available));
            if (!contribution && (amount || balance !== balances[0])) continue;
            if (cost.type === "Ink") payments.push(payInk(balance, contribution));
            else {
                payments.push({ type: "Lose Lore", player: balance.player, amount: contribution });
                balance.lore -= contribution;
            }
            remaining -= contribution;
            if (!remaining) break;
        }
        if (remaining) throw new Error("Payable shared cost has an incomplete default payment");
    }
    return payments;
}
