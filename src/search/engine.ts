import { parseLogTimestamp } from '../time';
import { parseLogLine } from '../viewer/parse-line';

export type MatcherOptions = {
    regex: boolean;
    ignoreCase: boolean;
    word?: boolean;
};

export type SearchOptions = {
    regex?: boolean;
    ignoreCase?: boolean;
    word?: boolean;
    before?: number;
    after?: number;
    until?: Date;
    status?: string;
    level?: string;
};

export type Hit = {
    line: string;
    before: string[];
    after: string[];
    timestamp: Date | null;
};

export function createMatcher(query: string, opts: MatcherOptions): (line: string) => boolean {
    const re = createMatchRegex(query, opts);
    return (line) => re.test(line);
}

export function createMatchRegex(query: string, opts: MatcherOptions, global = false): RegExp {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const source = opts.regex ? query : opts.word ? `(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])` : escaped;
    return new RegExp(source, `${global ? 'g' : ''}${opts.ignoreCase ? 'i' : ''}`);
}

export async function* searchLines(
    lines: AsyncIterable<string> | Iterable<string>,
    query: string,
    opts: SearchOptions = {},
): AsyncGenerator<Hit> {
    const match = createMatcher(query, {
        regex: opts.regex ?? false,
        ignoreCase: opts.ignoreCase ?? true,
        word: opts.word ?? false,
    });
    const beforeN = opts.before ?? 0;
    const afterN = opts.after ?? 0;
    const buf: string[] = [];
    let pending: Hit | null = null;
    let afterLeft = 0;

    for await (const raw of lines) {
        const line = raw.replace(/\r$/, '');
        const ts = parseLogTimestamp(line);
        if (opts.until && ts && ts > opts.until) return;
        if (afterLeft > 0 && pending) {
            pending.after.push(line);
            afterLeft--;
            if (afterLeft === 0) {
                yield pending;
                pending = null;
            }
        }
        const isMatch = (!query || match(line)) && matchesFields(line, opts);
        if (isMatch) {
            const hit: Hit = { line, before: buf.slice(-beforeN), after: [], timestamp: ts };
            if (afterN === 0) {
                yield hit;
            } else {
                if (pending) yield pending;
                pending = hit;
                afterLeft = afterN;
            }
        }
        buf.push(line);
        if (buf.length > beforeN) buf.shift();
    }
    if (pending) yield pending;
}

function matchesFields(line: string, opts: SearchOptions): boolean {
    if (!opts.status && !opts.level) return true;
    const parsed = parseLogLine(line);
    if (opts.status && parsed.status !== opts.status) return false;
    if (opts.level && parsed.level !== opts.level.toUpperCase()) return false;
    return true;
}
