import type { PlayerAction } from "../../model/turn";
import { expect, expectTypeOf, it } from 'vitest';
import type { Effect } from '../../model/ability';
import type { AbilityReference, CardModifier, CardState, EffectExpiry, EffectSource, GameState, PlayerModifier, PlayerPosition } from '../../model/game-state';
import type { CardIdentifier, PlayerNumber } from '../../model/identity';
import { getModifiedStat } from '../../model/game-state';
import { modifierExamples, abilityExamples, grantedAbilityExample, playerModifierExamples } from '../../model/examples';

it('uses player numbers 1 through 10 independently of zero-based ability slots', () => {
    expectTypeOf<1 | 10>().toExtend<PlayerNumber>();
    expectTypeOf<0 | 11>().not.toExtend<PlayerNumber>();
    expectTypeOf<AbilityReference['i']>().toEqualTypeOf<number>();
});

it('combines signed modifiers before clamping, independent of array order', () => {
    const modifiers: CardModifier[] = [
        { stat: 'Strength', amount: -5 }, { stat: 'Strength', amount: 1 },
        { stat: 'Strength', amount: 1 }, { stat: 'Lore', amount: 10 },
    ];
    expect(getModifiedStat(2, 'Strength', modifiers)).toBe(0);
    expect(getModifiedStat(2, 'Strength', [...modifiers, { stat: 'Strength', amount: 2 }])).toBe(1);
    expect(getModifiedStat(2, 'Strength', [...modifiers].reverse())).toBe(0);
    expect(getModifiedStat(1, 'Lore', [{ stat: 'Lore', amount: -2 }])).toBe(0);
});

it('applies the strongest stat floor after combining every delta', () => {
    const modifiers: CardModifier[] = [
        { minimumStat: 'Strength', amount: 3 }, { stat: 'Strength', amount: -5 },
        { minimumStat: 'Strength', amount: 2 }, { stat: 'Strength', amount: 1 },
    ];
    expect(getModifiedStat(3, 'Strength', modifiers)).toBe(3);
    expect(getModifiedStat(3, 'Strength', [...modifiers].reverse())).toBe(3);
    expect(getModifiedStat(3, 'Strength', [...modifiers, { stat: 'Strength', amount: 7 }])).toBe(6);
});

it('keeps printed definitions and execution bookkeeping out of the board contract', () => {
    expectTypeOf<'strength'>().not.toExtend<keyof CardState>();
    expectTypeOf<'names'>().not.toExtend<keyof CardState>();
    expectTypeOf<'lastKnown'>().not.toExtend<keyof CardState>();
    expectTypeOf<'pending'>().not.toExtend<keyof GameState>();
    expectTypeOf<'configuration'>().not.toExtend<keyof GameState>();
    expectTypeOf<'version'>().not.toExtend<keyof GameState>();
    expectTypeOf<'position'>().not.toExtend<keyof GameState>();
    expectTypeOf<'result'>().not.toExtend<keyof GameState>();
    expectTypeOf<'eliminated'>().not.toExtend<keyof PlayerPosition>();
    expectTypeOf<CardState['card']>().toEqualTypeOf<CardIdentifier>();
    expectTypeOf<Extract<PlayerAction, { type: 'Challenge' }>['defender']>().toEqualTypeOf<CardIdentifier>();
});

it('stores one-use damage prevention on the protected card, not on its source', () => {
    expectTypeOf<{ preventDamage: 'Next'; expires: { startOfNextTurn: 1; afterTurn: 7 } }>().toExtend<CardModifier>();
    expectTypeOf<{ preventDamage: 'All' }>().not.toExtend<CardModifier>();
    expect(modifierExamples.rapunzelProtection).toEqual({ preventDamage: 'Next', expires: { startOfNextTurn: 1, afterTurn: 7 } });
    expect(abilityExamples.rapunzelProtection.effect.type).toBe('Modify Cards');
});

it('represents future activation separately from expiration', () => {
    expect(modifierExamples.johnSilver).toEqual({
        gainKeyword: 'Reckless',
        starts: { startOfNextTurn: 2, afterTurn: 7 },
        expires: { endOfNextTurn: 2, afterTurn: 7 },
    });
    expectTypeOf<CardModifier['starts']>().toEqualTypeOf<PlayerModifier['starts']>();
    expectTypeOf<'history'>().not.toExtend<keyof GameState>();
});

it('references ability definitions without assigning identities to effects', () => {
    expectTypeOf<'grantedBy'>().not.toExtend<keyof AbilityReference>();
    expectTypeOf<AbilityReference['i']>().toEqualTypeOf<number>();
    expectTypeOf<AbilityReference['card']>().toEqualTypeOf<CardIdentifier>();
});

it('stores expiring modifiers on the affected card or player, not globally', () => {
    expectTypeOf<'effects'>().not.toExtend<keyof GameState>();
    expectTypeOf<CardState['modifiers']>().toEqualTypeOf<CardModifier[] | undefined>();
    expectTypeOf<PlayerPosition['modifiers']>().toEqualTypeOf<PlayerModifier[] | undefined>();
    expectTypeOf<CardModifier['expires']>().toEqualTypeOf<EffectExpiry | undefined>();
    expectTypeOf<PlayerModifier['expires']>().toEqualTypeOf<EffectExpiry | undefined>();
    expectTypeOf<{ stat: 'Strength'; amount: -3; expires: { startOfNextTurn: 1; afterTurn: 7 } }>().toExtend<CardModifier>();
    expectTypeOf<{ rule: { type: 'Modify Cards'; cards: { zone: 'Play'; player: 'You'; cardType: 'Character' }; modifier: { restriction: "Can't Be Challenged" } }; source: EffectSource; expires: { startOfNextTurn: 1; afterTurn: 7 } }>().toExtend<PlayerModifier>();
});

it('stores created rules and delayed instructions without effect identities or a queue', () => {
    const modifiers: PlayerModifier[] = Object.values(playerModifierExamples);
    expect(JSON.parse(JSON.stringify(modifiers))).toEqual(modifiers);
    expect(playerModifierExamples.delayedBanish).toEqual({
        source: { card: { fullName: 'Gruesome and Grim', i: 11 }, player: 1, kind: 'Action' },
        trigger: { event: 'Turn End', player: 'You' }, uses: 1,
        effect: { type: 'Banish', cards: { zone: 'Play', cards: [{ fullName: 'Merlin - Goat', i: 12 }] } },
    });
    expectTypeOf<{ rule: { type: 'Modify Cost'; cards: 'Self'; amount: -1; for: 'Play' }; source: EffectSource; uses: 1 }>().toExtend<PlayerModifier>();
    expectTypeOf<'id'>().not.toExtend<keyof Extract<PlayerModifier, { rule: unknown }>>();
    expectTypeOf<'context'>().not.toExtend<keyof Extract<PlayerModifier, { rule: unknown }>>();
    expectTypeOf<'queue'>().not.toExtend<keyof GameState>();
});

it('retains distinct causes of identical delayed instructions after their sources leave play', () => {
    const effect: Effect = { type: 'Banish', cards: { cards: [{ fullName: 'Merlin - Goat', i: 12 }] } };
    const modifiers: PlayerModifier[] = [
        { trigger: { event: 'Turn End', player: 'You' }, effect, uses: 1,
            source: { card: { fullName: 'Gruesome and Grim', i: 11 }, player: 1, kind: 'Action' } },
        { trigger: { event: 'Turn End', player: 'You' }, effect, uses: 1,
            source: { card: { fullName: 'Madam Mim - Rival of Merlin', i: 14 }, player: 1, kind: 'Ability' } },
    ];
    const state: GameState = { turn: { number: 7, player: 2 }, players: {
        1: { lore: 0, turnsTaken: 3, deck: [], hand: [], play: [], inkwell: [],
            discard: [{ fullName: 'Gruesome and Grim', i: 11 }, { fullName: 'Madam Mim - Rival of Merlin', i: 14 }] },
        2: { lore: 0, turnsTaken: 3, deck: [], hand: [], play: [], inkwell: [], discard: [], modifiers },
    } };
    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    const stored = restored.players[2]?.modifiers;
    if (stored === undefined) throw new Error('Missing created effects');
    expect(stored.map(modifier => 'source' in modifier ? modifier.source : undefined)).toEqual([
        { card: { fullName: 'Gruesome and Grim', i: 11 }, player: 1, kind: 'Action' },
        { card: { fullName: 'Madam Mim - Rival of Merlin', i: 14 }, player: 1, kind: 'Ability' },
    ]);
    expectTypeOf<{ trigger: { event: 'Turn End' }; effect: { type: 'Banish'; cards: 'Self' } }>().not.toExtend<PlayerModifier>();
    expectTypeOf<{ replacement: { event: { event: 'Banish' } } }>().not.toExtend<CardModifier>();
    expectTypeOf<'source'>().not.toExtend<keyof Extract<CardModifier, { stat: unknown }>>();
});

it('stores gained abilities and offers them without assigning an effective-list index', () => {
    expect(JSON.parse(JSON.stringify(grantedAbilityExample))).toEqual(grantedAbilityExample);
    expect(grantedAbilityExample.gainAbility.trigger).toEqual({ event: 'Banish', card: 'Self', kind: 'Challenge' });
    expectTypeOf<{ gainAbility: { type: 'Activated'; cost: []; effect: { type: 'Draw'; player: 'You'; amount: 1 } } }>().toExtend<CardModifier>();
    expectTypeOf<{ type: 'Activate'; player: 1; ability: { card: { fullName: 'Merlin - Goat'; i: 12 }; i: 2 } }>().toExtend<PlayerAction>();
    expectTypeOf<{ type: 'Activate'; player: 1; card: { fullName: 'Hercules - Divine Hero'; i: 4 }; rule: 0 }>().toExtend<PlayerAction>();
    expectTypeOf<{ loseAbility: { name: 'Stone by Day' } }>().toExtend<CardModifier>();
});

it('can persist each player-change family without storing a victory result', () => {
    expectTypeOf<{ characters: { gainKeyword: 'Ward' }; where: { classification: 'Hero' } }>().not.toExtend<PlayerModifier>();
    expectTypeOf<{ additionalInk: 1 }>().toExtend<PlayerModifier>();
    expectTypeOf<{ readyLimit: 1 }>().toExtend<PlayerModifier>();
    expectTypeOf<{ victoryLore: 25 }>().toExtend<PlayerModifier>();
    expectTypeOf<{ restriction: "Can't Play"; where: { cardType: 'Action' } }>().toExtend<PlayerModifier>();
    expect(playerModifierExamples.scopedUnderPermission.cards.under).toEqual({ cards: [{ fullName: 'The Black Cauldron', i: 8 }] });
    expectTypeOf<'result'>().not.toExtend<keyof GameState>();
});
