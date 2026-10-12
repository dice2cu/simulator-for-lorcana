/** Small seeded generator (mulberry32). Separate instances never share a stream. */
export class SeededRandom {
    private state: number;
    constructor(seed: number) {
        this.state = seed >>> 0;
    }

    /** Uniform in [0, 1). */
    next(): number {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    int(limit: number): number {
        return Math.floor(this.next() * limit);
    }

    shuffle<T>(values: readonly T[]): T[] {
        const result = [...values];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.int(i + 1);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    /** An independent stream derived from this one, for separating unrelated uses. */
    fork(): SeededRandom {
        return new SeededRandom(Math.floor(this.next() * 4294967296));
    }
}
