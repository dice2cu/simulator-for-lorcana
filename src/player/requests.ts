import type { Ability, Cost } from "../model/ability";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import type { PlayerActionDescription, PlayerAnswer, PlayerCard, PlayerPayment, PlayerRequest } from "../model/player-interaction";
import type { ActionRequest, CostPayment, Decision, DecisionAnswer, PlayerAction, TurnStep } from "../model/turn";
import { costPlans, getDefaultPayment, payable } from "../engine/costs";
import { InvalidInput } from "../engine/invalid-input";
import type { RuleScope, Rules } from "../engine/rules";
import { cardKey } from "./locations";
import type { Sight } from "./projection";

/** A projected request and the private mapping back to an engine input. */
export interface ProjectedRequest {
    request: PlayerRequest;
    /** Throws InvalidInput with a safe message when the answer does not fit the request. */
    toStep(answer: PlayerAnswer): TurnStep;
}

/** Supplies an unpredictable handle order so handles never mirror authoritative positions. */
export type HandleOrder = (count: number) => number[];

const identity: HandleOrder = (count) => Array.from({ length: count }, (_, i) => i);

/**
 * Converts one engine request for its single deciding player. The engine has
 * already established legality. Hidden cards become request-local handles.
 */
export function projectRequest(request: ActionRequest | Decision, rules: Rules, sees: Sight, order: HandleOrder = identity): ProjectedRequest {
    const handles = new Handles(sees, order);
    if (request.type === "Action") {
        const actions = request.actions.map((action, option) => ({ option, action: describeAction(action, rules), cost: actionCost(action, rules) }));
        return {
            request: { type: "Action", player: request.player, actions },
            toStep(answer) {
                if (answer.type !== "Action") throw new InvalidInput("Choose one of the offered actions");
                const action = request.actions[answer.option];
                if (!Number.isInteger(answer.option) || !action) throw new InvalidInput("Unknown action option");
                return { type: "Action", action };
            },
        };
    }
    const decision =
        (map: (answer: PlayerAnswer & { type: "Decision" }) => DecisionAnswer): ProjectedRequest["toStep"] =>
        (answer) => {
            if (answer.type !== "Decision" || answer.answer.type !== request.type) throw new InvalidInput(`Answer the outstanding ${request.type} request`);
            return { type: "Decision", answer: map(answer) };
        };
    switch (request.type) {
        case "Choose Cards":
        case "Order Cards": {
            const cards = handles.offer(request.cards);
            handles.settle();
            const required = request.type === "Choose Cards" && request.required ? { required: handles.present(request.required) } : {};
            const total =
                request.type === "Choose Cards" && request.total
                    ? {
                          total: {
                              max: request.total.max,
                              values: request.total.values.map(({ card, value }) => ({ card: handles.present([card])[0], value })),
                          },
                      }
                    : {};
            return {
                request: { ...request, cards: handles.resolveOffer(cards), ...required, ...total },
                toStep: decision(({ answer }) => ({ type: request.type, cards: handles.take((answer as { cards: readonly PlayerCard[] }).cards) })),
            };
        }
        case "Choose Trigger":
            return {
                request: {
                    type: request.type,
                    player: request.player,
                    options: request.options.map((option, index) => ({
                        option: index,
                        player: option.player,
                        ...(option.source ? { source: option.source } : {}),
                        effect: option.effect,
                    })),
                },
                toStep: decision(({ answer }) => ({ type: "Choose Trigger", trigger: chosen(request.options, answer).reference })),
            };
        case "Choose Replacement":
            return {
                request: {
                    type: request.type,
                    player: request.player,
                    options: request.options.map((option, index) => ({
                        option: index,
                        player: option.player,
                        ...(option.source ? { source: option.source } : {}),
                        replacement: option.replacement,
                    })),
                },
                toStep: decision(({ answer }) => ({ type: "Choose Replacement", replacement: chosen(request.options, answer).reference })),
            };
        case "Pay Cost": {
            const payers = typeof request.player === "number" ? [request.player] : request.player.together;
            const candidates = handles.offer(paymentCandidates(rules, request.cost, payers[0]));
            const offers = payers.map((player) => {
                const position = rules.player(player);
                return {
                    player,
                    cards: handles.offer(position.inkwell.filter((ink) => !ink.exerted).map((ink) => ink.card)),
                    inkDrops: position.inkDrops ?? 0,
                };
            });
            handles.settle();
            const payments = paymentPlans(rules, request).map((plan) =>
                plan.map((part): PlayerPayment => (part.type === "Lose Lore" ? part : ({ ...part, cards: handles.present(part.cards) } as PlayerPayment))),
            );
            return {
                request: {
                    type: "Pay Cost",
                    player: request.player,
                    cost: request.cost,
                    optional: request.optional,
                    ink: offers.map((offer) => ({ ...offer, cards: handles.resolveOffer(offer.cards) })),
                    payments,
                    cards: handles.resolveOffer(candidates),
                },
                toStep: decision(({ answer }) => {
                    if (answer.type !== "Pay Cost") throw new InvalidInput("Answer the outstanding payment");
                    if (!answer.pay) return { type: "Pay Cost", pay: false };
                    return { type: "Pay Cost", pay: true, payment: answer.payment.map((part) => payment(part, handles)) };
                }),
            };
        }
        default:
            return { request, toStep: decision(({ answer }) => answer as DecisionAnswer) };
    }
}

function chosen<T>(options: readonly T[], answer: PlayerDecisionAnswerLike): T {
    const option = "option" in answer ? answer.option : undefined;
    const value = typeof option === "number" && Number.isInteger(option) ? options[option] : undefined;
    if (!value) throw new InvalidInput("Unknown option");
    return value;
}

type PlayerDecisionAnswerLike = Extract<PlayerAnswer, { type: "Decision" }>["answer"];

function payment(part: PlayerPayment, handles: Handles): CostPayment {
    if (part.type === "Lose Lore") return part;
    const cards = handles.take(part.cards);
    return { ...part, cards } as CostPayment;
}

/** Hidden cards receive handles assigned in a shuffled order. Visible cards keep their identity. */
class Handles {
    private readonly pending: CardIdentifier[] = [];
    private readonly assigned = new Map<string, number>();
    private readonly cards = new Map<number, CardIdentifier>();
    constructor(
        private readonly sees: Sight,
        private readonly order: HandleOrder,
    ) {}

    offer(cards: readonly CardIdentifier[]): readonly CardIdentifier[] {
        for (const card of cards) if (!this.sees(card) && !this.pending.some((entry) => cardKey(entry) === cardKey(card))) this.pending.push(card);
        return cards;
    }

    settle(): void {
        const numbers = this.order(this.pending.length);
        this.pending.forEach((card, index) => {
            this.assigned.set(cardKey(card), numbers[index]);
            this.cards.set(numbers[index], card);
        });
        this.pending.length = 0;
    }

    /** Visible cards keep their order. Hidden handles are sorted so offer order is not disclosed. */
    resolveOffer(cards: readonly CardIdentifier[]): PlayerCard[] {
        const visible: PlayerCard[] = [],
            hidden: number[] = [];
        for (const card of cards) {
            const handle = this.assigned.get(cardKey(card));
            if (handle === undefined) visible.push(card);
            else hidden.push(handle);
        }
        return [...visible, ...hidden.sort((a, b) => a - b).map((hidden) => ({ hidden }))];
    }

    present(cards: readonly CardIdentifier[]): PlayerCard[] {
        return cards.map((card) => {
            const hidden = this.assigned.get(cardKey(card));
            if (hidden !== undefined) return { hidden };
            if (!this.sees(card)) throw new Error("A payment would disclose an unoffered hidden card");
            return card;
        });
    }

    take(cards: readonly PlayerCard[]): CardIdentifier[] {
        if (!Array.isArray(cards)) throw new InvalidInput("Card choices must be a list");
        return cards.map((card) => {
            if (card && typeof card === "object" && "hidden" in card) {
                const actual = this.cards.get(card.hidden);
                if (!actual) throw new InvalidInput("Unknown hidden card choice");
                return actual;
            }
            if (!card || typeof card !== "object" || typeof card.fullName !== "string" || typeof card.i !== "number")
                throw new InvalidInput("Unknown card choice");
            if (this.assigned.has(cardKey(card)) || !this.sees(card)) throw new InvalidInput("Unknown card choice");
            return { fullName: card.fullName, i: card.i };
        });
    }
}

/** Resolve the candidate pools without enumerating combinations of nested choices. */
function paymentCandidates(rules: Rules, costs: readonly Cost[], player: PlayerNumber): CardIdentifier[] {
    const found = new Map<string, CardIdentifier>();
    const visit = (costs: readonly Cost[], scope: RuleScope): void => {
        const add = (cards: readonly CardIdentifier[]) => {
            for (const card of cards) found.set(cardKey(card), card);
        };
        for (const cost of costs) {
            if (cost.type === "Choose Cards") {
                const selected = rules.cards(cost.from, scope);
                add(selected);
                visit(cost.cost, { ...scope, parent: scope.selected, selected });
            } else if ("cards" in cost) {
                add(rules.cards(cost.cards, scope));
                if (cost.type === "Move Card" && cost.to === "Under") add(rules.cards(cost.under, scope));
            }
        }
    };
    visit(costs, { source: { card: { fullName: "", i: -1 }, player, kind: "Ability" }, selected: [], parent: [] });
    return [...found.values()];
}

/**
 * Legal complete payments in engine form, using ready ink in zone order.
 * Collective payments list the engine's default contribution only.
 */
function paymentPlans(rules: Rules, request: Extract<Decision, { type: "Pay Cost" }>, limit = 32): CostPayment[][] {
    const payer = typeof request.player === "number" ? request.player : request.player.together.length === 1 ? request.player.together[0] : undefined;
    const source = { card: { fullName: "", i: -1 }, player: payer ?? (request.player as { together: PlayerNumber[] }).together[0], kind: "Ability" as const };
    if (payer === undefined) {
        const plan = getDefaultPayment(rules.position, request, source);
        return plan ? [plan] : [];
    }
    const plans: CostPayment[][] = [],
        seen = new Set<string>();
    const scope: RuleScope = { source, selected: [], parent: [] };
    for (const parts of costPlans(rules, request.cost, scope)) {
        if (!payable(rules, payer, parts)) continue;
        const drops = { value: rules.player(payer).inkDrops ?? 0 };
        const ready = rules
            .player(payer)
            .inkwell.filter((ink) => !ink.exerted)
            .map((ink) => ink.card);
        const plan = parts.map(({ cost, scope }): CostPayment => {
            if (cost.type === "Ink") {
                const amount = rules.amount(cost.amount, scope);
                const inkDrops = Math.min(amount, drops.value);
                drops.value -= inkDrops;
                return { type: "Ink", player: payer, cards: ready.splice(0, amount - inkDrops), ...(inkDrops ? { inkDrops } : {}) };
            }
            if (cost.type === "Lose Lore") return { type: "Lose Lore", player: payer, amount: rules.amount(cost.amount, scope) };
            const cards = rules.cards(cost.cards, scope);
            if (cost.type === "Deal Damage") return { type: "Deal Damage", player: payer, cards, amount: rules.amount(cost.amount, scope) };
            if (cost.type === "Move Card") {
                if (cost.to !== "Under") return { type: "Move Card", player: payer, cards, to: cost.to };
                const [under] = rules.cards(cost.under, scope);
                return { type: "Move Card", player: payer, cards, to: "Under", under };
            }
            return { type: cost.type, player: payer, cards };
        });
        const key = JSON.stringify(plan);
        if (seen.has(key)) continue;
        seen.add(key);
        plans.push(plan);
        if (plans.length >= limit) break;
    }
    return plans;
}

/** Public description without engine registry slots or alternate-cost references. */
export function describeAction(action: PlayerAction, rules: Rules): PlayerActionDescription {
    switch (action.type) {
        case "Play":
            return { type: "Play", player: action.player, card: action.card };
        case "Move":
            return { type: "Move", player: action.player, card: action.card, location: action.location };
        case "Shift":
            return {
                type: "Shift",
                player: action.player,
                card: action.card,
                onto: action.onto,
                ...(action.ability !== undefined ? { ability: action.ability } : {}),
            };
        case "Boost": {
            const definition = boostAbility(action, rules);
            return {
                type: "Boost",
                player: action.player,
                card: action.card,
                ...(action.ability !== undefined ? { ability: action.ability } : {}),
                definition: definition.keyword,
                ...(action.free ? { free: true } : {}),
            };
        }
        case "Activate": {
            const { card, ability, printed } = activatedAbility(action, rules);
            return {
                type: "Activate",
                player: action.player,
                card,
                ...(printed !== undefined ? { ability: printed } : {}),
                definition: ability,
                ...(action.free ? { free: true } : {}),
            };
        }
        default:
            return action;
    }
}

function activatedAbility(
    action: Extract<PlayerAction, { type: "Activate" }>,
    rules: Rules,
): { card: CardIdentifier; ability: Extract<Ability, { type: "Activated" }>; printed?: number } {
    if ("ability" in action) {
        const ability = rules.definition(action.ability.card).abilities?.[action.ability.i];
        if (ability?.type !== "Activated") throw new Error("Offered activation has no printed ability");
        return { card: action.ability.card, ability, printed: action.ability.i };
    }
    // The live registry keeps retired rules, so its slot can name a different ability of
    // this card in a fresh view (Ursula - Eric's Bride granted Sherwood Forest's activation).
    const slot = registered(action.rule, action.card, rules);
    const ability = slot?.type === "Activated" ? slot : rules.grants(action.card).find((grant) => grant.ability.type === "Activated")?.ability;
    if (ability?.type !== "Activated") throw new Error("Offered activation has no granted ability");
    return { card: action.card, ability };
}

function boostAbility(action: Extract<PlayerAction, { type: "Boost" }>, rules: Rules): Extract<Ability, { type: "Keyword" }> & { keyword: { name: "Boost" } } {
    const boost = (ability: Ability | undefined): boolean => ability?.type === "Keyword" && ability.keyword.name === "Boost";
    const slot = action.ability === undefined ? registered(action.rule, action.card, rules) : undefined;
    const ability =
        action.ability !== undefined
            ? rules.definition(action.card).abilities?.[action.ability]
            : boost(slot)
              ? slot
              : rules.grants(action.card).find((grant) => boost(grant.ability))?.ability;
    if (ability?.type !== "Keyword" || ability.keyword.name !== "Boost") throw new Error("Offered Boost has no ability");
    return ability as Extract<Ability, { type: "Keyword" }> & { keyword: { name: "Boost" } };
}

function registered(slot: number, card: CardIdentifier, rules: Rules): Ability | undefined {
    const entry = rules.registeredRules().find((rule) => rule.slot === slot);
    return entry && cardKey(entry.source.card) === cardKey(card) ? entry.ability : undefined;
}

/**
 * Visible price before conditional discounts that become later decisions.
 * The engine remains authoritative when the action resolves.
 */
export function actionCost(action: PlayerAction, rules: Rules): Cost[] {
    const scope = (card: CardIdentifier): RuleScope => ({ source: { card, player: action.player, kind: "Ability" }, selected: [], parent: [] });
    switch (action.type) {
        case "Play": {
            const alternate = action.alternateCost;
            if (!alternate) return ink(rules.cost(action.card));
            if ("playRule" in alternate) {
                const rule = rules.definition(action.card).playRules?.[alternate.playRule];
                return rule?.type === "Alternate Cost" ? rules.playCosts(action.card, rule.cost, scope(action.card)) : ink(rules.cost(action.card));
            }
            const supplied = rules
                .alternateCosts(action.card, "Play")
                .find((entry) => entry.origin && cardKey(entry.origin.card) === cardKey(alternate.card) && entry.origin.i === alternate.i);
            return supplied ? rules.playCosts(action.card, supplied.rule.cost, supplied.scope) : [];
        }
        case "Shift": {
            const alternate = action.alternateCost;
            const supplied = alternate
                ? rules
                      .alternateCosts(action.card, "Shift", action.onto[0])
                      .find((entry) => entry.origin && cardKey(entry.origin.card) === cardKey(alternate.card) && entry.origin.i === alternate.i)
                : undefined;
            const ability =
                action.ability !== undefined ? rules.definition(action.card).abilities?.[action.ability] : registered(action.rule, action.card, rules);
            const base = supplied?.rule.cost ?? (ability?.type === "Keyword" && ability.keyword.name === "Shift" ? ability.keyword.cost : []);
            return rules.shiftCosts(action.card, base, supplied?.scope ?? scope(action.card), action.onto, false);
        }
        case "Move": {
            const alternate = action.alternateCost;
            if (!alternate) return ink(rules.moveCost(action.card, action.location));
            const supplied = rules
                .alternateCosts(action.card, "Move", action.location)
                .find((entry) => entry.origin && cardKey(entry.origin.card) === cardKey(alternate.card) && entry.origin.i === alternate.i);
            return supplied ? rules.movementCosts(action.card, action.location, supplied.rule.cost, supplied.scope) : [];
        }
        case "Quest":
            return rules.additionalCosts(action.card, "Quest");
        case "Challenge":
            return rules.additionalCosts(action.attacker, "Challenge");
        case "Activate":
            return rules.abilityCosts(activatedAbility(action, rules).ability.cost, action.free ?? false);
        case "Boost":
            return rules.abilityCosts(boostAbility(action, rules).keyword.cost, action.free ?? false);
        default:
            return [];
    }
}

function ink(amount: number): Cost[] {
    return amount ? [{ type: "Ink", amount }] : [];
}

/** Used by tests and the runner to confirm a payload contains only identities the recipient can see. */
export function hiddenIdentities(value: unknown, sees: Sight, found: CardIdentifier[] = []): CardIdentifier[] {
    if (value === null || typeof value !== "object") return found;
    if (Array.isArray(value)) {
        for (const entry of value) hiddenIdentities(entry, sees, found);
        return found;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.fullName === "string" && typeof record.i === "number" && !sees(record as unknown as CardIdentifier))
        found.push(record as unknown as CardIdentifier);
    for (const entry of Object.values(record)) hiddenIdentities(entry, sees, found);
    return found;
}
