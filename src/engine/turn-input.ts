import type { CardIdentifier } from '../model/identity';
import type { DecisionAnswer, TurnRequest, TurnStep } from '../model/turn';
import { sameCard } from './identity';
import { InvalidInput } from './invalid-input';

function integer(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }

function cardsFrom(cards: readonly CardIdentifier[], candidates: readonly CardIdentifier[]): boolean {
    return Array.isArray(cards) && cards.every((card, i) => card !== null && typeof card === 'object' &&
        typeof card.fullName === 'string' && integer(card.i) && candidates.some(candidate => sameCard(card, candidate)) &&
        !cards.slice(0, i).some(other => sameCard(card, other)));
}

/**
 * Checks typed inputs against a request without changing either value. The evaluator
 * must also check board legality, set-wide conditions and complete cost payability.
 */
export function assertRequestedInput(request: TurnRequest, step: TurnStep): void {
    if (!step || typeof step !== 'object') throw new InvalidInput('Expected a turn input');
    if (request.type === 'Action') {
        if (step.type !== 'Action' || !request.actions.some(action => sameValue(action, step.action))) {
            throw new InvalidInput('Expected a legal action');
        }
        return;
    }
    if (request.type === 'Shuffle' || request.type === 'Random Cards') {
        if (step.type !== 'Random' || !step.outcome || step.outcome.type !== request.type) throw new InvalidInput('Expected the requested random outcome');
        const count = request.type === 'Shuffle' ? request.cards.length : request.count;
        if (!integer(count) || !Array.isArray(step.outcome.cards) || step.outcome.cards.length !== count || !cardsFrom(step.outcome.cards, request.cards)) {
            throw new InvalidInput('Random outcome must have the requested count and eligible, distinct cards');
        }
        return;
    }
    if (step.type !== 'Decision' || !step.answer || step.answer.type !== request.type) throw new InvalidInput('Expected the requested decision answer');
    const answer: DecisionAnswer = step.answer;
    let valid = false;
    switch (request.type) {
        case 'Choose Cards':
            valid = answer.type === 'Choose Cards' && integer(request.min) && integer(request.max) &&
                Array.isArray(answer.cards) && answer.cards.length >= request.min && answer.cards.length <= request.max && cardsFrom(answer.cards, request.cards);
            break;
        case 'Order Cards':
            valid = answer.type === 'Order Cards' && Array.isArray(answer.cards) && answer.cards.length === request.cards.length && cardsFrom(answer.cards, request.cards);
            break;
        case 'Choose Player': valid = answer.type === 'Choose Player' && request.players.includes(answer.player); break;
        case 'Choose Mode': valid = answer.type === 'Choose Mode' && integer(answer.mode) && request.options.some(option => option.mode === answer.mode); break;
        case 'Choose Amount':
            valid = answer.type === 'Choose Amount' && integer(answer.amount) && answer.amount >= request.min && answer.amount <= request.max;
            break;
        case 'Choose Trigger':
            valid = answer.type === 'Choose Trigger' && Boolean(answer.trigger) && request.options.some(option => option.reference.event === answer.trigger.event &&
                option.reference.rule === answer.trigger.rule);
            break;
        case 'Choose Replacement':
            valid = answer.type === 'Choose Replacement' && request.options.some(option => option.reference === answer.replacement);
            break;
        case 'Pay Cost': {
            // This request does not list eligible resources. Its evaluator validator
            // must check availability and that the complete plan satisfies the cost.
            if (answer.type !== 'Pay Cost') break;
            if (answer.pay === false) { valid = request.optional; break; }
            if (answer.pay !== true || !Array.isArray(answer.payment)) break;
            const payers = typeof request.player === 'number' ? [request.player] : request.player.together;
            valid = answer.payment.every(payment => payment !== null && typeof payment === 'object' && payers.includes(payment.player) &&
                (payment.type === 'Lose Lore' ? integer(payment.amount) :
                    ['Ink', 'Exert', 'Discard', 'Banish', 'Deal Damage', 'Move Card'].includes(payment.type) && 'cards' in payment && cardsFrom(payment.cards, payment.cards)) &&
                (payment.type !== 'Move Card' || ['Hand', 'Deck Bottom', 'Under'].includes(payment.to) &&
                    (payment.to !== 'Under' || payment.under !== undefined && cardsFrom([payment.under], [payment.under]))) &&
                (!('cards' in payment) || cardsFrom(payment.cards, payment.cards)) &&
                (!('amount' in payment) || integer(payment.amount)) &&
                (!('inkDrops' in payment) || payment.inkDrops === undefined || integer(payment.inkDrops)));
            // Paying twice with the same ink card is invalid even across shared contributions.
            const ink = valid ? answer.payment.flatMap(payment => payment.type === 'Ink' ? payment.cards : []) : [];
            valid = valid && cardsFrom(ink, ink);
            break;
        }
        case 'Optional': valid = answer.type === 'Optional' && typeof answer.accept === 'boolean'; break;
        case 'Optional Cost Rule': valid = answer.type === 'Optional Cost Rule' && typeof answer.accept === 'boolean'; break;
        case 'Name Card': valid = answer.type === 'Name Card' && typeof answer.name === 'string' && answer.name.trim().length > 0; break;
        case 'Distribute Damage Removal':
            valid = answer.type === 'Distribute Damage Removal' && Array.isArray(answer.amounts) && answer.amounts.every(part => part !== null && typeof part === 'object') && cardsFrom(answer.amounts.map(part => part.card), request.cards.map(part => part.card)) &&
                answer.amounts.every(part => integer(part.amount) && request.cards.some(candidate => sameCard(candidate.card, part.card) && part.amount <= candidate.max)) &&
                answer.amounts.reduce((sum, part) => sum + part.amount, 0) <= request.max;
            break;
        default: { const unsupported: never = request; throw new Error(`Unsupported request: ${String(unsupported)}`); }
    }
    if (!valid) throw new InvalidInput(`Invalid ${request.type} answer`);
}

/** Object property order is not part of a recorded intention's meaning. */
function sameValue(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, i) => sameValue(value, right[i]));
    }
    const a = Object.entries(left).filter(([, value]) => value !== undefined);
    const b = Object.entries(right).filter(([, value]) => value !== undefined);
    return a.length === b.length && a.every(([key, value]) => b.some(([other, candidate]) => key === other && sameValue(value, candidate)));
}
