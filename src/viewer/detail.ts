import { httpSummary, type ParsedLogLine } from './parse-line';

const HTTP_ORDER = ['status', 'method', 'url', 'path', 'response', 'body', 'error_message', 'error_code'];
const COMPACT_HIDE = new Set(['request', 'headers']);

export function detailEntries(parsed: ParsedLogLine, expanded: boolean): [string, string][] {
    const entries: [string, string][] = [];
    if (parsed.time) entries.push(['time', parsed.time]);
    if (parsed.duration) entries.push(['duration', parsed.duration]);
    if (parsed.level) entries.push(['level', parsed.level]);
    if (parsed.status) entries.push(['status', parsed.status]);
    if (parsed.method) entries.push(['method', parsed.method]);
    if (parsed.url) entries.push(['url', parsed.url]);
    if (parsed.message && parsed.message !== parsed.raw && parsed.message !== httpLine(parsed)) {
        entries.push(['message', parsed.message]);
    }

    const used = new Set(entries.map(([key]) => key));
    const rest = Object.entries(parsed.fields);
    for (const key of HTTP_ORDER) {
        if (used.has(key)) continue;
        const value = parsed.fields[key];
        if (value === undefined) continue;
        if (!expanded && COMPACT_HIDE.has(key)) continue;
        entries.push([key, formatValue(value)]);
        used.add(key);
    }
    for (const [key, value] of rest) {
        if (used.has(key)) continue;
        if (!expanded && COMPACT_HIDE.has(key)) continue;
        entries.push([key, formatValue(value)]);
        used.add(key);
    }
    return entries;
}

function httpLine(parsed: ParsedLogLine): string {
    return httpSummary(parsed.method, parsed.url, parsed.status);
}

function formatValue(value: unknown): string {
    return typeof value === 'string' ? value : JSON.stringify(value);
}
