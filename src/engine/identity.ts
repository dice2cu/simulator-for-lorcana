import type { CardIdentifier } from '../model/identity';

export function sameCard(a: CardIdentifier | undefined, b: CardIdentifier | undefined): boolean {
    return Boolean(a && b && a.fullName === b.fullName && a.i === b.i);
}
