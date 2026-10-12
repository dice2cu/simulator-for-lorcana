import type { Amount, CardChange, CardFilter, CardRestriction, CardSelection, CardSelector, Condition, Duration, Effect,
    EventPattern, PlayerSelection } from '../model/ability';
import { Unsupported } from './text';
import { type Parser, type Step, cardRef, effectStep, fold, isCardRef, isSingle, nextId, playerRef, substitute } from './core';
import { type CardNP, amountOf, bareCards, cardNP, cards, cardsReference, classification, deckTop, digits, it, keyword,
    mergeFilters, number, playerNP, possessive, statSymbol, useCards, zonePhrase } from './nouns';
import { anyZone, cardKind, condition } from './conditions';
import { grantedAbility } from './abilities';

// ---------------------------------------------------------------------------
// Sentence structure

/**
 * Pending structure that may absorb later sentences. Steps stay flat so later
 * sentences can still refer back to cards chosen earlier.
 */
type Part =
    | { kind: 'Steps'; steps: Step[] }
    /**
     * "you may X", "X to Y" and "If you do". `required`: "X to Y" without "may".
     * `otherwise` runs when X was not done, e.g. "If they don't, ...".
     */
    | {
          kind: 'Optional'; player?: PlayerSelection; do: Step[]; then?: Step[]; otherwise?: Step[]; required?: boolean;
          /** "you may pay 1 {I} to X": X and anything referring to it run after paying. */
          pay?: import('../model/ability').Cost[];
      }
    /** `parts` stay unflattened so later sentences about its choices can join them. */
    | { kind: 'Conditional'; if: Condition; parts: Part[]; otherwise?: Step[] }
    /**
     * A per-player instruction, closed at the end of its clause unless later
     * sentences refer to its choices. `optional`: "Choose any number of players".
     */
    | { kind: 'Each'; scope: Step & { kind: 'For Each Player' }; parts: Part[]; optional?: boolean };

/** Placeholder for "repeat this effect", replaced by a Repeat around the whole effect. */
const repeatMarker: Effect = { type: 'Shuffle', player: { players: [] } };

/** Parse instructions until the end of the text or a mode bullet. */
export function instructions(c: Parser): Effect | undefined {
    const steps = sentences(c);
    if (!steps || !steps.length) return undefined;
    return repeated(fold(steps));
}

/** Wrap an effect that says "repeat this effect" in a Repeat until its condition fails. */
function repeated(effect: Effect): Effect {
    const marker = JSON.stringify(repeatMarker);
    const text = JSON.stringify(effect);
    if (!text.includes(marker)) return effect;
    let test: Condition | undefined;
    const strip = (value: Effect): Effect => {
        if (value.type === 'Conditional' && JSON.stringify(value.then).includes(marker)) test = value.if;
        return JSON.parse(JSON.stringify(value).split(',' + marker).join('').split(marker + ',').join('').split(marker).join(JSON.stringify(nothing))) as Effect;
    };
    const body = strip(effect);
    const find = (value: unknown): void => {
        if (Array.isArray(value)) return value.forEach(find);
        if (value === null || typeof value !== 'object') return;
        const node = value as Record<string, unknown>;
        if (node.type === 'Conditional' && JSON.stringify(node.then).includes(marker)) test = node.if as Condition;
        Object.values(node).forEach(find);
    };
    find(effect);
    if (!test) throw new Unsupported('"Repeat this effect" needs a condition to stop');
    return { type: 'Repeat', until: { not: test }, effect: body };
}

export function sentences(c: Parser): Step[] | undefined {
    const parts: Part[] = [];
    while (!c.done && !c.peek('•')) {
        const before = c.pos;
        const ok = sentence(c, parts);
        if (!ok || c.pos === before) return undefined;
    }
    return flatten(parts);
}

function ids(steps: readonly Step[]): number[] {
    return steps.flatMap(step => step.kind !== 'Effect' && step.kind !== 'For Each Player' && step.kind !== 'Choose Player'
        ? [step.id] : []);
}

/** Choice ids made inside parts, without folding them. */
function partIds(parts: readonly Part[]): number[] {
    return parts.flatMap(part => {
        switch (part.kind) {
            case 'Steps': return ids(part.steps);
            case 'Optional': return ids([...part.do, ...(part.then ?? [])]);
            case 'Conditional': return [...partIds(part.parts), ...ids(part.otherwise ?? [])];
            case 'Each': return partIds(part.parts);
        }
    });
}

function references(value: unknown, cardIds: readonly number[], playerIds: readonly number[] = []): boolean {
    if (!cardIds.length && !playerIds.length) return false;
    const text = JSON.stringify(value);
    return cardIds.some(id => text.includes(`{"$cards":${id}}`)) || playerIds.some(id => text.includes(`{"$player":${id}}`));
}

/**
 * "You may ready your other Princess characters. They can't quest for the rest of this turn."
 * A following change to exactly the cards the optional instruction acted on belongs to it.
 */
function restrictsSameCards(later: readonly Step[], done: readonly Step[]): boolean {
    const first = later[0];
    if (first?.kind !== 'Effect' || first.effect.type !== 'Modify Cards') return false;
    const target = JSON.stringify(first.effect.cards);
    return done.some(step => step.kind === 'Effect' && 'cards' in step.effect && JSON.stringify(step.effect.cards) === target);
}

function leadingScopes(steps: readonly Step[]): [Step[], Step[]] {
    let i = 0;
    while (i < steps.length && steps[i].kind !== 'Effect') i++;
    return [steps.slice(0, i), steps.slice(i)];
}

const nothing: Effect = { type: 'Sequence', effects: [] };

function foldOrEmpty(steps: readonly Step[]): Effect {
    if (!steps.length) throw new Unsupported('An instruction is missing');
    return fold(steps);
}

function optionalEffect(player: PlayerSelection | undefined, effect: Effect): Effect {
    // The player opting into an instruction also makes its implicit choices.
    // Explicit deciders still take precedence, and nested player scopes bind
    // their own choices separately before this wrapper is folded.
    const choose = (effect: Effect): Effect => {
        switch (effect.type) {
            case 'Choose Cards':
            case 'Choose Player':
                return { ...effect, player: effect.player ?? player, effect: choose(effect.effect) };
            case 'Choose Mode':
            case 'Or':
                return { ...effect, player: effect.player ?? player, options: effect.options.map(choose) };
            case 'Sequence': return { ...effect, effects: effect.effects.map(choose) };
            case 'Do Then': return { ...effect, do: choose(effect.do), then: choose(effect.then),
                ...(effect.otherwise ? { otherwise: choose(effect.otherwise) } : {}) };
            case 'Conditional': return { ...effect, then: choose(effect.then),
                ...(effect.otherwise ? { otherwise: choose(effect.otherwise) } : {}) };
            default: return effect;
        }
    };
    return { type: 'Optional', ...(player !== undefined && player !== 'You' ? { player } : {}),
        effect: player !== undefined && player !== 'You' ? choose(effect) : effect };
}

/** Turn pending parts into steps, letting a part absorb later steps that refer to its choices. */
function flatten(parts: Part[]): Step[] {
    const out: Step[] = [];
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.kind === 'Steps') { out.push(...part.steps); continue; }
        const later = flatten(parts.slice(i + 1));
        let absorb = false;
        switch (part.kind) {
            case 'Each': {
                absorb = references(later, partIds(part.parts), [part.scope.id]);
                const body = flatten(absorb ? [...part.parts, ...parts.slice(i + 1)] : part.parts);
                const inner = part.optional ? [effectStep(optionalEffect('You', foldOrEmpty(body)))] : body;
                out.push(effectStep(fold([part.scope, ...inner])));
                break;
            }
            case 'Optional': {
                const looked = part.do.some(step => step.kind === 'Effect' && step.effect.type === 'Look');
                absorb = references(later, ids([...part.do, ...(part.then ?? [])])) || (!part.then && restrictsSameCards(later, part.do)) ||
                    looked && JSON.stringify(later).includes('"result":"Looked At Cards"');
                if (part.pay) {
                    const thenSteps = [...(part.then ?? []), ...(absorb ? later : [])];
                    const payment: Effect = { type: 'Pay Cost', cost: part.pay, then: foldOrEmpty(thenSteps),
                        ...(part.player !== undefined && part.player !== 'You' ? { player: part.player } : {}) };
                    out.push(effectStep(optionalEffect(part.player, payment)));
                } else if (part.then) {
                    const thenSteps = absorb ? [...part.then, ...later] : part.then;
                    const [scopes, rest] = references(thenSteps, ids(part.do)) ? leadingScopes(part.do) : [[], part.do];
                    const doThen: Effect = rest.length ? { type: 'Do Then', do: fold(rest), then: foldOrEmpty(thenSteps),
                        ...(part.otherwise ? { otherwise: foldOrEmpty(part.otherwise) } : {}) } : foldOrEmpty(thenSteps);
                    const body = scopes.length ? fold([...scopes, effectStep(doThen)]) : doThen;
                    out.push(effectStep(part.required ? body : optionalEffect(part.player, body)));
                } else {
                    const doSteps = absorb ? [...part.do, ...later] : part.do;
                    const body = optionalEffect(part.player, foldOrEmpty(doSteps));
                    out.push(effectStep(part.otherwise
                        ? { type: 'Do Then', do: body, then: nothing, otherwise: foldOrEmpty(part.otherwise) } : body));
                }
                break;
            }
            case 'Conditional': {
                absorb = references(later, [...partIds(part.parts), ...ids(part.otherwise ?? [])]);
                // "If X, you may search ... Put that card into your hand.": later sentences about its choices belong to it.
                if (absorb && part.otherwise) throw new Unsupported('A later sentence refers to a choice made inside a condition');
                const otherwise = part.otherwise;
                const thenSteps = flatten(absorb ? [...part.parts, ...parts.slice(i + 1)] : part.parts);
                let scopes: Step[] = [];
                let thenRest = thenSteps;
                if (otherwise && references(otherwise, ids(thenSteps))) [scopes, thenRest] = leadingScopes(thenSteps);
                const conditional: Effect = { type: 'Conditional', if: part.if, then: foldOrEmpty(thenRest),
                    ...(otherwise ? { otherwise: foldOrEmpty(otherwise) } : {}) };
                out.push(...scopes, effectStep(conditional));
                break;
            }
        }
        if (!absorb) out.push(...later);
        return out;
    }
    return out;
}

function last<T>(items: T[]): T | undefined {
    return items[items.length - 1];
}

function endSentence(c: Parser): boolean {
    if (c.lit('.')) return true;
    return c.done || c.peek('•');
}

/** One printed sentence, possibly modifying earlier parts. */
function sentence(c: Parser, parts: Part[]): boolean {
    return c.try(() => {
        c.lit('then,', 'then');
        const previous = last(parts);
        // "If you do, ..." continues the previous optional instruction.
        const ifYouDo = c.try(() => {
            if (!previous || previous.kind !== 'Optional' || previous.then) return undefined;
            if (!c.lit('if you do')) return undefined;
            const also = c.try(() => c.lit('and') ? condition(c) : undefined);
            c.lit(',');
            const steps = chain(c);
            if (!steps || !endSentence(c)) return undefined;
            previous.then = also ? flatten([{ kind: 'Conditional', if: also, parts: [{ kind: 'Steps', steps }] }]) : steps;
            return true;
        });
        if (ifYouDo) return true;
        const either = c.try(() => {
            if (!c.lit('if you do either,')) return undefined;
            let first = parts.length - 1;
            while (first > 0 && parts[first - 1].kind === 'Optional' && !(parts[first - 1] as { then?: Step[] }).then) first--;
            const head = parts[first];
            if (!head || head.kind !== 'Optional' || head.then) return undefined;
            const steps = chain(c);
            if (!steps || !endSentence(c)) return undefined;
            head.then = [...flatten(parts.slice(first + 1)), ...steps];
            parts.splice(first + 1);
            return true;
        });
        if (either) return true;
        const dangerous = c.try(() => {
            if (previous?.kind !== 'Each') return undefined;
            if (!c.lit("each player who reveals a character card may play that character for free. otherwise, put the revealed cards on the bottom of their player's deck.")) return undefined;
            const player = playerRef(previous.scope.id);
            const revealed: CardSelection = { result: 'Revealed Cards' };
            const bottom: Effect = { type: 'Move Card', cards: revealed, to: 'Deck', position: 'Bottom' };
            previous.parts.push({ kind: 'Steps', steps: [effectStep({ type: 'Conditional', if: { exists: { filter: revealed, where: { cardType: 'Character' } } },
                then: { type: 'Do Then', do: optionalEffect(player, { type: 'Play', cards: revealed, free: true, player }), then: nothing, otherwise: bottom },
                otherwise: bottom })] });
            return true;
        });
        if (dangerous) return true;
        const remember = c.try(() => {
            if (!c.lit("for the rest of this turn, you may play characters from your discard. if you do, they enter play exerted and you can't play characters with the same name as characters you played this way this turn.")) return undefined;
            const played: CardSelection = { events: { event: 'Move Card', player: 'You', from: 'Discard', to: 'Play' }, during: 'This Turn' };
            parts.push({ kind: 'Steps', steps: [
                effectStep({ type: 'Create Rule', duration: { until: 'End Of Turn' }, rule: { type: 'Modify Players', players: 'You',
                    modifier: { permission: 'Can Play From Discard', cards: { zone: 'Discard', player: 'You', cardType: 'Character' }, exerted: true } } }),
                effectStep({ type: 'Create Rule', duration: { until: 'End Of Turn' }, rule: { type: 'Modify Players', players: 'You',
                    modifier: { restriction: "Can't Play", where: { cardType: 'Character', sameNameAs: played } } } }),
            ] });
            return true;
        });
        if (remember) return true;
        const bottom = c.try(() => {
            if (!c.lit('if you do, put that card on the bottom of your deck instead of into your discard.')) return undefined;
            return replaceEarlier(parts, ['Play'], effect => ({ ...effect, afterwards: 'Deck Bottom' } as Effect)) ? true : undefined;
        });
        if (bottom) return true;
        const declined = c.try(() => {
            if (!c.lit("if they don't,", "for each opponent who doesn't,")) return undefined;
            const optional = previous?.kind === 'Optional' ? previous
                : previous?.kind === 'Each' ? undefined : undefined;
            const steps = chain(c);
            if (!steps || !endSentence(c)) return undefined;
            if (optional && !optional.then) { optional.otherwise = steps; return true; }
            if (previous?.kind === 'Each') {
                const tail = previous.parts[previous.parts.length - 1];
                if (!tail || tail.kind !== 'Steps') return undefined;
                const body = tail.steps;
                const lastStep = body[body.length - 1];
                if (!lastStep || lastStep.kind !== 'Effect' || lastStep.effect.type !== 'Optional') return undefined;
                body[body.length - 1] = effectStep({ type: 'Do Then', do: lastStep.effect, then: nothing, otherwise: foldOrEmpty(steps) });
                return true;
            }
            return undefined;
        });
        if (declined) return true;
        const otherwise = c.try(() => {
            if (!previous || previous.kind === 'Steps' || previous.kind === 'Each' || previous.otherwise) return undefined;
            if (!c.lit('otherwise,', 'otherwise')) return undefined;
            const steps = chain(c);
            if (!steps || !endSentence(c)) return undefined;
            // "You may reveal the top card. If you do, you may play it. Otherwise, put it into your discard."
            // Otherwise answers the inner choice to play, not the reveal (Dash Parr - Super Fast).
            const inner = previous.kind === 'Optional' ? previous.then?.[previous.then.length - 1] : undefined;
            if (previous.kind === 'Optional' && previous.then && inner?.kind === 'Effect' && inner.effect.type === 'Optional') {
                previous.then[previous.then.length - 1] = effectStep({ type: 'Do Then', do: inner.effect, then: { type: 'Sequence', effects: [] }, otherwise: foldOrEmpty(steps) });
                return true;
            }
            previous.otherwise = steps;
            return true;
        });
        if (otherwise) return true;
        if (c.try(() => replacement(c, parts))) return true;
        if (c.try(() => amendment(c, parts))) return true;
        const modes = c.try(() => chooseOne(c));
        if (modes) { parts.push({ kind: 'Steps', steps: modes }); return true; }
        const byType = c.try(() => cardTypeModes(c));
        if (byType) { parts.push({ kind: 'Steps', steps: byType }); return true; }
        const conditional = c.try(() => {
            if (!c.lit('if')) return undefined;
            c.state.conditionSteps = [];
            const test = condition(c);
            const before = c.state.conditionSteps;
            c.state.conditionSteps = undefined;
            if (!test) return undefined;
            c.lit(',');
            const body = chainParts(c);
            if (!body || !endSentence(c)) return undefined;
            if (before.length) parts.push({ kind: 'Steps', steps: before });
            parts.push({ kind: 'Conditional', if: test, parts: body });
            return true;
        });
        if (conditional) return true;
        const body = chainParts(c);
        if (!body || !endSentence(c)) return undefined;
        parts.push(...body);
        return true;
    }) === true;
}

/** Effect steps of a part, for later sentences that modify them. */
function partSteps(part: Part): Step[] {
    switch (part.kind) {
        case 'Steps': return part.steps;
        case 'Optional': return part.then ?? part.do;
        case 'Conditional': {
            const tail = part.parts[part.parts.length - 1];
            return tail && tail.kind === 'Steps' ? tail.steps : [];
        }
        case 'Each': {
            const tail = part.parts[part.parts.length - 1];
            return tail && tail.kind === 'Steps' ? tail.steps : [];
        }
    }
}

/** Replace an earlier instruction, searching backwards for one of the given types. */
function replaceEarlier(parts: Part[], types: readonly string[], change: (effect: Effect) => Effect): boolean {
    for (let p = parts.length - 1; p >= 0; p--) {
        const list = partSteps(parts[p]);
        for (let i = list.length - 1; i >= 0; i--) {
            const step = list[i];
            if (step.kind !== 'Effect') continue;
            const found = findEffect(step.effect, types, change);
            if (found) { list[i] = effectStep(found); return true; }
        }
    }
    return false;
}

/** Find the last instruction of a type, looking into Optional and Do Then wrappers. */
function findEffect(effect: Effect, types: readonly string[], change: (effect: Effect) => Effect): Effect | undefined {
    if (types.includes(effect.type)) return change(effect);
    if (effect.type === 'Optional') {
        const inner = findEffect(effect.effect, types, change);
        return inner ? { ...effect, effect: inner } : undefined;
    }
    if (effect.type === 'Sequence') {
        for (let i = effect.effects.length - 1; i >= 0; i--) {
            const inner = findEffect(effect.effects[i], types, change);
            if (inner) return { ...effect, effects: effect.effects.map((e, j) => j === i ? inner : e) };
        }
    }
    return undefined;
}

/** "If ..., <instruction> instead." replaces the matching earlier instruction. */
function replacement(c: Parser, parts: Part[]): true | undefined {
    if (!c.lit('if')) return undefined;
    const test = condition(c);
    if (!test || !c.lit(',')) return undefined;
    const start = c.pos;
    const saved = { ...c.state };
    let steps = chain(c);
    if (!steps || !c.lit('instead')) {
        c.pos = start;
        c.state = saved;
        steps = amountOnly(c, parts);
        if (!steps || !c.lit('instead')) return undefined;
    }
    const enters = Boolean(c.lit('and it enters play exerted', 'and they enter play exerted'));
    if (!endSentence(c)) return undefined;
    const effects = steps.filter(step => step.kind === 'Effect');
    if (effects.length !== 1 || effects[0].kind !== 'Effect') return undefined;
    let replacementEffect = effects[0].effect;
    if (enters) {
        const found = findEffect(replacementEffect, ['Play'], effect => ({ ...effect, exerted: true } as Effect));
        if (!found) return undefined;
        replacementEffect = found;
    }
    const scopes = steps.filter(step => step.kind !== 'Effect');
    const swap = (original: Effect): Effect => {
        let inner = scopes.length ? fold([...scopes, effectStep(replacementEffect)]) : replacementEffect;
        const choice = scopes.length === 1 && scopes[0].kind === 'Choose Cards' ? scopes[0] : undefined;
        if (choice) {
            const prior = parts.flatMap(partSteps).reverse().find(step => step.kind === 'Choose Cards' && references(original, [step.id]) &&
                JSON.stringify([step.from, step.count, step.player, step.where]) === JSON.stringify([choice.from, choice.count, choice.player, choice.where]));
            if (prior?.kind === 'Choose Cards') {
                // An "instead" stat change reuses the original choice, rather than choosing a second character.
                inner = substitute(replacementEffect, ref => isCardRef(ref) && ref.$cards === choice.id ? cardRef(prior.id) : ref);
                if (isCardRef(c.state.chosen) && c.state.chosen.$cards === choice.id) c.state.chosen = cardRef(prior.id);
            }
        }
        const then = original.type === 'Modify Cards' && inner.type === 'Modify Cards' && !inner.duration && original.duration
            ? { ...inner, duration: original.duration } : inner;
        return { type: 'Conditional', if: test, otherwise: original,
            then: then.type === 'Optional' ? { type: 'Choose Mode', options: [then.effect, original] } : then };
    };
    if (replaceEarlier(parts, [replacementEffect.type], swap)) return true;
    return replaceEarlier(parts, ['Exert', 'Banish', 'Ready', 'Move Card', 'Draw', 'Gain Lore', 'Deal Damage', 'Modify Cards', 'Play'], swap)
        ? true : undefined;
}

/** "deal 5 damage instead": only the amount changes. */
function amountOnly(c: Parser, parts: Part[]): Step[] | undefined {
    let prior: Effect | undefined;
    replaceEarlier(parts, ['Deal Damage', 'Remove Damage', 'Gain Lore', 'Modify Cards', 'Look', 'Draw'], effect => {
        prior = effect;
        return effect;
    });
    if (!prior) return undefined;
    const before = prior;
    return c.try(() => {
        const damage = c.try(() => {
            if (!c.lit('deal')) return undefined;
            const n = number(c);
            return n !== undefined && c.lit('damage') ? n : undefined;
        });
        if (damage !== undefined && before.type === 'Deal Damage') return [effectStep({ ...before, amount: damage })];
        const removal = c.try(() => {
            if (!c.lit('remove up to')) return undefined;
            const n = number(c);
            return n !== undefined && c.lit('damage') ? n : undefined;
        });
        if (removal !== undefined && before.type === 'Remove Damage') return [effectStep({ ...before, amount: { upTo: removal } })];
        const lore = c.try(() => {
            if (!c.lit('gain')) return undefined;
            const n = number(c);
            return n !== undefined && c.lit('lore') ? n : undefined;
        });
        if (lore !== undefined && before.type === 'Gain Lore') return [effectStep({ ...before, amount: lore })];
        const draw = c.try(() => {
            if (!c.lit('draw')) return undefined;
            const n = number(c);
            return n !== undefined && c.lit('cards') ? n : undefined;
        });
        if (draw !== undefined && before.type === 'Draw') return [effectStep({ ...before, amount: draw })];
        const getsStat = c.try(() => {
            if (!c.lit('he', 'she', 'they', 'it', 'chosen character')) return undefined;
            if (!c.lit('gets', 'get')) return undefined;
            const change = statChange(c);
            if (!change) return undefined;
            duration(c);
            return change;
        });
        if (getsStat && before.type === 'Modify Cards' && 'stat' in before.modifier) return [effectStep({ ...before, modifier: getsStat })];
        const banish = c.try(() => c.lit('banish her', 'banish him', 'banish them', 'banish it') ? true : undefined);
        if (banish && 'cards' in before) return [effectStep({ type: 'Banish', cards: before.cards as CardSelection })];
        return undefined;
    });
}

/** Sentences that adjust the previous instruction. */
function amendment(c: Parser, parts: Part[]): true | undefined {
    if (c.lit("this damage can't be reduced by resist.")) {
        return replaceEarlier(parts, ['Deal Damage'], effect => ({ ...effect, ignoreResist: true } as Effect)) ? true : undefined;
    }
    return undefined;
}

/** "Choose one: • A • B". */
function chooseOne(c: Parser): Step[] | undefined {
    const may = Boolean(c.lit('you may'));
    const player = may ? undefined : c.try(() => {
        const np = playerNP(c);
        if (!np || !c.lit('chooses', 'choose')) return undefined;
        return np;
    });
    const both = c.try(() => {
        if (!c.lit('choose one of the following. if')) return undefined;
        const test = condition(c);
        if (!test || !c.lit(', choose both instead:')) return undefined;
        return test;
    });
    if (!both && !c.lit(player ? 'one:' : 'choose one:')) {
        if (!player || !c.re('yes! or no!:')) return undefined;
    }
    const options: Effect[] = [];
    let chooserRef: PlayerSelection | undefined;
    if (player?.kind === 'Choose') {
        const id = nextId(c);
        chooserRef = playerRef(id);
        c.state.they = chooserRef;
        c.state.chooserId = id;
    } else if (player) c.state.they = player.player;
    while (c.lit('•')) {
        c.re('(?:yes!|no!)(?=\\s)');
        const saved = { ...c.state };
        const option = instructions(c);
        if (!option) return undefined;
        options.push(option);
        c.state = { ...saved, ids: c.state.ids };
    }
    if (options.length < 2) return undefined;
    const steps: Step[] = [];
    let chooser: PlayerSelection | undefined;
    if (player) {
        if (player.kind === 'Choose' && chooserRef) {
            steps.push({ kind: 'Choose Player', id: (chooserRef as unknown as { $player: number }).$player, from: player.from });
            chooser = chooserRef;
        } else if (player.kind === 'Fixed') chooser = player.player;
    }
    const mode: Effect = { type: 'Choose Mode', options, ...(chooser && chooser !== 'You' ? { player: chooser } : {}) };
    let effect: Effect = both ? { type: 'Conditional', if: both, then: { type: 'Sequence', effects: options }, otherwise: mode } : mode;
    if (may) effect = optionalEffect('You', effect);
    steps.push(effectStep(effect));
    return steps;
}

/** "If its card type is: • character, X • action or item, Y". */
function cardTypeModes(c: Parser): Step[] | undefined {
    if (!c.lit('if its card type is:')) return undefined;
    const card = it(c);
    const branches: { filter: CardFilter; effect: Effect }[] = [];
    while (c.lit('•')) {
        const kind = cardKind(c);
        if (!kind || !c.lit(',')) return undefined;
        const saved = { ...c.state };
        const effect = instructions(c);
        if (!effect) return undefined;
        c.state = { ...saved, ids: c.state.ids };
        branches.push({ filter: kind, effect });
    }
    if (!branches.length) return undefined;
    let result: Effect | undefined;
    for (const branch of [...branches].reverse()) {
        result = { type: 'Conditional', if: { every: card, where: branch.filter }, then: branch.effect, ...(result ? { otherwise: result } : {}) };
    }
    return result ? [effectStep(result)] : undefined;
}

/** Clauses joined by ", then", "and", or a bare comma. */
function chainParts(c: Parser): Part[] | undefined {
    const parts: Part[] = [];
    const first = clausePart(c);
    if (!first) return undefined;
    parts.push(first);
    for (;;) {
        const next = c.try(() => {
            if (!c.lit(', then,', ', then', ', and then', 'and then', ', and', 'and', ',')) return undefined;
            return clausePart(c);
        });
        if (!next) break;
        parts.push(next);
    }
    return parts;
}

function chain(c: Parser): Step[] | undefined {
    const parts = chainParts(c);
    return parts ? flatten(parts) : undefined;
}

// ---------------------------------------------------------------------------
// Clauses

function clausePart(c: Parser): Part | undefined {
    return c.try((): Part | undefined => {
        // Prefix durations apply to the whole clause.
        const prefix = c.try(() => {
            if (c.lit('for the rest of this turn,', 'this turn,')) return { until: 'End Of Turn' } as Duration;
            if (c.lit('until the start of your next turn,')) return { until: 'Start Of Next Turn', player: 'You' } as Duration;
            if (c.lit('while this item is in play,', 'while this location is in play,')) return { whileInPlay: 'Self' } as Duration;
            return undefined;
        });
        if (prefix) {
            const saved = c.state.duration;
            c.state.duration = prefix;
            try {
                return clausePart(c);
            } finally {
                c.state.duration = saved;
            }
        }
        const each = forEachPlayer(c);
        if (each) return each;
        const repeat = c.try(() => forEachPrefix(c));
        if (repeat) return { kind: 'Steps', steps: repeat };
        const players = c.try(() => playerClause(c));
        if (players) return withSuffix(c, players);
        // "This turn, you may play characters from under this item": a permission, not one play.
        const permission = c.try(() => {
            const d = c.state.duration;
            if (!d || !c.lit('you may play')) return undefined;
            const steps: Step[] = [];
            const spec = bareCards(c, steps, 'You', false);
            if (!spec || !spec.plural || steps.length) return undefined;
            const cards = spec.cards();
            if (typeof cards !== 'object' || !('zone' in cards)) return undefined;
            const allowed = cards.zone === 'Under' ? 'Can Play From Under' as const : cards.zone === 'Discard' ? 'Can Play From Discard' as const : undefined;
            if (!allowed) return undefined;
            return { kind: 'Steps' as const, steps: [effectStep({ type: 'Create Rule', duration: d,
                rule: { type: 'Modify Players', players: 'You', modifier: { permission: allowed, cards } } })] };
        });
        if (permission) return permission;
        const may = c.try(() => {
            if (!c.lit('you may', 'may')) return undefined;
            return optionalClause(c, 'You');
        });
        if (may) return may;
        const steps = clause(c);
        if (!steps) return undefined;
        return withSuffix(c, { kind: 'Steps', steps });
    });
}

/** "X to Y" and "X unless ..." after a clause. */
function withSuffix(c: Parser, part: Part): Part {
    if (part.kind !== 'Steps') return part;
    const then = c.try(() => c.lit('to') ? purpose(c, c.state.actor) : undefined);
    if (then) return { kind: 'Optional', do: part.steps, then, required: true };
    const unlessPay = c.try(() => {
        if (!c.lit('unless their player pays', 'unless its player pays')) return undefined;
        const n = number(c);
        return n !== undefined && c.lit('{I}') ? n : undefined;
    });
    if (unlessPay !== undefined) {
        const payer: PlayerSelection = { ownerOf: it(c) };
        const pay: Effect = optionalEffect(payer, { type: 'Pay Cost', player: payer, cost: [{ type: 'Ink', amount: unlessPay }], then: nothing });
        return { kind: 'Steps', steps: [effectStep({ type: 'Do Then', do: pay, then: nothing, otherwise: foldOrEmpty(part.steps) })] };
    }
    const unless = c.try(() => c.lit('unless') ? condition(c) : undefined);
    if (unless) return { kind: 'Conditional', if: { not: unless }, parts: [{ kind: 'Steps', steps: part.steps }] };
    const unlessDone = c.try(() => {
        if (!c.lit('unless')) return undefined;
        const np = playerNP(c);
        if (!np || np.kind !== 'Fixed') return undefined;
        const saved = { actor: c.state.actor, they: c.state.they };
        c.state.actor = np.player;
        c.state.they = np.player;
        const steps = verbPhrase(c, np.player);
        c.state.actor = saved.actor;
        c.state.they = saved.they;
        return steps ? { player: np.player, steps } : undefined;
    });
    if (unlessDone) {
        return { kind: 'Steps', steps: [effectStep({ type: 'Do Then', do: optionalEffect(unlessDone.player, foldOrEmpty(unlessDone.steps)),
            then: nothing, otherwise: foldOrEmpty(part.steps) })] };
    }
    return part;
}

/** A choice among looked-at cards, which "may" makes optional by allowing zero cards. */
function lookedChoice(c: Parser, steps: Step[]): Step[] | undefined {
    const looked = c.state.looked;
    const first = steps[0];
    if (!looked || !first || first.kind !== 'Choose Cards') return undefined;
    if (!JSON.stringify(first.from).includes(JSON.stringify(looked))) return undefined;
    if (typeof first.count !== 'number') return steps;
    return [{ ...first, count: { upTo: first.count } }, ...steps.slice(1)];
}

/** "you may X", "you may X to Y", "you may pay 2 {I} to X". */
function optionalClause(c: Parser, actor: PlayerSelection): Part | undefined {
    return c.try((): Part | undefined => {
        const pay = c.try(() => {
            if (!c.lit('pay')) return undefined;
            const n = number(c);
            if (n === undefined || !c.lit('{I}')) return undefined;
            const and = c.try(() => c.lit('and') ? verbPhrase(c, actor) : undefined);
            if (!c.lit('to')) return undefined;
            const then = purpose(c, actor);
            if (!then) return undefined;
            return { n, steps: [...(and ?? []), ...then] };
        });
        if (pay) {
            return { kind: 'Optional', player: actor, do: [], then: pay.steps, pay: [{ type: 'Ink', amount: pay.n }] };
        }
        c.lit('also');
        const action = verbPhrase(c, actor);
        if (!action) return undefined;
        // "You may ink an additional card" grants a permission; using it is the choice.
        const [only] = action;
        if (action.length === 1 && only?.kind === 'Effect' && only.effect.type === 'Create Rule'
            && only.effect.rule.type === 'Modify Players' && !c.peek('to ')) return { kind: 'Steps', steps: action };
        const looked = actor === 'You' ? lookedChoice(c, action) : undefined;
        if (looked && !c.peek('to ')) return { kind: 'Steps', steps: looked };
        const purposeSteps = c.try(() => c.lit('to') ? purpose(c, actor) : undefined);
        if (purposeSteps) return { kind: 'Optional', player: actor, do: action, then: purposeSteps };
        return { kind: 'Optional', player: actor, do: action };
    });
}

/** The instruction after "to" in "banish chosen item of yours to draw a card". */
function purpose(c: Parser, actor: PlayerSelection): Step[] | undefined {
    return c.try(() => {
        const give = giveClause(c);
        if (give) return give;
        const modes = chooseOne(c);
        if (modes) return modes;
        const have = c.try(() => {
            if (!c.lit('have')) return undefined;
            const part = playerClause(c);
            return part ? flatten([part]) : undefined;
        });
        if (have) return have;
        return verbPhrase(c, actor);
    });
}

/** "For each opposing player, you may choose a character of theirs. They can't ready ..." */
function forEachPlayer(c: Parser): Part | undefined {
    return c.try((): Part | undefined => {
        if (!c.lit('for each opposing player,')) return undefined;
        const id = nextId(c);
        c.state.they = playerRef(id);
        const parts = chainParts(c);
        if (!parts) return undefined;
        return { kind: 'Each', scope: { kind: 'For Each Player', id, players: 'Opponents' }, parts };
    });
}

/** "For each X, Y." */
function forEachPrefix(c: Parser): Step[] | undefined {
    if (!c.lit('for each')) return undefined;
    const steps: Step[] = [];
    const ofYours = c.try(() => {
        // "for each of your characters named Maleficent in play, ..."
        if (!c.lit('of your')) return undefined;
        const spec = bareCards(c, steps, 'You');
        return spec ? { count: spec.cards() } as Amount : undefined;
    });
    const times = ofYours ?? countable(c);
    if (times === undefined || !c.lit(',')) return undefined;
    const body = chain(c);
    if (!body) return undefined;
    return [...steps, effectStep({ type: 'Repeat', times, effect: foldOrEmpty(body) })];
}

/** A clause: subject and predicate, or an imperative verb phrase. */
function clause(c: Parser): Step[] | undefined {
    return c.try(() => {
        const special = specialClause(c);
        if (special) return special;
        const card = cardClause(c);
        if (card) return card;
        const delayed = delayedClause(c);
        if (delayed) return delayed;
        const trigger = createdTrigger(c);
        if (trigger) return trigger;
        return verbPhrase(c, c.state.actor);
    });
}

/** Imperatives that only bind something for later sentences. */
function specialClause(c: Parser): Step[] | undefined {
    return c.try((): Step[] | undefined => {
        const counted = c.try(() => {
            if (!c.lit('count the number of')) return undefined;
            const steps: Step[] = [];
            const np = cardNP(c, steps);
            if (!np || steps.length) return undefined;
            c.state.counted = { count: np.kind === 'Fixed' ? np.cards : np.from };
            return [] as Step[];
        });
        if (counted) return counted;
        const choose = c.try(() => {
            if (!c.lit('choose')) return undefined;
            const steps: Step[] = [];
            const np = cardNP(c, steps);
            if (!np || np.kind !== 'Choose') return undefined;
            useCards(c, np, steps);
            const and = c.try(() => c.lit('and') ? verbPhrase(c, c.state.actor) : undefined);
            return [...steps, ...(and ?? [])];
        });
        if (choose) return choose;
        if (c.lit('ready this character after the challenge')) {
            return [effectStep({ type: 'Create Trigger', uses: 1, duration: { until: 'End Of Turn' },
                trigger: { event: 'After Challenge', attacker: 'Self' }, effect: { type: 'Ready', cards: 'Self' } })];
        }
        const prevent = c.try(() => {
            if (!c.lit('the next time they would be dealt damage they take no damage instead')) return undefined;
            const d = c.state.duration;
            return [effectStep({ type: 'Modify Cards', cards: it(c), modifier: { preventDamage: 'Next' }, ...(d ? { duration: d } : {}) })];
        });
        if (prevent) return prevent;
        const readyLimit = c.try(() => {
            if (!c.lit("each opponent can't ready more than")) return undefined;
            const n = number(c);
            if (n === undefined || !c.lit('of their characters at the start of their next turn')) return undefined;
            const id = nextId(c);
            return [{ kind: 'For Each Player', id, players: 'Opponents' } as Step, effectStep({ type: 'Modify Players', players: playerRef(id),
                modifier: { readyLimit: n }, duration: { until: 'End Of Next Turn', player: playerRef(id) } })];
        });
        if (readyLimit) return readyLimit;
        if (c.lit("put the card with the highest cost revealed this way, or each card tied for highest cost, into its player's hand. put the rest on the bottom of their players' decks")) {
            const revealed: CardSelection = { result: 'Revealed Cards' };
            const best: CardSelection = { filter: revealed, where: { cost: { equal: { highest: { stat: 'Cost', cards: revealed } } } } };
            return [effectStep({ type: 'Move Card', cards: best, to: 'Hand' }),
                effectStep({ type: 'Move Card', cards: { difference: [revealed, best] }, to: 'Deck', position: 'Bottom' })];
        }
        const next = c.try(() => {
            if (!c.lit('the next character you play this turn enters play exerted')) return undefined;
            const modifiers = c.try(() => c.lit('and gains') ? grants(c) : undefined) ?? [];
            const d = duration(c);
            return [effectStep({ type: 'Create Rule', uses: 1, duration: { until: 'End Of Turn' }, rule: {
                type: 'Enter Play', cards: { zone: 'Any', player: 'You', cardType: 'Character' }, exerted: true,
                ...(modifiers[0] ? { modifier: modifiers[0] } : {}), ...(d ? { duration: d } : {}) } })];
        });
        if (next) return next;
        return undefined;
    });
}

/** Player subject: "each opponent loses 1 lore", "chosen opponent chooses and discards a card". */
function playerClause(c: Parser): Part | undefined {
    return c.try((): Part | undefined => {
        // "You and another chosen player each get 1 ink drop."
        const pair = c.try(() => {
            if (!c.lit('you and another chosen player each')) return undefined;
            const id = nextId(c);
            const mine = verbPhrase(c, 'You');
            if (!mine) return undefined;
            return { id, mine };
        });
        if (pair) {
            const theirs = pair.mine.map(step => step.kind === 'Effect' && 'player' in step.effect
                ? effectStep({ ...step.effect, player: playerRef(pair.id) } as Effect) : step);
            return { kind: 'Steps', steps: [{ kind: 'Choose Player', id: pair.id, from: { from: 'All', where: { not: { isPlayer: 'You' } } } },
                ...pair.mine, ...theirs] };
        }
        if (c.lit('choose any number of players')) {
            const id = nextId(c);
            c.state.they = playerRef(id);
            return { kind: 'Each', scope: { kind: 'For Each Player', id, players: 'All' }, parts: [], optional: true };
        }
        const ranked = c.try((): PlayerSelection | undefined => {
            if (!c.lit('the player or players with the most cards in their hands', 'the player or players with the most cards in their hand')) return undefined;
            return { from: 'All', rank: { order: 'Highest', by: { count: { zone: 'Hand', player: 'Selected Player' } } } };
        });
        // The opposing players make one decision as a group (Tamatoa - Grabby Crab).
        const opponentsTogether = !ranked && Boolean(c.lit('the opposing players together', 'the illumineers'));
        const np = ranked ? { kind: 'Fixed' as const, player: ranked, plural: true }
            : opponentsTogether ? { kind: 'Fixed' as const, player: { together: 'Opponents' } as PlayerSelection, plural: false } : playerNP(c);
        if (!np) return undefined;
        if (np.kind === 'Fixed' && np.player === 'You' && c.peek('may\\b')) return undefined;
        const each = c.try(() => {
            if (np.kind !== 'Fixed' || !np.plural) return undefined;
            // "each player with fewer than 3 cards in their hand"
            if (!c.lit('with', 'who')) return undefined;
            return undefined;
        });
        void each;
        let actor: PlayerSelection;
        let scope: (Step & { kind: 'For Each Player' }) | undefined;
        const steps: Step[] = [];
        if (np.kind === 'Choose') {
            const id = nextId(c);
            steps.push({ kind: 'Choose Player', id, from: np.from });
            actor = playerRef(id);
        } else if (np.plural) {
            const id = nextId(c);
            const players = playerFilter(c, np.player);
            scope = { kind: 'For Each Player', id, players };
            actor = playerRef(id);
        } else actor = np.player;
        const saved = c.state.actor;
        // "You may choose a character of theirs" keeps the preceding opponent.
        if (actor !== 'You' || !c.state.they) c.state.they = actor;
        c.state.actor = actor;
        try {
            const may = Boolean(c.lit('may'));
            let body = verbPhrase(c, actor);
            if (!body) return undefined;
            if (may) {
                const purposeSteps = c.try(() => c.lit('to') ? purpose(c, actor) : undefined);
                if (!scope && !steps.length) return { kind: 'Optional', player: actor, do: body, ...(purposeSteps ? { then: purposeSteps } : {}) };
                if (purposeSteps) body = flatten([{ kind: 'Optional', player: actor, do: body, then: purposeSteps }]);
                else body = [effectStep(optionalEffect(actor, foldOrEmpty(body)))];
            }
            if (scope) return { kind: 'Each', scope, parts: [{ kind: 'Steps', steps: [...steps, ...body] }] };
            return { kind: 'Steps', steps: [...steps, ...body] };
        } finally {
            c.state.actor = saved;
        }
    });
}

/** "each player with more than 3 cards in their inkwell". */
function playerFilter(c: Parser, players: PlayerSelection): PlayerSelection {
    const where = c.try(() => {
        if (!c.lit('with', 'who')) return undefined;
        const saved = c.state.they;
        c.state.they = 'Selected Player';
        try {
            const test = c.try(() => {
                if (c.lit('reveals a character card')) return { exists: { filter: { result: 'Revealed Cards' }, where: { cardType: 'Character' } } } as Condition;
                if (c.lit('more lore than you')) return { value: { lore: 'Selected Player' }, is: { greaterThan: { lore: 'You' } } } as Condition;
                const n = quantityPrefix(c);
                if (!n) return undefined;
                const steps: Step[] = [];
                const spec = bareCards(c, steps, 'Selected Player');
                if (!spec || steps.length) return undefined;
                return { value: { count: spec.cards() }, is: n } as Condition;
            });
            return test;
        } finally {
            c.state.they = saved;
        }
    });
    return where ? { from: players, where } : players;
}

function quantityPrefix(c: Parser): import('../model/ability').Comparison | undefined {
    return c.try(() => {
        if (c.lit('more than')) { const n = digits(c); return n === undefined ? undefined : { greaterThan: n }; }
        if (c.lit('fewer than', 'less than')) { const n = digits(c); return n === undefined ? undefined : { lessThan: n }; }
        return undefined;
    });
}

/** Card subject: "chosen character gets +2 {S} this turn", "they can't quest". */
function cardClause(c: Parser): Step[] | undefined {
    return c.try(() => {
        const steps: Step[] = [];
        const np = cardNP(c, steps);
        if (!np) return undefined;
        const moving = c.try(() => {
            if (!c.lit('may move to a location for free', 'may move there for free')) return undefined;
            return true;
        });
        if (moving) {
            const target = useCards(c, np, steps);
            const there = /there for free$/i.test(c.text.slice(0, c.pos));
            const location = there ? it(c) : undefined;
            if (location !== undefined && location !== target) {
                return [...steps, effectStep(optionalEffect('You', { type: 'Move To Location', cards: target, location: { event: 'Card' }, free: true }))];
            }
            const id = nextId(c);
            return [...steps, effectStep(optionalEffect('You', fold([{ kind: 'Choose Cards', id, from: { zone: 'Play', cardType: 'Location' }, count: 1 },
                effectStep({ type: 'Move To Location', cards: target, location: cardRef(id), free: true })])))];
        }
        const target = useCards(c, np, steps);
        const card = predicates(c, np, steps);
        if (!card) return undefined;
        steps.push(...card(target));
        return steps;
    });
}

// ---------------------------------------------------------------------------
// Durations and card changes

export function duration(c: Parser): Duration | undefined {
    if (c.lit('this turn', 'for the rest of this turn', 'until the end of the turn', 'until end of turn', 'for the rest of the turn')) {
        return { until: 'End Of Turn' };
    }
    if (c.lit('until the start of your next turn', 'until the start of his next turn')) return { until: 'Start Of Next Turn', player: 'You' };
    if (c.lit('during their next turn', 'during its next turn', 'during his next turn', 'during her next turn')) {
        return { duringNextTurn: { ownerOf: it(c) } };
    }
    if (c.lit('during that challenge')) return { until: 'End Of Challenge' };
    if (c.lit('while this item is in play', 'while this location is in play', 'while this character is in play')) {
        return { whileInPlay: 'Self' };
    }
    return undefined;
}

function statChange(c: Parser, steps?: Step[]): CardChange | undefined {
    return c.try((): CardChange | undefined => {
        const sign = c.re('([+-])');
        if (!sign) return undefined;
        const negative = sign[1] === '-';
        const n = digits(c);
        const stat = statSymbol(c);
        if (!stat) return undefined;
        if (n === undefined) {
            if (!c.lit('equal to')) return undefined;
            const amount = amountOf(c, steps);
            if (amount === undefined) return undefined;
            return { stat, amount: negative ? { multiply: [-1, amount] } : amount };
        }
        const per = forEachSuffix(c);
        const amount: Amount = per === undefined ? (negative ? -n : n) : { multiply: [negative ? -n : n, per] };
        return { stat, amount };
    });
}

/** "for each X" after an amount, as a count. */
function forEachSuffix(c: Parser): Amount | undefined {
    return c.try(() => {
        if (!c.lit('for each')) return undefined;
        return countable(c);
    });
}

/** Multiply by a trailing "for each X". */
function perEach(c: Parser, n: number): Amount {
    const per = forEachSuffix(c);
    if (per === undefined) return n;
    return n === 1 ? per : { multiply: [n, per] };
}

/** Things that can be counted after "for each". */
export function countable(c: Parser): Amount | undefined {
    return c.try((): Amount | undefined => {
        if (c.lit('1 damage on them', '1 damage on him', '1 damage on her', '1 damage on it')) return { stat: 'Damage', card: it(c) };
        if (c.lit('1 damage on opposing characters')) return { sum: { stat: 'Damage', cards: { zone: 'Play', player: 'Opponents', cardType: 'Character' } } };
        if (c.lit('1 damage removed this way', 'damage removed this way')) return { result: 'Damage Removed' };
        if (c.lit('1 damage removed')) return eventIs(c, 'Remove Damage') ? { event: 'Amount' } : { result: 'Damage Removed' };
        if (c.lit('1 lore lost this way', 'lore lost this way')) return { result: 'Lore Lost' };
        if (c.lit('damage counter moved this way')) return { result: 'Damage Moved' };
        if (c.lit('card under them', 'card under him', 'card under her', 'card under it')) return { stat: 'Cards Under', card: it(c) };
        if (c.lit('card that was under them', 'card that was under him', 'card that was under her')) {
            return { atEvent: 'Before', value: { stat: 'Cards Under', card: it(c) } };
        }
        if (c.lit('card in your hand')) return { count: { zone: 'Hand', player: 'You' } };
        if (c.lit('card in your discard')) return { count: { zone: 'Discard', player: 'You' } };
        if (c.lit("card in opponents' hands", "card in your opponents' hands")) return { count: { zone: 'Hand', player: 'Opponents' } };
        // A discard trigger fires for each card, so "for each card discarded" is one per trigger.
        if (c.lit('card discarded')) return eventIs(c, 'Discard') ? 1 : { count: { result: 'Discarded Cards' } };
        if (c.lit('different ink type of cards revealed this way', 'different ink symbol on cards revealed this way')) {
            return { distinct: 'Ink Type', cards: { result: 'Revealed Cards' } };
        }
        if (c.lit('different ink type of')) {
            const steps: Step[] = [];
            const spec = bareCards(c, steps, undefined);
            if (!spec || steps.length) return undefined;
            return { distinct: 'Ink Type', cards: spec.cards() };
        }
        const steps: Step[] = [];
        const described = bareCards(c, steps, undefined);
        if (!described || steps.length) return undefined;
        if (c.lit('discarded this way')) return { count: { filter: { result: 'Discarded Cards' }, where: described.filter() } };
        if (c.lit('put into your discard this way')) return { count: { filter: { result: 'Moved Cards' }, where: described.filter() } };
        if (c.lit('banished this way')) return { count: { filter: { result: 'Banished Cards' }, where: described.filter() } };
        if (c.lit('moved this way')) return { count: { filter: { result: 'Moved Cards' }, where: described.filter() } };
        if (c.lit('you moved')) return { count: { result: 'Moved Cards' } };
        if (c.lit('that sang this song')) return { count: { event: 'Singers' } };
        if (c.lit('banished in a challenge this turn')) {
            return { countEvents: { event: 'Banish', kind: 'Challenge', card: described.anyZone() }, during: 'This Turn' };
        }
        return { count: described.cards() };
    });
}

/** Keywords and quoted abilities after "gain" or "give". */
function grants(c: Parser): CardChange[] | undefined {
    return c.try(() => {
        const items = c.list((): CardChange | undefined => {
            const quoted = c.try(() => {
                if (!c.lit('"')) return undefined;
                const ability = grantedAbility(c);
                if (!ability || !c.lit('"')) return undefined;
                return { gainAbility: ability } as CardChange;
            });
            if (quoted) return quoted;
            const kind = c.try(() => {
                if (!c.lit('the')) return undefined;
                const name = classification(c);
                return name && c.lit('classification') ? { gainClassification: name } as CardChange : undefined;
            });
            if (kind) return kind;
            const word = keyword(c);
            if (!word) return undefined;
            if (word === 'Challenger' || word === 'Resist' || word === 'Singer') {
                const amount = c.try(() => {
                    c.re('\\+');
                    return digits(c);
                });
                if (amount === undefined) return undefined;
                return { gainKeyword: word, amount };
            }
            if (word === 'Boost' || word === 'Shift' || word === 'Sing Together') return undefined;
            return { gainKeyword: word } as CardChange;
        }, ['and']);
        return items;
    });
}

const restrictionPhrases: [string, CardRestriction][] = [
    ['quest', "Can't Quest"],
    ['challenge', "Can't Challenge"],
    ['ready at the start of their turn', "Can't Ready At Start Of Turn"],
    ['ready', "Can't Ready"],
    ['move to locations', "Can't Move"],
    ['exert to sing songs', "Can't Sing"],
    ['{E} to sing songs', "Can't Sing"],
    ['sing songs', "Can't Sing"],
    ['be challenged', "Can't Be Challenged"],
    ['be dealt damage', "Can't Be Dealt Damage"],
];

interface Change { change: CardChange; duration?: Duration; when?: Condition }

/** Changes to a card. Returns a builder that applies them to the chosen target. */
function predicates(c: Parser, np: CardNP, steps: Step[] = []): ((target: CardSelection) => Step[]) | undefined {
    const list: Change[] = [];
    const one = (): boolean => c.try(() => {
        const when = c.try(() => {
            if (!c.lit(', if')) return undefined;
            const test = condition(c);
            return test && c.lit(',') ? test : undefined;
        });
        const items = predicate(c, np, steps);
        if (!items) return undefined;
        const d = duration(c);
        for (const item of items) list.push({ ...item, ...(d && !item.duration ? { duration: d } : {}), ...(when ? { when } : {}) });
        return true;
    }) === true;
    if (!one()) return undefined;
    while (c.try(() => ((c.lit(', and', 'and', ',') || c.peek(', if')) && one()) ? true : undefined)) { /* more */ }
    // A trailing duration applies to every change without its own.
    const final = list[list.length - 1]?.duration;
    for (const item of list) if (!item.duration && final) item.duration = final;
    const fallback = c.state.duration;
    return (target: CardSelection) => list.flatMap(item => {
        const d = item.duration ?? fallback;
        const ownerTurn = d && ('duringNextTurn' in d || ('until' in d && 'player' in d && typeof d.player === 'object' && 'ownerOf' in d.player));
        // Each existing card gets its own player's boundary, not a live rule for future arrivals.
        if (ownerTurn && !isSingle(c, target)) {
            const id = nextId(c);
            const boundDuration: Duration = 'duringNextTurn' in d
                ? { duringNextTurn: { ownerOf: cardRef(id) } }
                : { until: d.until, player: { ownerOf: cardRef(id) } };
            // The loop covers only this change, not later sentences (They Never Come Back draws once).
            return [effectStep(fold([{ kind: 'For Each Card', id, cards: target },
                effectStep({ type: 'Modify Cards', cards: cardRef(id), modifier: item.change, duration: boundDuration })]))];
        }
        const durationFor = d && 'duringNextTurn' in d ? { duringNextTurn: { ownerOf: target } } : d;
        // A restriction on a group also covers cards that join it later (Restoring Atlantis), so it is a live rule.
        // "They can't quest" after readying a group means the cards readied (Scar - Shameless Firebrand).
        const referred = np.kind === 'Fixed' && np.referred;
        const live = !referred && typeof target === 'object' && 'zone' in target && ('restriction' in item.change || 'permission' in item.change) && durationFor !== undefined
            && !('duringNextTurn' in durationFor);
        const effect: Effect = live ? { type: 'Create Rule', rule: { type: 'Modify Cards', cards: target, modifier: item.change }, duration: durationFor! }
            : { type: 'Modify Cards', cards: target, modifier: item.change, ...(durationFor ? { duration: durationFor } : {}) };
        return [effectStep(item.when ? { type: 'Conditional', if: item.when, then: effect } : effect)];
    });
}

/** A single predicate, which may produce several changes ("can't quest or challenge"). */
function predicate(c: Parser, np: CardNP, steps: Step[]): Change[] | undefined {
    void np;
    return c.try((): Change[] | undefined => {
        if (c.lit('gets', 'get')) {
            const changes = c.list(() => statChange(c, steps), ['and']);
            if (!changes) return undefined;
            const challenging = c.try(() => {
                if (!c.lit('while challenging a location')) return undefined;
                return { and: [{ inChallenge: 'Affected Card', role: 'Attacker' },
                    { exists: { filter: { challengeParticipant: 'Defender' }, where: { cardType: 'Location' } } }] } as Condition;
            });
            const d = duration(c);
            const per = forEachSuffix(c);
            return changes.map(change => {
                const scaled = per !== undefined && 'stat' in change && typeof change.amount === 'number'
                    ? { ...change, amount: { multiply: [change.amount, per] } } as CardChange : change;
                return { change: challenging ? { ...scaled, when: challenging } as CardChange : scaled, ...(d ? { duration: d } : {}) };
            });
        }
        if (c.lit('gains', 'gain')) return grants(c)?.map(change => ({ change }));
        if (c.lit('loses', 'lose')) {
            const lost = c.try(() => {
                const word = keyword(c);
                return word && word !== 'Sing Together' ? [{ change: { loseKeyword: word } as CardChange }] : undefined;
            });
            if (lost) return lost;
            return c.try(() => {
                const which = statSymbol(c);
                if (!which || !c.lit('equal to')) return undefined;
                const amount = amountOf(c);
                return amount === undefined ? undefined : [{ change: { stat: which, amount: { multiply: [-1, amount] } } as CardChange }];
            });
        }
        if (c.lit("can't")) {
            const items = c.list(() => {
                for (const [phrase, restriction] of restrictionPhrases) if (c.lit(phrase)) return restriction;
                return undefined;
            }, ['or', 'and']);
            if (!items) return undefined;
            const out: Change[] = [];
            const target = c.try(() => {
                if (items.length !== 1 || items[0] !== "Can't Challenge") return undefined;
                if (!c.lit('your characters or locations')) return undefined;
                return { player: 'You', or: [{ cardType: 'Character' }, { cardType: 'Location' }] } as CardFilter;
            });
            if (target) return [{ change: { restriction: "Can't Challenge", by: target } }];
            for (const restriction of items) {
                if (restriction === "Can't Ready" && c.lit('at the start of their next turn', 'at the start of its next turn',
                    'at the start of the their next turn')) {
                    // This must already apply in Ready. During-next-turn effects
                    // start in Set, which is too late to prevent normal readying.
                    out.push({ change: { restriction: "Can't Ready At Start Of Turn" },
                        duration: { until: 'End Of Next Turn', player: { ownerOf: c.state.characterRef ?? it(c) } } });
                    continue;
                }
                out.push({ change: { restriction } });
            }
            const must = c.try(() => {
                if (!c.lit('and must quest')) return undefined;
                const d = duration(c);
                return c.lit('if able') ? d ?? true : undefined;
            });
            if (must) {
                const d = must === true ? undefined : must;
                out.push({ change: { restriction: 'Must Quest' }, ...(d ? { duration: d } : {}) });
                if (d) for (const item of out) item.duration ??= d;
            }
            return out;
        }
        if (c.lit("doesn't ready at the start of their next turn")) {
            return [{ change: { restriction: "Can't Ready At Start Of Turn" },
                duration: { until: 'End Of Next Turn', player: { ownerOf: c.state.characterRef ?? it(c) } } }];
        }
        if (c.lit('can challenge ready characters', 'may challenge ready characters', 'can also challenge ready characters',
            'may also challenge ready characters')) {
            return [{ change: { permission: 'Can Challenge Ready Characters' } }];
        }
        if (c.lit('takes no damage from challenges', 'take no damage from challenges')) {
            return [{ change: { restriction: "Can't Be Dealt Damage", when: { inChallenge: 'Affected Card' } } }];
        }
        if (c.lit('takes no damage while challenging')) {
            return [{ change: { restriction: "Can't Be Dealt Damage", when: { inChallenge: 'Affected Card', role: 'Attacker' } } }];
        }
        if (c.lit('takes no damage from the challenge', 'take no damage from the challenge')) {
            return [{ change: { restriction: "Can't Be Dealt Damage" }, duration: { until: 'End Of Challenge' } }];
        }
        if (c.lit('counts as having', 'count as having')) {
            const sign = c.re('([+-])');
            const n = digits(c);
            if (!sign || n === undefined || !c.lit('cost to sing songs')) return undefined;
            return [{ change: { stat: 'Cost To Sing', amount: sign[1] === '-' ? -n : n } }];
        }
        return undefined;
    });
}

// ---------------------------------------------------------------------------
// Verb phrases

function oneOrMore(c: Parser): number | undefined {
    if (c.lit('a card', 'one card', 'another card')) return 1;
    return c.try(() => {
        const n = number(c);
        return n !== undefined && c.lit('cards', 'card') ? n : undefined;
    });
}

function step(effect: Effect): Step[] {
    return [effectStep(effect)];
}

/** "draw a card", "deal 2 damage to chosen character", ... with the given acting player. */
export function verbPhrase(c: Parser, actor: PlayerSelection): Step[] | undefined {
    for (const production of verbs) {
        const steps = c.try(() => production(c, actor));
        if (!steps) continue;
        const alternative = c.try(() => c.lit('or') ? verbPhrase(c, actor) : undefined);
        if (alternative) {
            return [effectStep({ type: 'Or', options: [fold(steps), fold(alternative)], ...(actor !== 'You' ? { player: actor } : {}) })];
        }
        const more = c.try(() => {
            if (!c.lit(', and then', 'and then', ', then', 'then', ', and', 'and', ',')) return undefined;
            return verbPhrase(c, actor);
        });
        return more ? [...steps, ...more] : steps;
    }
    return undefined;
}

type Verb = (c: Parser, actor: PlayerSelection) => Step[] | undefined;

/** Cards in hand that a player must discard down to: max(0, hand - n). */
function excess(actor: PlayerSelection, n: Amount): Amount {
    return { max: [0, { subtract: [{ count: { zone: 'Hand', player: actor } }, n] }] };
}

/** Cards a player must draw up to: max(0, n - hand). */
function shortfall(actor: PlayerSelection, n: Amount): Amount {
    return { max: [0, { subtract: [n, { count: { zone: 'Hand', player: actor } }] }] };
}

const draw: Verb = (c, actor) => {
    if (!c.lit('draw', 'draws')) return undefined;
    const n = oneOrMore(c);
    if (n !== undefined) {
        const bottom = Boolean(c.lit('from the bottom of your deck'));
        const amount = perEach(c, n);
        c.lit('each');
        c.state.counted = amount;
        return step({ type: 'Draw', player: actor, amount, ...(bottom ? { from: 'Bottom' } : {}) });
    }
    const steps: Step[] = [];
    if (c.lit('cards equal to')) {
        const amount = amountOf(c, steps);
        if (amount === undefined) return undefined;
        return [...steps, effectStep({ type: 'Draw', player: actor, amount })];
    }
    const until = c.try((): Amount | undefined => {
        if (!c.lit('cards until', 'until')) return undefined;
        if (c.lit('you have the same number', 'they have the same number')) {
            return { count: { zone: 'Hand', player: c.state.they !== actor ? c.state.they ?? 'Opponents' : 'Opponents' } };
        }
        if (!c.lit('you have', 'they have')) return undefined;
        const value = number(c);
        if (value === undefined) return undefined;
        c.lit('cards in your hand', 'cards in their hand', 'cards');
        return value;
    });
    if (until !== undefined) return step({ type: 'Draw', player: actor, amount: shortfall(actor, until) });
    if (c.lit('that many cards')) return step({ type: 'Draw', player: actor, amount: c.state.counted ?? { count: { result: 'Discarded Cards' } } });
    if (c.lit('that number of cards plus 1')) return step({ type: 'Draw', player: actor, amount: { add: [{ count: { result: 'Moved Cards' } }, 1] } });
    return undefined;
};

const damage: Verb = (c) => {
    if (!c.lit('deal', 'deals')) return undefined;
    const steps: Step[] = [];
    const them = c.try(() => {
        if (!c.lit('them')) return undefined;
        const n = number(c);
        return n !== undefined && c.lit('damage') ? n : undefined;
    });
    if (them !== undefined) return [effectStep({ type: 'Deal Damage', cards: it(c), amount: them })];
    const n = c.try((): Amount | undefined => {
        const value = number(c);
        if (value !== undefined) return c.lit('damage') ? value : undefined;
        const same = amountOf(c);
        return same !== undefined && c.lit('of damage', 'damage') ? same : undefined;
    });
    if (n !== undefined) {
        c.lit('each');
        if (!c.lit('to')) return undefined;
        const target = objects(c, steps);
        if (target === undefined) return undefined;
        const amount = typeof n === 'number' ? perEach(c, n) : n;
        steps.push(effectStep({ type: 'Deal Damage', cards: target, amount }));
        return steps;
    }
    if (c.lit('damage to')) {
        const target = cards(c, steps);
        if (target === undefined || !c.lit('equal to')) return undefined;
        const amount = amountOf(c, steps);
        if (amount === undefined) return undefined;
        steps.push(effectStep({ type: 'Deal Damage', cards: target, amount }));
        return steps;
    }
    if (c.lit('damage equal to')) {
        const amount = amountOf(c, steps);
        if (amount === undefined || !c.lit('to')) return undefined;
        const target = cards(c, steps);
        if (target === undefined) return undefined;
        steps.push(effectStep({ type: 'Deal Damage', cards: target, amount }));
        return steps;
    }
    return undefined;
};

const putDamage: Verb = (c) => {
    if (!c.lit('put', 'puts')) return undefined;
    const n = c.try((): Amount | undefined => {
        if (c.lit('a damage counter')) return 1;
        if (c.lit('that many damage counters')) return { event: 'Amount' };
        const value = number(c);
        return value !== undefined && c.lit('damage counters', 'damage counter') ? value : undefined;
    });
    if (n === undefined || !c.lit('on')) return undefined;
    const steps: Step[] = [];
    const target = cards(c, steps);
    if (target === undefined) return undefined;
    steps.push(effectStep({ type: 'Put Damage', cards: target, amount: n }));
    return steps;
};

/** Objects joined by "and": "chosen opposing character and all other opposing characters with the same name". */
function objects(c: Parser, steps: Step[]): CardSelection | undefined {
    const first = cards(c, steps);
    if (first === undefined) return undefined;
    const more = c.try(() => {
        if (!c.lit('and')) return undefined;
        const np = cardNP(c, steps);
        return np && np.kind === 'Fixed' && typeof np.cards === 'object' && 'zone' in np.cards ? np.cards : undefined;
    });
    return more === undefined ? first : { union: [first, more] };
}

function simpleCardVerb(words: string[], type: 'Banish' | 'Exert' | 'Ready'): Verb {
    return (c) => {
        if (!c.lit(...words)) return undefined;
        const steps: Step[] = [];
        const target = objects(c, steps);
        if (target === undefined) return undefined;
        steps.push(effectStep({ type, cards: target }));
        // "Ready your other exerted Princess characters. They ...": once readied they are no longer exerted,
        // so later sentences refer to the cards readied, not the group again (Moana - Of Motunui).
        if (type === 'Ready' && typeof target === 'object' && 'zone' in target && target.where && 'exerted' in target.where)
            c.state.it = { result: 'Readied Cards' };
        return steps;
    };
}

const lore: Verb = (c, actor) => {
    const verb = c.lit('gain', 'gains', 'lose', 'loses');
    if (!verb) return undefined;
    const type = /^gain/i.test(verb) ? 'Gain Lore' as const : 'Lose Lore' as const;
    const n = number(c);
    if (n !== undefined) {
        if (!c.lit('lore')) return undefined;
        return step({ type, player: actor, amount: perEach(c, n) });
    }
    if (!c.lit('lore equal to')) return undefined;
    const steps: Step[] = [];
    let amount = amountOf(c, steps);
    if (amount === undefined) {
        // "the {L} of a character card in your discard"
        const card = c.try(() => {
            if (!c.lit('the')) return undefined;
            const which = statSymbol(c);
            if (!which || !c.lit('of')) return undefined;
            const target = cards(c, steps);
            return target === undefined ? undefined : { stat: which, card: target } as Amount;
        });
        amount = card;
    }
    if (amount === undefined) return undefined;
    const cap = c.try(() => {
        if (!c.lit(', to a maximum of')) return undefined;
        const max = number(c);
        if (max === undefined || !c.lit('lore')) return undefined;
        c.lit('each');
        return max;
    });
    steps.push(effectStep({ type, player: actor, amount: cap === undefined ? amount : { min: [amount, cap] } }));
    return steps;
};

/** Destinations for moving cards. */
type Destination =
    | { to: 'Hand' } | { to: 'Discard' } | { to: 'Inkwell'; exerted?: boolean }
    | { to: 'Deck'; position: 'Top' | 'Bottom' | 'Shuffle'; order?: 'Chosen' | 'Random' };

/** Owner words before a zone. Cards always move to their owner's zone, so the word is not kept. */
function zoneOwner(c: Parser): boolean {
    return Boolean(c.lit("your", "their player's", "its player's", "their players'", "their illumineers'", "their", "its",
        "that player's", "his", "her player's", "the"));
}

function deckOrder(c: Parser): { order?: 'Chosen' | 'Random' } {
    if (c.lit('in any order')) return { order: 'Chosen' };
    if (c.lit('in a random order')) return { order: 'Random' };
    return {};
}

function destination(c: Parser): Destination | undefined {
    return c.try((): Destination | undefined => {
        const hand = c.try((): Destination | undefined => {
            if (!c.lit('to', 'into', 'in')) return undefined;
            return zoneOwner(c) && c.lit('hand', 'hands') ? { to: 'Hand' } : undefined;
        });
        if (hand) return hand;
        const into = c.try((): Destination | undefined => {
            if (!c.lit('into', 'in')) return undefined;
            if (!zoneOwner(c)) return undefined;
            if (c.lit('discard', 'discards')) return { to: 'Discard' };
            if (!c.lit('inkwell', 'inkwells')) return undefined;
            c.lit('facedown');
            return { to: 'Inkwell', exerted: Boolean(c.lit('and exerted')) };
        });
        if (into) return into;
        c.lit('back');
        const top = c.try((): Destination | undefined => {
            if (!c.lit('on the top of', 'on top of')) return undefined;
            if (!zoneOwner(c) || !c.lit('deck', 'decks')) return undefined;
            return { to: 'Deck', position: 'Top', ...deckOrder(c) };
        });
        if (top) return top;
        const bottom = c.try((): Destination | undefined => {
            if (!c.lit('on the bottom of')) return undefined;
            if (!zoneOwner(c) || !c.lit('deck', 'decks')) return undefined;
            return { to: 'Deck', position: 'Bottom', ...deckOrder(c) };
        });
        if (bottom) return bottom;
        if (c.lit('on the bottom')) return { to: 'Deck', position: 'Bottom', ...deckOrder(c) };
        if (c.lit('on top of it')) return { to: 'Deck', position: 'Top' };
        if (c.lit('in any order')) return { to: 'Deck', position: 'Top', order: 'Chosen' };
        return undefined;
    });
}

/** "on either the top or the bottom of your deck" and "on the top or the bottom of your deck". */
function eitherEnd(c: Parser): boolean {
    return Boolean(c.try(() => {
        if (!c.lit('on either the top or the bottom of', 'on the top or the bottom of')) return undefined;
        if (!zoneOwner(c) || !c.lit('deck')) return undefined;
        return true;
    }));
}

function moveEffect(target: CardSelection, where: Destination): Effect {
    switch (where.to) {
        case 'Hand': return { type: 'Move Card', cards: target, to: 'Hand' };
        case 'Discard': return { type: 'Move Card', cards: target, to: 'Discard' };
        case 'Inkwell': return { type: 'Move Card', cards: target, to: 'Inkwell', ...(where.exerted ? { exerted: true } : {}) };
        case 'Deck':
            if (where.position === 'Shuffle') return { type: 'Move Card', cards: target, to: 'Deck', position: 'Shuffle' };
            return { type: 'Move Card', cards: target, to: 'Deck', position: where.position, ...(where.order ? { order: where.order } : {}) };
    }
}

/** Cards not yet taken from the looked-at cards. */
function rest(c: Parser): CardSelection | undefined {
    const looked = c.state.looked;
    if (!looked) return undefined;
    const taken = c.state.taken ?? [];
    if (!taken.length) return looked;
    // Cards chosen in play leave play as they are moved, so the rest are those still there.
    if (isCardRef(looked)) return { filter: looked, where: { zone: 'Play' } };
    return { difference: [looked, taken.length === 1 ? taken[0] : { union: taken }] };
}

/** Objects after looking: "one", "2", "the rest", "the other", "any number of them". */
function lookedObject(c: Parser, steps: Step[]): CardSelection | undefined {
    const looked = c.state.looked;
    if (!looked) return undefined;
    return c.try((): CardSelection | undefined => {
        if (c.lit('the rest', 'the other', 'the others', 'all the others')) return rest(c);
        // "them" after choosing among the looked-at cards means the chosen ones.
        if (c.lit('them', 'all of them')) return c.state.it ?? looked;
        if (c.lit('revealed character cards', 'all revealed character cards')) {
            const taken: CardSelection = { filter: looked, where: { cardType: 'Character' } };
            c.state.taken = [...(c.state.taken ?? []), taken];
            return taken;
        }
        const count = c.try((): Amount | 'Any' | undefined => {
            if (c.lit('any number of them', 'any number of the cards')) return 'Any';
            if (c.lit('one of them', 'one of those cards', 'one')) return 1;
            if (c.lit('each')) {
                const kind = cardKind(c);
                if (!kind) return 'Any';
                c.state.eachKind = kind;
                return 'Any';
            }
            const n = digits(c);
            return n !== undefined && !c.peek('(cards?|damage|\\{)') ? n : undefined;
        });
        if (count === undefined) return undefined;
        const id = nextId(c);
        const actor = c.state.actor;
        const kind = c.state.eachKind;
        c.state.eachKind = undefined;
        const pool = rest(c) ?? looked;
        steps.push({ kind: 'Choose Cards', id, from: kind ? { filter: pool, where: kind } : pool, count, ...(actor !== 'You' ? { player: actor } : {}) });
        const ref = cardRef(id);
        c.state.taken = [...(c.state.taken ?? []), ref];
        c.state.it = ref;
        if (count === 1) c.state.single = [...(c.state.single ?? []), id];
        return ref;
    });
}

/** A choice over the looked-at cards: "a character card" means one of them. */
function fromLooked(c: Parser, np: CardNP): CardNP {
    const looked = c.state.looked;
    if (!looked || np.kind !== 'Choose') return np;
    const from = np.from;
    if (typeof from !== 'object' || !('zone' in from) || from.zone !== 'Play' || from.player !== undefined) return np;
    const where = selectorFilter(from);
    const pool = rest(c) ?? looked;
    return { ...np, from: Object.keys(where).length ? { filter: pool, where } : pool };
}

/** A selector's description as a filter on other cards. */
function selectorFilter(selector: CardSelector): CardFilter {
    return { ...(selector.cardType ? { cardType: selector.cardType } : {}), ...(selector.where ?? {}) };
}

/** Place one object: "into your hand", "on either the top or the bottom of your deck". */
function placement(c: Parser, target: CardSelection): Effect | undefined {
    return c.try((): Effect | undefined => {
        if (eitherEnd(c)) {
            // "Put any number of them on the top or the bottom of your deck in any order" splits the
            // looked-at cards: the chosen ones go to the bottom and the rest return to the top (The Boss is on a Roll).
            const looked = c.state.looked;
            if (looked && JSON.stringify(looked) !== JSON.stringify(target) && c.peek('in any order')) {
                c.lit('in any order');
                return { type: 'Sequence', effects: [
                    { type: 'Move Card', cards: target, to: 'Deck', position: 'Bottom', order: 'Chosen' },
                    { type: 'Move Card', cards: { difference: [looked, target] }, to: 'Deck', position: 'Top', order: 'Chosen' },
                ] };
            }
            return { type: 'Choose Mode', options: [
                { type: 'Move Card', cards: target, to: 'Deck', position: 'Top', ...deckOrder(c) },
                { type: 'Move Card', cards: target, to: 'Deck', position: 'Bottom' },
            ] };
        }
        const either = Boolean(c.lit('on either'));
        if (either && c.lit('the top of')) {
            if (!zoneOwner(c) || !c.lit('deck')) return undefined;
            const other = c.try(() => c.lit('or') ? destination(c) : undefined);
            if (!other) return undefined;
            return { type: 'Choose Mode', options: [moveEffect(target, { to: 'Deck', position: 'Top' }), moveEffect(target, other)] };
        }
        const where = destination(c);
        if (!where) return undefined;
        const alternative = c.try(() => c.lit('or') ? destination(c) : undefined);
        if (alternative) return { type: 'Choose Mode', options: [moveEffect(target, where), moveEffect(target, alternative)] };
        return moveEffect(target, where);
    });
}

/** An object to move, which may be one of the looked-at cards. */
function moveObject(c: Parser, steps: Step[]): CardSelection | undefined {
    const looked = lookedObject(c, steps);
    if (looked !== undefined) return looked;
    const np = cardNP(c, steps);
    if (!np) return undefined;
    const chosen = fromLooked(c, np);
    const target = useCards(c, chosen, steps);
    if (chosen !== np || (c.state.looked && typeof target === 'object' && 'filter' in target &&
        typeof target.filter === 'object' && 'result' in target.filter &&
        typeof c.state.looked === 'object' && 'result' in c.state.looked && target.filter.result === c.state.looked.result))
        c.state.taken = [...(c.state.taken ?? []), target];
    c.lit('from your discard', 'from their discard');
    return target;
}

const put: Verb = (c) => {
    if (!c.lit('put', 'puts')) return undefined;
    const steps: Step[] = [];
    const earlier = c.state.it;
    const target = moveObject(c, steps);
    if (target === undefined) return undefined;
    const positional = typeof target === 'object' && 'zone' in target && target.take !== undefined;
    const under = c.try(() => {
        c.lit('facedown');
        if (!c.lit('under')) return undefined;
        // "Under them" names an earlier card, never the card being moved.
        const moved = c.state.it;
        c.state.it = earlier;
        const owner = cards(c, steps);
        c.state.it = moved;
        if (owner === undefined) return undefined;
        const faceUp = Boolean(c.lit('faceup'));
        c.lit('facedown');
        return { owner, faceDown: !faceUp };
    });
    if (under) {
        if (isSingle(c, under.owner) || !(typeof under.owner === 'object' && 'zone' in under.owner)) {
            steps.push(effectStep({ type: 'Move Card', cards: target, to: 'Under', under: under.owner, faceDown: under.faceDown }));
            if (positional) c.state.it = { result: 'Moved Cards' };
            return steps;
        }
        const id = nextId(c);
        steps.push({ kind: 'For Each Card', id, cards: under.owner },
            effectStep({ type: 'Move Card', cards: target, to: 'Under', under: cardRef(id), faceDown: under.faceDown }));
        const folded = [effectStep(fold(steps))];
        c.state.it = under.owner;
        return folded;
    }
    const first = placement(c, target);
    if (!first) return undefined;
    steps.push(effectStep(first));
    // After moving cards picked by position, "it" means the moved cards, not the new top card.
    if (positional) c.state.it = { result: 'Moved Cards' };
    if (isCardRef(c.state.looked)) return [effectStep(fold(steps))];
    // "Put one into your hand and the other on the bottom of your deck."
    for (;;) {
        const more = c.try(() => {
            if (!c.lit('and')) return undefined;
            c.lit('put');
            const extra: Step[] = [];
            const next = lookedObject(c, extra);
            if (next === undefined) return undefined;
            const effect = placement(c, next);
            if (!effect) return undefined;
            return isCardRef(c.state.looked) ? [effectStep(fold([...extra, effectStep(effect)]))] : [...extra, effectStep(effect)];
        });
        if (!more) break;
        steps.push(...more);
    }
    return steps;
};

const returnTo: Verb = (c, actor) => {
    if (!c.lit('return', 'returns')) return undefined;
    const steps: Step[] = [];
    const random = c.try(() => {
        const n = c.try(() => {
            const value = number(c);
            return value !== undefined && c.lit('cards at random from') ? value as Amount : undefined;
        }) ?? (c.lit('cards at random from') ? 'Until' as const : undefined);
        if (n === undefined) return undefined;
        zoneOwner(c);
        if (!c.lit('inkwell') || !c.lit('to')) return undefined;
        zoneOwner(c);
        if (!c.lit('hand')) return undefined;
        let count: Amount | undefined = n === 'Until' ? undefined : n;
        if (n === 'Until') {
            if (!c.lit('until they have', 'until you have')) return undefined;
            const keep = number(c);
            if (keep === undefined || !c.lit('cards in their inkwell', 'cards in your inkwell')) return undefined;
            count = { max: [0, { subtract: [{ count: { zone: 'Inkwell', player: actor } }, keep] }] };
        }
        if (count === undefined) return undefined;
        const id = nextId(c);
        return [{ kind: 'Random Cards', id, from: { zone: 'Inkwell', player: actor }, count } as Step,
            effectStep({ type: 'Move Card', cards: cardRef(id), to: 'Hand' })];
    });
    if (random) return random;
    const target = moveObject(c, steps);
    if (target === undefined) return undefined;
    c.lit('each');
    const where = destination(c);
    if (!where) return undefined;
    steps.push(effectStep(moveEffect(target, where)));
    return isCardRef(c.state.looked) ? [effectStep(fold(steps))] : steps;
};

const shuffleInto: Verb = (c) => {
    if (!c.lit('shuffle', 'shuffles')) return undefined;
    const steps: Step[] = [];
    const target = lookedObject(c, steps) ?? cards(c, steps);
    if (target === undefined || !c.lit('into')) return undefined;
    zoneOwner(c);
    if (!c.lit('deck', 'decks')) return undefined;
    steps.push(effectStep({ type: 'Move Card', cards: target, to: 'Deck', position: 'Shuffle' }));
    return steps;
};

const shuffleDeck: Verb = (c, actor) => {
    if (!c.lit('shuffle your deck', 'shuffles their deck', 'shuffle their deck')) return undefined;
    return step({ type: 'Shuffle', player: actor });
};

/** A choice made from a player's own zone, by that player unless "of your choice". */
function handChoice(c: Parser, actor: PlayerSelection, steps: Step[], zone: 'Hand' | 'Play'): CardSelection | undefined {
    const saved = c.state.they;
    c.state.they = actor;
    const np = cardNP(c, steps);
    c.state.they = saved;
    if (!np || np.kind !== 'Choose') return undefined;
    const yours = Boolean(c.lit('of your choice'));
    c.lit('of their choice');
    const from = zone === 'Hand' ? withZone(np.from, 'Hand', actor) : np.from;
    return useCards(c, { ...np, from, chooser: yours ? 'You' : actor }, steps);
}

/** "choose and discard a card", "chooses and banishes one of their characters". */
const chooseAnd: Verb = (c, actor) => {
    if (!c.lit('choose and', 'chooses and', 'may choose and')) return undefined;
    const verb = c.lit('discards', 'discard', 'banishes', 'banish', 'exerts', 'exert');
    if (!verb) return undefined;
    const steps: Step[] = [];
    const type = /discard/i.test(verb) ? 'Discard' as const : /banish/i.test(verb) ? 'Banish' as const : 'Exert' as const;
    if (type === 'Discard') {
        const counted = c.try(() => {
            const until = c.try(() => {
                if (!c.lit('cards until they have', 'cards until you have')) return undefined;
                const n = number(c);
                if (n === undefined) return undefined;
                c.lit('cards in their hand', 'cards');
                return excess(actor, n);
            });
            if (until) return until;
            if (c.lit('any number of cards')) return 'Any' as const;
            if (c.lit('that many cards') && c.state.counted !== undefined) return c.state.counted;
            const n = c.try(() => {
                const value = number(c);
                return value !== undefined && c.lit('cards', 'card') && c.peek('for each') ? value : undefined;
            });
            if (n === undefined) return undefined;
            return perEach(c, n);
        });
        if (counted !== undefined) {
            const id = nextId(c);
            steps.push({ kind: 'Choose Cards', id, from: { zone: 'Hand', player: actor }, count: counted, player: actor });
            steps.push(effectStep({ type: 'Discard', cards: cardRef(id) }));
            c.state.counted = { count: { result: 'Discarded Cards' } };
            return steps;
        }
        const either = c.try(() => {
            if (!c.lit('either')) return undefined;
            const first = oneOrMore(c);
            if (first === undefined || !c.lit('or')) return undefined;
            const alt: Step[] = [];
            const second = handChoice(c, actor, alt, 'Hand');
            if (second === undefined) return undefined;
            const id = nextId(c);
            return [effectStep({ type: 'Or', ...(actor !== 'You' ? { player: actor } : {}), options: [
                fold([{ kind: 'Choose Cards', id, from: { zone: 'Hand', player: actor }, count: first, player: actor },
                    effectStep({ type: 'Discard', cards: cardRef(id) })]),
                fold([...alt, effectStep({ type: 'Discard', cards: second })]),
            ] })];
        });
        if (either) return either;
    }
    // Each choice is followed by its instruction, so later choices do not hide earlier ones.
    const lists = c.list(() => {
        const local: Step[] = [];
        const target = handChoice(c, actor, local, type === 'Discard' ? 'Hand' : 'Play');
        return target === undefined ? undefined : [...local, effectStep({ type, cards: target })];
    }, ['and']);
    if (!lists) return undefined;
    steps.push(...lists.flat());
    if (type === 'Discard') c.state.counted = { count: { result: 'Discarded Cards' } };
    return steps;
};

/** "chooses one of their characters and deals 2 damage to them". */
const chooseThen: Verb = (c, actor) => {
    if (!c.lit('chooses', 'choose')) return undefined;
    const steps: Step[] = [];
    const saved = c.state.they;
    if (actor !== 'You' || !saved) c.state.they = actor;
    const np = cardNP(c, steps);
    c.state.they = saved;
    if (!np || np.kind !== 'Choose') return undefined;
    const chosen = useCards(c, { ...np, chooser: actor }, steps);
    if (np.count !== 1) {
        // "chooses 3 of their characters and returns one of those cards ..."
        c.state.looked = chosen;
        c.state.taken = [];
    }
    if (c.peek('\\.') || c.done) return steps;
    if (!c.lit('and')) return undefined;
    const rest = verbPhrase(c, actor);
    if (!rest) return undefined;
    return [...steps, ...rest];
};

/** Default a selector to a zone owned by a player, e.g. a card to discard is in hand. */
function withZone(from: CardSelection, zone: 'Hand' | 'Discard', player: PlayerSelection): CardSelection {
    if (typeof from === 'object' && 'zone' in from && from.zone === 'Play') return { ...from, zone, player: from.player ?? player };
    return from;
}

const discard: Verb = (c, actor) => {
    if (!c.lit('discard', 'discards')) return undefined;
    if (c.lit('your hand', 'their hand', 'their hands', 'all cards in their hand', 'all cards in your hand')) {
        return step({ type: 'Discard', cards: { zone: 'Hand', player: actor } });
    }
    const random = c.try(() => {
        const n = oneOrMore(c);
        return n !== undefined && c.lit('at random') ? n : undefined;
    });
    if (random !== undefined) {
        const id = nextId(c);
        return [{ kind: 'Random Cards', id, from: { zone: 'Hand', player: actor }, count: random }, effectStep({ type: 'Discard', cards: cardRef(id) })];
    }
    const until = c.try(() => {
        if (!c.lit('until they have', 'until you have')) return undefined;
        const n = number(c);
        if (n === undefined) return undefined;
        c.lit('cards in their hand', 'cards in your hand', 'cards');
        return n;
    });
    if (until !== undefined) {
        const id = nextId(c);
        return [{ kind: 'Choose Cards', id, from: { zone: 'Hand', player: actor }, count: excess(actor, until), player: actor },
            effectStep({ type: 'Discard', cards: cardRef(id) })];
    }
    const n = c.try(() => {
        const value = oneOrMore(c);
        return value !== undefined && !c.peek('of your choice') ? value : undefined;
    });
    if (n !== undefined) {
        const id = nextId(c);
        return [{ kind: 'Choose Cards', id, from: { zone: 'Hand', player: actor }, count: n, player: actor },
            effectStep({ type: 'Discard', cards: cardRef(id) })];
    }
    const steps: Step[] = [];
    const chosen = handChoice(c, actor, steps, 'Hand');
    if (chosen === undefined) return undefined;
    steps.push(effectStep({ type: 'Discard', cards: chosen }));
    return steps;
};

const exertBanishReady: Verb[] = [
    simpleCardVerb(['banish', 'banishes'], 'Banish'),
    simpleCardVerb(['exert', 'exerts', '{E}'], 'Exert'),
    simpleCardVerb(['ready', 'readies'], 'Ready'),
];

const removeDamage: Verb = (c) => {
    if (!c.lit('remove', 'removes')) return undefined;
    const steps: Step[] = [];
    if (c.lit('all damage from')) {
        const target = cards(c, steps);
        if (target === undefined) return undefined;
        steps.push(effectStep({ type: 'Remove Damage', cards: target, amount: 'All' }));
        return steps;
    }
    const upTo = Boolean(c.lit('up to'));
    const n = number(c);
    if (n === undefined || !c.lit('damage')) return undefined;
    const total = Boolean(c.lit('total'));
    c.lit('each');
    if (!c.lit('from')) return undefined;
    const target = cards(c, steps);
    if (target === undefined) return undefined;
    steps.push(effectStep({ type: 'Remove Damage', cards: target, amount: upTo ? { upTo: n } : n, ...(total ? { distribution: 'Total' } : {}) }));
    return steps;
};

const moveDamage: Verb = (c) => {
    if (!c.lit('move', 'moves')) return undefined;
    const steps: Step[] = [];
    let all = false;
    const amount = c.try((): Amount | { upTo: Amount } | undefined => {
        if (c.lit('all damage counters', 'all damage')) {
            all = true;
            return { stat: 'Damage', card: 'Parent Selected Cards' };
        }
        const upTo = Boolean(c.lit('up to'));
        const n = number(c);
        if (n === undefined || !c.lit('damage counters', 'damage counter', 'damage')) return undefined;
        return upTo ? { upTo: n } : n;
    });
    if (amount === undefined || !c.lit('from')) return undefined;
    const recipient = c.state.it;
    const np = cardNP(c, steps);
    if (!np) return undefined;
    let from = useCards(c, np, steps);
    const severalDonors = !isSingle(c, from);
    if (severalDonors) c.state.it = recipient;
    if (!c.lit('to')) return undefined;
    // Choose the recipient once, not separately for each damage donor.
    const to = cards(c, steps);
    if (to === undefined) return undefined;
    if (severalDonors) {
        // Damage moves from each card separately.
        const id = nextId(c);
        steps.push({ kind: 'For Each Card', id, cards: from });
        from = cardRef(id);
        c.state.single = [...(c.state.single ?? []), id];
    }
    steps.push(effectStep({ type: 'Move Damage', from, to, amount: all ? { stat: 'Damage', card: from } : amount }));
    return steps;
};

const moveToLocation: Verb = (c) => {
    if (!c.lit('move', 'moves')) return undefined;
    const steps: Step[] = [];
    const first = cards(c, steps);
    if (first === undefined) return undefined;
    // "move him and one of your other characters to the same location"
    const second = c.try(() => {
        if (!c.lit('and')) return undefined;
        const np = cardNP(c, steps);
        return np ? useCards(c, np, steps) : undefined;
    });
    const target: CardSelection = second === undefined ? first : { union: [first, second] };
    if (c.lit('from here')) {
        // "move chosen character from here": the choice is limited to characters at this location.
        const chosen = steps.find((step) => step.kind === 'Choose Cards' && isCardRef(first) && (first as unknown as { $cards: number }).$cards === step.id);
        if (!chosen || chosen.kind !== 'Choose Cards' || typeof chosen.from !== 'object' || !('zone' in chosen.from) || c.state.source === 'Character') return undefined;
        chosen.from = { ...chosen.from, where: mergeFilters([chosen.from.where ?? {}, { at: 'Self' }]) };
    }
    if (!c.lit('to')) return undefined;
    let where: CardSelection | undefined;
    const which = c.lit('the same location', 'a location', 'one of your locations', 'another location', 'that location');
    if (which) {
        const phrase = which.toLowerCase();
        if (phrase.endsWith('that location')) where = c.state.location ?? it(c);
        else {
            const id = nextId(c);
            const mine = phrase.endsWith('your locations');
            const another = phrase.endsWith('another location');
            steps.push({ kind: 'Choose Cards', id, count: 1, from: { zone: 'Play', cardType: 'Location',
                ...(mine ? { player: 'You' } : {}), ...(another ? { exclude: { locationOf: first } } : {}) } });
            where = cardRef(id);
            c.state.single = [...(c.state.single ?? []), id];
        }
    } else where = cards(c, steps);
    if (where === undefined) return undefined;
    const free = Boolean(c.lit('for free'));
    steps.push(effectStep({ type: 'Move To Location', cards: target, location: where, ...(free ? { free: true } : {}) }));
    c.state.it = where;
    if (second !== undefined) c.state.it = second;
    c.state.location = where;
    c.state.moved = target;
    return steps;
};

const play: Verb = (c, actor) => {
    const method = c.lit('play or shift') ? 'Play Or Shift' as const : c.lit('shift') ? 'Shift' as const : undefined;
    if (!method && !c.lit('play', 'plays')) return undefined;
    const steps: Step[] = [];
    const again = c.try(() => c.lit('that song again') ? true : undefined);
    const np = again ? { kind: 'Fixed' as const, cards: { event: 'Song' } as CardSelection, plural: false } : cardNP(c, steps);
    if (!np) return undefined;
    const zone = c.try(() => zonePhrase(c, steps));
    let chosen = np;
    if (np.kind === 'Choose') {
        let from = fromLooked(c, np).kind === 'Choose' ? (fromLooked(c, np) as typeof np).from : np.from;
        if (zone && typeof from === 'object' && 'zone' in from) from = { ...from, zone: zone.zone, ...(zone.player !== undefined ? { player: zone.player } : {}) };
        else from = withZone(from, 'Hand', actor);
        if (zone?.alsoHand && typeof from === 'object' && 'zone' in from) from = { ...from, zone: 'Any', where: { ...(from.where ?? {}), or: [{ zone: 'Hand' }, { zone: 'Discard' }] } };
        chosen = { ...np, from };
    }
    if (np.kind === 'Fixed' && zone) chosen = { ...np, cards: { filter: np.cards, where: {
        ...(zone.zone !== 'Any' ? { zone: zone.zone } : {}), ...(zone.player !== undefined ? { player: zone.player } : {}),
    } } };
    const target = useCards(c, chosen, steps);
    c.lit('from there', 'from your discard', 'from their discard');
    const free = Boolean(c.lit('for free'));
    if (!zone) c.try(() => zonePhrase(c, steps) ? true : undefined);
    const exerted = Boolean(c.lit(', exerted', 'exerted', 'and they enter play exerted', 'and it enters play exerted',
        'and she enters play exerted', 'and he enters play exerted'));
    c.lit('as if it were in your hand');
    const bottom = Boolean(c.lit(', then put it on the bottom of your deck instead of into your discard',
        'then put that action card on the bottom of your deck instead of into your discard',
        ', then put that action card on the bottom of your deck instead of into your discard'));
    steps.push(effectStep({ type: 'Play', cards: target, ...(free ? { free: true } : {}), ...(exerted ? { exerted: true } : {}),
        ...(method ? { method } : {}), ...(actor !== 'You' ? { player: actor } : {}), ...(bottom ? { afterwards: 'Deck Bottom' } : {}) }));
    return steps;
};

const look: Verb = (c, actor) => {
    if (!c.lit('look at')) return undefined;
    const steps: Step[] = [];
    const target = c.try((): CardSelection | undefined => {
        const top = deckTop(c, steps, actor);
        if (top) return top;
        const count = c.try(() => {
            if (!c.lit('a number of cards from the top of your deck equal to')) return undefined;
            return amountOf(c);
        });
        if (count !== undefined) return { zone: 'Deck', player: actor, position: 'Top', take: count };
        if (c.lit("each opponent's hand")) return { zone: 'Hand', player: 'Opponents' };
        if (c.lit("the top card of each opponent's deck")) return { zone: 'Deck', player: 'Opponents', position: 'Top', take: 1 };
        if (c.lit('the cards in your inkwell')) return { zone: 'Inkwell', player: 'You' };
        const owner = possessive(c, steps);
        if (owner !== undefined && c.lit('hand')) return { zone: 'Hand', player: owner };
        return undefined;
    });
    if (!target) return undefined;
    steps.push(effectStep({ type: 'Look', cards: target }));
    const inkwell = typeof target === 'object' && 'zone' in target && target.zone === 'Inkwell';
    c.state.it = { result: 'Looked At Cards' };
    c.state.looked = inkwell ? target : { result: 'Looked At Cards' };
    c.state.taken = [];
    return steps;
};

const reveal: Verb = (c, actor) => {
    if (!c.lit('reveal', 'reveals')) return undefined;
    const steps: Step[] = [];
    if (c.lit('their hand', 'your hand', 'his hand', 'her hand')) {
        steps.push(effectStep({ type: 'Reveal', cards: { zone: 'Hand', player: actor } }));
        return steps;
    }
    const top = deckTop(c, steps, actor) ?? c.try(() => {
        if (!c.lit('a number of cards from the top of your deck equal to')) return undefined;
        const n = amountOf(c);
        return n === undefined ? undefined : { zone: 'Deck', player: actor, position: 'Top', take: n } as CardSelection;
    });
    if (top) {
        steps.push(effectStep({ type: 'Reveal', cards: top }));
        c.state.it = { result: 'Revealed Cards' };
        c.state.looked = { result: 'Revealed Cards' };
        c.state.taken = [];
        return steps;
    }
    const until = c.try(() => {
        if (!c.lit('cards from the top of your deck until you reveal')) return undefined;
        return cardKind(c);
    });
    if (until) {
        steps.push(effectStep({ type: 'Reveal Until', player: actor, where: until }));
        c.state.looked = { result: 'Revealed Cards' };
        c.state.taken = [];
        c.state.it = { filter: { result: 'Revealed Cards' }, where: until };
        return steps;
    }
    if (c.lit('it', 'that card', 'them')) {
        c.lit('to all players');
        return step({ type: 'Reveal', cards: it(c) });
    }
    // "reveal up to 1 character card and up to 1 item card", "a character card named Kevin or an item card"
    const fromPool = c.try(() => {
        if (!c.state.looked) return undefined;
        const picks = c.list((): CardSelection | undefined => {
            const count = c.try((): Amount | { upTo: Amount } | 'Any' | undefined => {
                if (c.lit('any number of')) return 'Any';
                if (c.lit('up to')) {
                    const n = number(c);
                    return n === undefined ? undefined : { upTo: n };
                }
                return c.peek('an? ') ? 1 : undefined;
            });
            if (count === undefined) return undefined;
            const kind = cardKind(c);
            if (!kind) return undefined;
            const pool = rest(c) ?? c.state.looked!;
            const id = nextId(c);
            steps.push({ kind: 'Choose Cards', id, from: { filter: pool, where: kind }, count });
            const ref = cardRef(id);
            c.state.taken = [...(c.state.taken ?? []), ref];
            if (count === 1) c.state.single = [...(c.state.single ?? []), id];
            return ref;
        }, ['and']);
        if (!picks) return undefined;
        const target: CardSelection = picks.length === 1 ? picks[0] : { union: picks };
        c.state.it = target;
        return target;
    });
    if (fromPool !== undefined) {
        steps.push(effectStep({ type: 'Reveal', cards: fromPool }));
        return steps;
    }
    // "reveal a character card and put it into your hand" after looking, or a card from a hand.
    const np = cardNP(c, steps);
    if (!np || np.kind !== 'Choose') return undefined;
    const chosen = fromLooked(c, np);
    const inHand = typeof np.from === 'object' && 'zone' in np.from && np.from.zone === 'Hand';
    if (chosen === np && !inHand) return undefined;
    const target = useCards(c, chosen, steps);
    if (chosen !== np) c.state.taken = [...(c.state.taken ?? []), target];
    steps.push(effectStep({ type: 'Reveal', cards: target }));
    return steps;
};

/** "search your deck for a Princess character card and reveal that card to all players". */
const search: Verb = (c, actor) => {
    if (!c.lit('search your deck for')) return undefined;
    const steps: Step[] = [];
    const kind = c.try((): CardFilter | undefined => {
        if (c.lit('any card')) return {};
        return cardKind(c);
    });
    if (kind === undefined) return undefined;
    const id = nextId(c);
    steps.push({ kind: 'Search', id, from: { zone: 'Deck', player: actor, ...(Object.keys(kind).length ? { where: kind } : {}) }, count: 1 });
    c.state.it = cardRef(id);
    c.state.single = [...(c.state.single ?? []), id];
    return steps;
};

const inkDrop: Verb = (c, actor) => {
    if (!c.lit('get', 'gets')) return undefined;
    const n = number(c);
    if (n === undefined || !c.lit('ink drops', 'ink drop')) return undefined;
    return step({ type: 'Gain Ink Drops', player: actor, amount: n });
};

const steal: Verb = (c) => {
    if (!c.lit('steals', 'steal')) return undefined;
    const name = c.lit('the reforged crown');
    if (!name) return undefined;
    return step({ type: 'Gain Control', cards: { zone: 'Play', cardType: 'Item', where: { name: 'The Reforged Crown' } } });
};

/** "give chosen character +2 {S} this turn". */
function giveClause(c: Parser): Step[] | undefined {
    return c.try(() => {
        if (!c.lit('give')) return undefined;
        const steps: Step[] = [];
        const np = cardNP(c, steps);
        if (!np) return undefined;
        const changes = c.list((): CardChange[] | undefined => {
            const stat = statChange(c);
            if (stat) return [stat];
            return grants(c);
        }, ['and']);
        if (!changes) return undefined;
        const d = duration(c) ?? c.state.duration;
        const target = useCards(c, np, steps);
        for (const change of changes.flat()) {
            steps.push(effectStep({ type: 'Modify Cards', cards: target, modifier: change, ...(d ? { duration: d } : {}) }));
        }
        return steps;
    });
}

const give: Verb = (c) => giveClause(c);

const costReduction: Verb = (c) => {
    if (!c.lit('pay')) return undefined;
    const amount = c.try((): Amount | undefined => {
        if (c.lit('that amount of {I}')) return c.state.counted;
        const n = number(c);
        return n !== undefined && c.lit('{I}') ? n : undefined;
    });
    if (amount === undefined || !c.lit('less for the next')) return undefined;
    const steps: Step[] = [];
    const described = bareCards(c, steps, 'You');
    if (!described || steps.length) return undefined;
    const shift = Boolean(c.lit('you shift this turn'));
    if (!shift && !c.lit('you play this turn')) return undefined;
    const negative: Amount = typeof amount === 'number' ? -amount : { multiply: [-1, amount] };
    const playable = described.anyZone();
    return step({ type: 'Create Rule', uses: 1, duration: { until: 'End Of Turn' },
        rule: shift ? { type: 'Modify Cost', cards: playable, amount: negative, for: 'Shift' }
            : { type: 'Modify Cost', cards: playable, amount: negative, for: 'Play' } });
};

const nameCard: Verb = (c) => {
    if (!c.lit('name a card')) return undefined;
    c.state.named = true;
    return step({ type: 'Name Card' });
};

const inkAdditional: Verb = (c, actor) => {
    if (!c.lit('ink an additional card')) return undefined;
    const d = c.state.duration ?? { until: 'End Of Turn' };
    return step({ type: 'Create Rule', rule: { type: 'Modify Players', players: actor, modifier: { additionalInk: 1 } }, duration: d });
};

/** "can't play actions until the start of your next turn" for a player subject. */
const playerRestriction: Verb = (c, actor) => {
    if (!c.lit("can't play")) return undefined;
    const steps: Step[] = [];
    const described = bareCards(c, steps, undefined);
    if (!described || steps.length) return undefined;
    const d = duration(c) ?? c.state.duration;
    if (!d) return undefined;
    return step({ type: 'Create Rule', rule: { type: 'Modify Players', players: actor, modifier: { restriction: "Can't Play", where: described.filter() } }, duration: d });
};

/** Sisu - Uniting Dragon: "put it into your hand and repeat this effect". */
const repeatEffect: Verb = (c) => {
    if (!c.lit('repeat this effect')) return undefined;
    return step(repeatMarker);
};

/** "add his {W} to another chosen character's {S} this turn". */
const addStat: Verb = (c) => {
    if (!c.lit('add')) return undefined;
    const amount = amountOf(c);
    if (amount === undefined || !c.lit('to')) return undefined;
    const steps: Step[] = [];
    const np = cardNP(c, steps);
    if (!np || np.kind !== 'Choose' || !np.possessive) return undefined;
    const stat = statSymbol(c);
    if (!stat) return undefined;
    const d = duration(c);
    const target = useCards(c, np, steps);
    steps.push(effectStep({ type: 'Modify Cards', cards: target, modifier: { stat, amount }, ...(d ? { duration: d } : {}) }));
    return steps;
};

const verbs: Verb[] = [repeatEffect, addStat, draw, damage, putDamage, lore, returnTo, chooseAnd, chooseThen, discard, ...exertBanishReady, removeDamage,
    moveDamage, moveToLocation, put, shuffleInto, shuffleDeck, play, look, reveal, search, inkDrop, steal, give, costReduction,
    nameCard, inkAdditional, playerRestriction];

// ---------------------------------------------------------------------------
// Delayed and created triggers

/** "At the end of your turn, banish them." inside an effect. */
function delayedClause(c: Parser): Step[] | undefined {
    return c.try(() => {
        if (!c.lit('at the end of your turn,', 'at the end of the turn,')) return undefined;
        const body = chain(c);
        if (!body) return undefined;
        return step({ type: 'Delay', until: { turnEnd: 'You' }, effect: foldOrEmpty(body) });
    });
}

/** "Whenever one of your characters quests this turn, gain 1 lore." inside an effect. */
function createdTrigger(c: Parser): Step[] | undefined {
    return c.try(() => {
        const trigger = c.state.parseTrigger?.(c);
        if (!trigger) return undefined;
        const saved = c.state.it;
        if (!('anyOf' in trigger.pattern) && 'card' in trigger.pattern && trigger.pattern.card !== undefined && trigger.pattern.card !== 'Self') {
            c.state.it = { event: 'Card' };
        }
        const body = chain(c);
        c.state.it = saved;
        if (!body) return undefined;
        return step({ type: 'Create Trigger', trigger: trigger.pattern, effect: foldOrEmpty(body),
            duration: trigger.duration ?? c.state.duration ?? { until: 'End Of Turn' }, ...(trigger.uses ? { uses: trigger.uses } : {}) });
    });
}

export { anyZone, cardsReference };
export type { EventPattern };

/** Whether the triggering event is of this kind. */
function eventIs(c: Parser, kind: string): boolean {
    const pattern = c.state.event;
    return pattern !== undefined && 'event' in pattern && pattern.event === kind;
}
