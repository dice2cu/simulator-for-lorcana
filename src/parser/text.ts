/**
 * Printed card text normalized for parsing. Reminder text is removed because
 * it only explains rules defined elsewhere. Card symbols become short tokens:
 * {E} exert, {I} ink, {S} strength, {W} willpower, {L} lore, {K} inkwell.
 */
export function normalize(text: string): string {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\s*\([^()]*\)/g, '')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/⟳/g, '{E}')
        .replace(/⬡/g, '{I}')
        .replace(/¤/g, '{S}')
        .replace(/⛉/g, '{W}')
        .replace(/◊/g, '{L}')
        .replace(/◉/g, '{K}')
        // One spelling for contractions the grammar reads.
        .replace(/\b(he|she|it)'s\b/gi, '$1 is')
        .replace(/\bthey're\b/gi, 'they are')
        .replace(/\bthere's\b/gi, 'there is')
        .replace(/\byou've\b/gi, 'you have')
        .replace(/\bthey've\b/gi, 'they have')
        .replace(/\byou're\b/gi, 'you are')
        .replace(/\s+([.,:;])/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Thrown when text is recognized but cannot be represented. Never backtracked. */
export class Unsupported extends Error {}

const patterns = new Map<string, RegExp>();

function sticky(source: string): RegExp {
    let pattern = patterns.get(source);
    if (!pattern) {
        pattern = new RegExp(source, 'iy');
        patterns.set(source, pattern);
    }
    return pattern;
}

function escape(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A position in normalized text with backtracking. `state` holds parse-time
 * bindings such as pronoun referents, and is restored along with the position.
 */
export class Cursor<State extends object> {
    pos = 0;
    /** Furthest position reached, for reporting where parsing stopped. */
    furthest = 0;

    constructor(readonly text: string, public state: State) {}

    get done(): boolean {
        return this.pos >= this.text.length;
    }

    get rest(): string {
        return this.text.slice(this.pos);
    }

    private advance(length: number): void {
        this.pos += length;
        while (this.text[this.pos] === ' ') this.pos++;
        if (this.pos > this.furthest) this.furthest = this.pos;
    }

    /** Match a regular expression source at the current position. */
    re(source: string): RegExpExecArray | undefined {
        const pattern = sticky(source);
        pattern.lastIndex = this.pos;
        const match = pattern.exec(this.text);
        if (!match) return undefined;
        this.advance(match[0].length);
        return match;
    }

    /** Match the first of several phrases. Words must end at a word boundary. */
    lit(...phrases: string[]): string | undefined {
        for (const phrase of phrases) {
            const boundary = /\w$/.test(phrase) ? '(?![\\w\'])' : '';
            const match = this.re(escape(phrase) + boundary);
            if (match) return match[0];
        }
        return undefined;
    }

    /** Test without consuming. */
    peek(source: string): boolean {
        const pattern = sticky(source);
        pattern.lastIndex = this.pos;
        return pattern.test(this.text);
    }

    /** Run a production, restoring position and state if it returns undefined. */
    try<T>(production: () => T | undefined): T | undefined {
        const pos = this.pos;
        const state = this.state;
        this.state = { ...state };
        const result = production();
        if (result === undefined) {
            this.pos = pos;
            this.state = state;
        }
        return result;
    }

    /** Parse a list separated by commas and/or a final conjunction. */
    list<T>(item: () => T | undefined, conjunctions: string[] = ['and', 'or']): T[] | undefined {
        const first = this.try(item);
        if (first === undefined) return undefined;
        const items = [first];
        for (;;) {
            const next = this.try(() => {
                const comma = this.lit(',');
                const conjunction = this.lit(...conjunctions);
                if (!comma && !conjunction) return undefined;
                return item();
            });
            if (next === undefined) break;
            items.push(next);
        }
        return items;
    }
}
