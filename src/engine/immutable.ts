/**
 * A frozen object is treated as deeply immutable, the same convention the card
 * catalog follows. Only fresh objects are walked, so freezing a new position
 * visits just the parts that changed.
 */
export function freeze<T>(value: T): T {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
        if (Array.isArray(value)) for (let i = 0; i < value.length; i++) freeze(value[i]);
        else for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
    }
    return value;
}

/**
 * Copy caller-owned input once. Frozen parts, such as actions taken from a request,
 * are shared rather than copied. Inputs are plain data: objects, arrays and primitives.
 */
export function immutable<T>(value: T): T {
    if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
    if (Array.isArray(value)) return Object.freeze(value.map(immutable)) as T;
    const copy: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) copy[key] = immutable(child);
    return Object.freeze(copy) as T;
}

/** Keeps unchanged arrays shared between immutable positions. */
export function mapKept<T>(items: T[], map: (item: T) => T): T[] {
    let result: T[] | undefined;
    for (let i = 0; i < items.length; i++) {
        const next = map(items[i]);
        if (result) result.push(next);
        else if (next !== items[i]) (result = items.slice(0, i)).push(next);
    }
    return result ?? items;
}
