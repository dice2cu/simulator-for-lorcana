// Plain-English labels for actions, costs, effects and observations. Best effort: an
// unfamiliar shape falls back to a generic phrase rather than failing.
import type {
    Amount,
    CardChange,
    CardIdentifier,
    CardSelection,
    Cost,
    Effect,
    PlayerActionDescription,
    PlayerCard,
    PlayerCardLocation,
    PlayerNumber,
    PlayerObservation,
    PlayerPayment,
    PlayerSelection,
} from "../simulator";

export const cardName = (card: PlayerCard | CardIdentifier | null | undefined): string => (!card || "hidden" in card ? "a hidden card" : card.fullName);

const list = (items: readonly string[]): string => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

export function amountText(amount: Amount | { upTo: Amount } | "Any" | "All"): string {
    if (typeof amount === "number") return String(amount);
    if (amount === "Any") return "any number";
    if (amount === "All") return "all";
    if ("upTo" in amount) return `up to ${amountText(amount.upTo)}`;
    if ("count" in amount) return `the number of ${selectionText(amount.count)}`;
    return "X";
}

function playerText(player: PlayerSelection | undefined): string {
    if (player === "You") return "you";
    if (player === "Opponents") return "each opponent";
    if (player === "All") return "each player";
    if (player === "Selected Player") return "the chosen player";
    return "a player";
}

export function selectionText(selection: CardSelection): string {
    if (selection === "Self") return "this card";
    if (selection === "Selected Cards") return "the chosen cards";
    if (selection === "Parent Selected Cards") return "those cards";
    if (selection === "Affected Card") return "that card";
    if ("zone" in selection) {
        const owner = selection.player === "You" ? "your " : selection.player === "Opponents" ? "opposing " : "";
        const kind = selection.cardType ? `${selection.cardType.toLowerCase()}s` : "cards";
        const zone = selection.zone === "Play" || selection.zone === "Any" ? "" : ` in ${selection.zone === "Deck" ? "the deck" : selection.zone.toLowerCase()}`;
        const take = selection.take !== undefined ? `the top ${amountText(selection.take)} ` : "";
        return `${take}${selection.where ? "matching " : ""}${owner}${kind}${zone}`;
    }
    if ("result" in selection) return `the ${selection.result.toLowerCase()}`;
    if ("event" in selection && typeof selection.event === "string") return `the ${selection.event.toLowerCase()}`;
    if ("challengeParticipant" in selection) return `the ${selection.challengeParticipant.toLowerCase()}`;
    if ("locationOf" in selection) return `the location of ${selectionText(selection.locationOf)}`;
    if ("union" in selection) return list(selection.union.map(selectionText));
    if ("filter" in selection) return `matching ${selectionText(selection.filter)}`;
    if ("cards" in selection && Array.isArray(selection.cards)) return list(selection.cards.map(cardName));
    if ("capture" in selection) return selectionText(selection.capture);
    if ("atEvent" in selection) return selectionText(selection.cards);
    if ("difference" in selection) return `other ${selectionText(selection.difference[0])}`;
    return "cards";
}

function changeText(change: CardChange): string {
    if ("stat" in change) {
        const value = typeof change.amount === "number" ? `${change.amount >= 0 ? "+" : ""}${change.amount}` : "+X";
        return `${value} ${change.stat.toLowerCase()}`;
    }
    if ("gainKeyword" in change) return change.gainKeyword + (change.amount !== undefined ? ` +${amountText(change.amount)}` : "");
    if ("loseKeyword" in change) return `loses ${change.loseKeyword}`;
    if ("restriction" in change) return change.restriction.toLowerCase();
    if ("permission" in change) return change.permission.toLowerCase();
    if ("preventDamage" in change) return "prevents the next damage";
    if ("gainAbility" in change) return "gains an ability";
    if ("loseAbility" in change) return "loses abilities";
    if ("gainClassification" in change) return `becomes ${change.gainClassification}`;
    return "a change";
}

export function costText(costs: readonly Cost[]): string {
    if (!costs.length) return "free";
    return list(
        costs.map((cost) => {
            switch (cost.type) {
                case "Ink":
                    return `${amountText(cost.amount)} ink`;
                case "Exert":
                case "Banish":
                case "Discard":
                    return `${cost.type.toLowerCase()} ${selectionText(cost.cards)}`;
                case "Deal Damage":
                    return `${amountText(cost.amount)} damage to ${selectionText(cost.cards)}`;
                case "Lose Lore":
                    return `lose ${amountText(cost.amount)} lore`;
                case "Move Card":
                    return `put ${selectionText(cost.cards)} ${cost.to === "Hand" ? "into hand" : cost.to === "Under" ? "under a card" : "on the bottom of the deck"}`;
                case "Choose Cards":
                    return `choose ${cost.count} of ${selectionText(cost.from)} to ${costText(cost.cost)}`;
            }
        }),
    );
}

export function effectText(effect: Effect): string {
    switch (effect.type) {
        case "Sequence":
            return effect.effects.map(effectText).join(", then ");
        case "Choose Mode":
        case "Or":
            return `choose one: ${effect.options.map(effectText).join("; or ")}`;
        case "Do Then":
            return `${effectText(effect.do)}, then ${effectText(effect.then)}`;
        case "Optional":
            return `you may ${effectText(effect.effect)}`;
        case "Conditional":
            return `if able, ${effectText(effect.then)}`;
        case "Choose Cards":
            return `choose ${amountText(effect.count)} of ${selectionText(effect.from)}: ${effectText(effect.effect)}`;
        case "Random Cards":
            return `${amountText(effect.count)} random ${selectionText(effect.from)}: ${effectText(effect.effect)}`;
        case "Choose Player":
            return `choose a player: ${effectText(effect.effect)}`;
        case "For Each Player":
            return `for ${playerText(effect.players)}: ${effectText(effect.effect)}`;
        case "For Each Card":
            return `for each of ${selectionText(effect.cards)}: ${effectText(effect.effect)}`;
        case "Repeat":
            return `repeat: ${effectText(effect.effect)}`;
        case "Pay Cost":
            return `pay ${costText(effect.cost)} to ${effectText(effect.then)}`;
        case "Draw":
            return `${playerText(effect.player)} draw${effect.player === "You" ? "" : "s"} ${amountText(effect.amount)} card${effect.amount === 1 ? "" : "s"}`;
        case "Gain Lore":
        case "Lose Lore":
        case "Gain Ink Drops": {
            const [verb, ...rest] = effect.type.toLowerCase().split(" ");
            const noun = rest.join(" ");
            return `${playerText(effect.player)} ${verb}${effect.player === "You" ? "" : "s"} ${amountText(effect.amount)} ${noun}`;
        }
        case "Gain Control":
            return `take control of ${selectionText(effect.cards)}`;
        case "Discard":
        case "Banish":
        case "Exert":
        case "Ready":
            return `${effect.type.toLowerCase()} ${selectionText(effect.cards)}`;
        case "Deal Damage":
        case "Put Damage":
            return `${effect.type === "Deal Damage" ? "deal" : "put"} ${amountText(effect.amount)} damage ${effect.type === "Deal Damage" ? "to" : "on"} ${selectionText(effect.cards)}`;
        case "Remove Damage":
            return `remove ${amountText(effect.amount)} damage from ${selectionText(effect.cards)}`;
        case "Move Damage":
            return `move ${amountText(effect.amount)} damage from ${selectionText(effect.from)} to ${selectionText(effect.to)}`;
        case "Move Card": {
            const cards = selectionText(effect.cards);
            switch (effect.to) {
                case "Hand":
                    return `return ${cards} to hand`;
                case "Discard":
                    return `put ${cards} into the discard`;
                case "Inkwell":
                    return `put ${cards} into the inkwell${effect.exerted ? " exerted" : ""}`;
                case "Under":
                    return `put ${cards} under ${selectionText(effect.under)}`;
                case "Deck":
                    return effect.position === "Shuffle" ? `shuffle ${cards} into the deck` : `put ${cards} on the ${effect.position.toLowerCase()} of the deck`;
            }
        }
        case "Play":
            return `play ${selectionText(effect.cards)}${effect.free ? " for free" : ""}`;
        case "Shuffle":
            return `${playerText(effect.player)} shuffle${effect.player === "You" ? "" : "s"} the deck`;
        case "Move To Location":
            return `move ${selectionText(effect.cards)} to ${selectionText(effect.location)}`;
        case "Look":
            return `look at ${selectionText(effect.cards)}`;
        case "Reveal":
            return `reveal ${selectionText(effect.cards)}`;
        case "Search":
            return `search for ${amountText(effect.count)} of ${selectionText(effect.from)}: ${effectText(effect.effect)}`;
        case "Reveal Until":
            return "reveal cards until one matches";
        case "Name Card":
            return "name a card";
        case "Modify Cards":
            return `${selectionText(effect.cards)}: ${changeText(effect.modifier)}`;
        case "Modify Players":
            return `a change for ${playerText(effect.players)}`;
        case "Create Rule":
            return "create a lasting effect";
        case "Create Trigger":
            return "create a triggered effect";
        case "Delay":
            return `at the end of the turn, ${effectText(effect.effect)}`;
    }
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** A button label for an action option, such as "Challenge Lady - Family Dog with Pete - Games Referee". */
export function actionText(action: PlayerActionDescription): string {
    switch (action.type) {
        case "Ink":
            return `Ink ${action.card.fullName}`;
        case "Play":
            return `Play ${action.card.fullName}`;
        case "Shift":
            return `Shift ${action.card.fullName} onto ${list(action.onto.map(cardName))}`;
        case "Sing":
            return `Sing ${action.song.fullName} with ${list(action.singers.map(cardName))}`;
        case "Quest":
            return `Quest with ${action.card.fullName}`;
        case "Challenge":
            return `Challenge ${action.defender.fullName} with ${action.attacker.fullName}`;
        case "Activate":
            return `Use ${action.card.fullName}${action.definition.name ? `: ${capitalize(action.definition.name.toLowerCase())}` : ""}`;
        case "Boost":
            return `Boost ${action.card.fullName}`;
        case "Move":
            return `Move ${action.card.fullName} to ${action.location.fullName}`;
        case "End Turn":
            return "End turn";
        case "Alter Hand":
            return action.cards.length ? `Put back ${plural(action.cards.length, "card")}` : "Keep hand";
    }
}

/** The card an action option is about, for filtering options by a clicked card. */
export function actionCards(action: PlayerActionDescription): CardIdentifier[] {
    switch (action.type) {
        case "Sing":
            return [action.song, ...action.singers];
        case "Challenge":
            return [action.attacker, action.defender];
        case "Shift":
            return [action.card, ...action.onto];
        case "Move":
            return [action.card, action.location];
        case "End Turn":
        case "Alter Hand":
            return [];
        default:
            return [action.card];
    }
}

export function paymentText(payment: readonly PlayerPayment[]): string {
    if (!payment.length) return "Pay nothing";
    return capitalize(
        list(
            payment.map((part) => {
                switch (part.type) {
                    case "Ink":
                        return `${plural(part.cards.length, "ink")}${part.inkDrops ? ` and ${plural(part.inkDrops, "ink drop")}` : ""}`;
                    case "Lose Lore":
                        return `lose ${part.amount} lore`;
                    case "Deal Damage":
                        return `${part.amount} damage to ${list(part.cards.map(cardName))}`;
                    case "Move Card":
                        return `move ${list(part.cards.map(cardName))}`;
                    default:
                        return `${part.type.toLowerCase()} ${list(part.cards.map(cardName))}`;
                }
            }),
        ),
    );
}

const who = (player: PlayerNumber, viewer: PlayerNumber | undefined): string => (player === viewer ? "You" : `Player ${player}`);

const zoneText = (location: PlayerCardLocation): string => (location.zone === "Deck" ? "deck" : location.zone === "Play" ? "play" : location.zone.toLowerCase());

/**
 * Lines for a game log, from one player's observations. Moves an action already
 * explains, such as a played card leaving the hand, are left out.
 */
export function observationText(observation: PlayerObservation, viewer?: PlayerNumber): string | undefined {
    switch (observation.type) {
        case "Action": {
            const action = observation.action;
            const label = actionText(action);
            return `${who(action.player, viewer)}: ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
        }
        case "Choose Trigger":
            return observation.source ? `${who(observation.player, viewer)} resolve${observation.player === viewer ? "" : "s"} ${observation.source.card.fullName}: ${effectText(observation.effect)}` : undefined;
        case "Reveal":
            return `Revealed: ${list(observation.cards.map(cardName))}`;
        case "Look":
            return `Looked at: ${list(observation.cards.map(cardName))}`;
        case "Shuffle":
            return undefined;
        case "Move Cards": {
            const { from, to, cards } = observation;
            if (from.zone === "Hand" && (to.zone === "Play" || to.zone === "Inkwell")) return undefined;
            if (from.zone === "Deck" && to.zone === "Hand") return `${who(to.player, viewer)} drew ${cards.every((card) => !card) ? plural(cards.length, "card") : list(cards.map(cardName))}`;
            if (from.zone === "Hand" && to.zone === "Deck") return undefined;
            if (from.zone === "Play" && to.zone === "Discard") return `${list(cards.map(cardName))} ${cards.length === 1 ? "was" : "were"} banished`;
            if (from.zone === "Hand" && to.zone === "Discard") return `${who(from.player, viewer)} discarded ${list(cards.map(cardName))}`;
            return `${list(cards.map(cardName))}: ${zoneText(from)} → ${zoneText(to)}`;
        }
    }
}
