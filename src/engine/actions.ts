import type { PlayerAction } from "../model/turn";
import type { GameState } from "../model/game-state";
import type { CardIdentifier, PlayerNumber } from "../model/identity";
import { Rules } from "./rules";
import { sameCard } from "./identity";
import type { CardRestriction } from "../model/ability";
import { canPayCosts, canPayTogether } from "./costs";
export { canPayCosts } from "./costs";
import type { RuleScope, RecordedEvent, EngineOptions, RegisteredRule } from "./rules";

export interface ActionContext {
    /** Turn-local accounting. It is reconstructed from the accepted inputs. */
    inked?: number;
    usedAbilities?: readonly { card: CardIdentifier; ability: number; uses: number }[];
    history?: readonly RecordedEvent[];
    grantedRules?: readonly (RegisteredRule & { rule: number; uses: number })[];
}

/** The physical card carrying out an action. Ending a turn has no such card. */
export function cardInAction(action: PlayerAction): CardIdentifier | undefined {
    if ("card" in action) return action.card;
    if (action.type === "Sing") return action.song;
    if (action.type === "Challenge") return action.attacker;
    if (action.type === "Activate" && "ability" in action) return action.ability.card;
    return undefined;
}

/** Challenge legality for a specific pair, independent of whose turn is currently being simulated. */
export function canChallenge(rules: Rules, attacker: CardIdentifier, defender: CardIdentifier): boolean {
    return canAttack(rules, attacker) && isChallengeable(rules, attacker, defender);
}

/** Whether a character in play can challenge at all, before a defender is chosen. */
function canAttack(rules: Rules, attacker: CardIdentifier): boolean {
    const a = rules.locate(attacker);
    if (!a?.state || a.zone !== "Play" || rules.definition(attacker).type !== "Character") return false;
    if (a.state.exerted || (a.state.drying && !rules.keyword(attacker, "Rush"))) return false;
    const scope: RuleScope = { source: { card: attacker, player: a.player, kind: "Ability" }, selected: [], parent: [] };
    return (
        !rules.restricted(attacker, "Can't Challenge") &&
        rules.belowChallengeLimit(attacker, a.player) &&
        canPayCosts(rules, a.player, rules.additionalCosts(attacker, "Challenge"), scope)
    );
}

/** Whether an attacker that can challenge may choose this defender, including Evasive and Bodyguard. */
function isChallengeable(rules: Rules, attacker: CardIdentifier, defender: CardIdentifier): boolean {
    const a = rules.locate(attacker),
        d = rules.locate(defender);
    if (!a || d?.zone !== "Play" || !d.state || a.player === d.player) return false;
    const scope: RuleScope = { source: { card: attacker, player: a.player, kind: "Ability" }, selected: [], parent: [] };
    const eligible = (card: CardIdentifier): boolean => {
        const state = rules.locate(card)?.state;
        if (!state || rules.restricted(card, "Can't Be Challenged", attacker, a.player) || rules.restricted(attacker, "Can't Challenge", card, d.player))
            return false;
        const definition = rules.definition(card);
        if (definition.type === "Location") return true;
        if (definition.type !== "Character") return false;
        if (
            !state.exerted &&
            !rules
                .modifiers(attacker)
                .some((m) => "permission" in m && m.permission === "Can Challenge Ready Characters" && (!m.where || rules.matches(card, m.where, scope)))
        )
            return false;
        return !rules.keyword(card, "Evasive") || Boolean(rules.keyword(attacker, "Evasive") || rules.keyword(attacker, "Alert"));
    };
    if (!eligible(defender)) return false;
    if (rules.definition(defender).type === "Location" || rules.keyword(defender, "Bodyguard")) return true;
    return !rules
        .player(d.player)
        .play.some((state) => rules.definition(state.card).type === "Character" && rules.keyword(state.card, "Bodyguard") && eligible(state.card));
}

/** Lore victory is a rule query, not a stored result on the position. */
export function winningPlayers(position: GameState, options: EngineOptions = {}, context: ActionContext = {}): PlayerNumber[] {
    return winners(new Rules(position, options.card, { history: context.history, usedAbilities: context.usedAbilities }));
}

/** Players at or above their victory lore, read through existing queries for the position. */
export function winners(rules: Rules): PlayerNumber[] {
    return rules.players().filter((player) => rules.player(player).lore >= rules.victoryLore(player));
}

/** Concrete intentions. Payment resources and resolving choices are requested later. */
/**
 * `queries` may supply existing Rules for this exact position and turn context,
 * so a live evaluator does not recompute what it already knows about the position.
 */
export function getLegalActions(position: GameState, options: EngineOptions = {}, context: ActionContext = {}, queries?: Rules): PlayerAction[] {
    const rules = queries?.position === position ? queries : new Rules(position, options.card, { history: context.history, usedAbilities: context.usedAbilities });
    if (winners(rules).length) return [];
    const player = position.turn.player,
        p = rules.player(player);
    const ink = rules.availableInk(player);
    const scope = (card: CardIdentifier) => ({
        source: { card, player, kind: "Ability" as const },
        selected: [],
        parent: [],
    });
    const restricted = (card: CardIdentifier, name: CardRestriction): boolean => rules.restricted(card, name);
    const ready = p.play.filter((state) => !state.exerted && !state.drying && rules.definition(state.card).type === "Character");
    const actions: PlayerAction[] = [];
    const changes = rules.playerChanges(player);
    const inkLimit = 1 + changes.reduce((sum, m) => sum + ("additionalInk" in m ? m.additionalInk : 0), 0);
    const candidates = [
        ...p.hand,
        ...p.discard.filter((card) => rules.permittedZone(card, player, "Play") || rules.permittedZone(card, player, "Ink")),
        ...p.play.flatMap((state) => state.under?.map((entry) => entry.card).filter((card) => rules.permittedZone(card, player, "Play")) ?? []),
    ];
    for (const card of candidates) {
        const definition = rules.definition(card);
        if ((context.inked ?? 0) < inkLimit && rules.permittedZone(card, player, "Ink") && rules.inkable(card)) actions.push({ type: "Ink", player, card });
        const cannotPlay = changes.some((m) => "restriction" in m && m.restriction === "Can't Play" && (!m.where || rules.matches(card, m.where, scope(card))));
        const requirements = definition.playRules?.filter((rule) => rule.type === "Requirement") ?? [];
        if (
            rules.permittedZone(card, player, "Play") &&
            !cannotPlay &&
            !restricted(card, "Can't Be Played") &&
            requirements.every((rule) => rule.type !== "Requirement" || rules.condition(rule.when, scope(card)))
        ) {
            if (rules.cost(card, true) <= ink) actions.push({ type: "Play", player, card });
            for (const [playRule, rule] of (definition.playRules ?? []).entries()) {
                if (
                    rule.type === "Alternate Cost" &&
                    (!rule.when || rules.condition(rule.when, scope(card))) &&
                    canPayCosts(rules, player, rules.playCosts(card, rule.cost, scope(card)), scope(card))
                ) {
                    actions.push({ type: "Play", player, card, alternateCost: { playRule } });
                }
            }
            for (const entry of rules.alternateCosts(card, "Play"))
                if (entry.origin && canPayCosts(rules, player, rules.playCosts(card, entry.rule.cost, entry.scope), entry.scope))
                    actions.push({ type: "Play", player, card, alternateCost: entry.origin });
            if (definition.type === "Action" && p.hand.some((other) => sameCard(other, card))) {
                for (const rule of definition.playRules ?? []) {
                    if (rule.type === "Sing")
                        for (const singer of ready) {
                            if (
                                rules.characteristic(singer.card, "Cost To Sing") >= rule.cost &&
                                !restricted(singer.card, "Can't Sing") &&
                                !restricted(singer.card, "Can't Sing Without Sing Together")
                            ) {
                                actions.push({ type: "Sing", player, song: card, singers: [singer.card] });
                            }
                        }
                    if (rule.type === "Sing Together") {
                        const candidates = ready.filter((state) => !restricted(state.card, "Can't Sing"));
                        const groups = (index: number, singers: typeof p.hand, value: number): void => {
                            if (index === candidates.length) {
                                if (singers.length && value >= rule.cost) actions.push({ type: "Sing", player, song: card, singers });
                                return;
                            }
                            groups(index + 1, singers, value);
                            groups(index + 1, [...singers, candidates[index].card], value + rules.characteristic(candidates[index].card, "Cost To Sing"));
                        };
                        groups(0, [], 0);
                    }
                }
            }
            for (const [i, ability] of (definition.abilities ?? []).entries()) {
                if (ability.type !== "Keyword" || ability.keyword.name !== "Shift") continue;
                if (!rules.abilityActive(card, ability)) continue;
                const shift = ability.keyword;
                for (const onto of rules.shiftGroups(card, shift, scope(card))) {
                    if (canPayCosts(rules, player, rules.shiftCosts(card, shift.cost, scope(card), onto), scope(card)))
                        actions.push({ type: "Shift", player, card, onto, ability: i });
                    for (const entry of rules.alternateCosts(card, "Shift", onto[0]))
                        if (entry.origin && canPayCosts(rules, player, rules.shiftCosts(card, entry.rule.cost, entry.scope, onto), entry.scope))
                            actions.push({ type: "Shift", player, card, onto, ability: i, alternateCost: entry.origin });
                }
            }
        }
    }
    for (const state of p.play) {
        const definition = rules.definition(state.card);
        for (const [i, ability] of (definition.abilities ?? []).entries()) {
            if (!rules.abilityActive(state.card, ability)) continue;
            if (ability.type === "Keyword" && ability.keyword.name === "Boost") {
                const used = context.usedAbilities?.some((use) => sameCard(use.card, state.card) && use.ability === i && use.uses > 0);
                if (!used && p.deck.length && canPayCosts(rules, player, ability.keyword.cost, scope(state.card)))
                    actions.push({ type: "Boost", player, card: state.card, ability: i });
                if (
                    !used &&
                    p.deck.length &&
                    rules.freeAbility(state.card, "Boost") &&
                    canPayCosts(rules, player, rules.abilityCosts(ability.keyword.cost, true), scope(state.card))
                )
                    actions.push({ type: "Boost", player, card: state.card, ability: i, free: true });
            }
        }
        if (definition.type !== "Character") continue;
        if (
            !state.exerted &&
            (!state.drying || rules.modifiers(state.card).some((m) => "permission" in m && m.permission === "Can Quest The Turn Played")) &&
            !rules.keyword(state.card, "Reckless") &&
            !restricted(state.card, "Can't Quest") &&
            canPayCosts(rules, player, rules.additionalCosts(state.card, "Quest"), scope(state.card))
        )
            actions.push({ type: "Quest", player, card: state.card });
        if (canAttack(rules, state.card))
            for (const opponent of rules.players())
                if (opponent !== player)
                    for (const target of rules.player(opponent).play)
                        if (isChallengeable(rules, state.card, target.card)) actions.push({ type: "Challenge", player, attacker: state.card, defender: target.card });
        if (!restricted(state.card, "Can't Move"))
            for (const location of p.play) {
                const target = rules.definition(location.card);
                if (
                    target.type === "Location" &&
                    rules.moveCost(state.card, location.card, true) <= ink &&
                    (!state.location || !sameCard(state.location, location.card))
                ) {
                    actions.push({ type: "Move", player, card: state.card, location: location.card });
                }
                if (target.type === "Location" && (!state.location || !sameCard(state.location, location.card)))
                    for (const entry of rules.alternateCosts(state.card, "Move", location.card)) {
                        if (
                            entry.origin &&
                            canPayCosts(rules, player, rules.movementCosts(state.card, location.card, entry.rule.cost, entry.scope), entry.scope)
                        )
                            actions.push({ type: "Move", player, card: state.card, location: location.card, alternateCost: entry.origin });
                    }
            }
    }
    for (const { card, player: holder, ability, slot: i } of rules.printedRules()) {
        if (ability.type !== "Activated") continue;
        if (!rules.abilityActive(card, ability)) continue;
        const sourceScope: RuleScope = { source: { card, player: holder, kind: "Ability" }, selected: [], parent: [] };
        if (ability.by ? !rules.selectPlayers(ability.by, sourceScope).includes(player) : holder !== player) continue;
        if (ability.when && !rules.condition(ability.when, sourceScope)) continue;
        const uses = context.usedAbilities?.find((use) => sameCard(use.card, card) && use.ability === i)?.uses ?? 0;
        if (ability.limit && uses >= ability.limit.perTurn) continue;
        const together = ability.by && typeof ability.by === "object" && "together" in ability.by ? rules.selectPlayers(ability.by, sourceScope) : undefined;
        if (together ? canPayTogether(rules, together, ability.cost, sourceScope) : canPayCosts(rules, player, ability.cost, sourceScope))
            actions.push({ type: "Activate", player, ability: { card, i } });
        if (rules.freeAbility(card, ability) && canPayCosts(rules, player, rules.abilityCosts(ability.cost, true), sourceScope))
            actions.push({ type: "Activate", player, ability: { card, i }, free: true });
    }
    const mandatory = actions.filter(
        (action) =>
            (action.type === "Challenge" && rules.keyword(action.attacker, "Reckless") && !rules.additionalCosts(action.attacker, "Challenge").length) ||
            (action.type === "Quest" && restricted(action.card, "Must Quest") && !rules.additionalCosts(action.card, "Quest").length),
    );
    const granted = context.grantedRules ?? rules.registeredRules().flatMap((entry, rule) => (entry.grant ? [{ ...entry, rule, uses: 0 }] : []));
    for (const entry of granted) {
        const ability = entry.ability;
        if (entry.source.player !== player) continue;
        const s: RuleScope = { source: entry.source, selected: [], parent: [] };
        if (ability.type === "Keyword") {
            if (ability.keyword.name !== "Shift" && ability.keyword.name !== "Boost") continue;
            if (ability.keyword.name === "Shift" && rules.permittedZone(entry.source.card, player, "Play")) {
                for (const onto of rules.shiftGroups(entry.source.card, ability.keyword, s)) {
                    if (canPayCosts(rules, player, rules.shiftCosts(entry.source.card, ability.keyword.cost, s, onto), s))
                        actions.push({ type: "Shift", player, card: entry.source.card, onto, rule: entry.rule });
                    for (const alternate of rules.alternateCosts(entry.source.card, "Shift", onto[0]))
                        if (
                            alternate.origin &&
                            canPayCosts(rules, player, rules.shiftCosts(entry.source.card, alternate.rule.cost, alternate.scope, onto), alternate.scope)
                        )
                            actions.push({ type: "Shift", player, card: entry.source.card, onto, rule: entry.rule, alternateCost: alternate.origin });
                }
            } else if (ability.keyword.name === "Boost" && !entry.uses && p.deck.length) {
                if (canPayCosts(rules, player, ability.keyword.cost, s)) actions.push({ type: "Boost", player, card: entry.source.card, rule: entry.rule });
                if (rules.freeAbility(entry.source.card, "Boost") && canPayCosts(rules, player, rules.abilityCosts(ability.keyword.cost, true), s))
                    actions.push({ type: "Boost", player, card: entry.source.card, rule: entry.rule, free: true });
            }
            continue;
        }
        if (ability.type !== "Activated") continue;
        if ((ability.when && !rules.condition(ability.when, s)) || (ability.limit && entry.uses >= ability.limit.perTurn)) continue;
        if (canPayCosts(rules, player, ability.cost, s)) actions.push({ type: "Activate", player, card: entry.source.card, rule: entry.rule });
        if (rules.freeAbility(entry.source.card, ability) && canPayCosts(rules, player, rules.abilityCosts(ability.cost, true), s))
            actions.push({ type: "Activate", player, card: entry.source.card, rule: entry.rule, free: true });
    }
    if (!mandatory.length) actions.push({ type: "End Turn", player });
    return actions;
}
