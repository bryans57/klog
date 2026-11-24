import { parseLogLine, type ParsedLogLine } from './parse-line';

export type ViewerHit = {
    id: string;
    pod: string;
    container: string;
    line: string;
    parsed: ParsedLogLine;
};

export type ViewerGroup = {
    pod: string;
    hits: ViewerHit[];
};

export function createViewerHit(id: string, pod: string, container: string, line: string): ViewerHit {
    return { id, pod, container, line, parsed: parseLogLine(line) };
}

export function withoutHidden(hits: ViewerHit[], hiddenMessages: string[]): ViewerHit[] {
    if (!hiddenMessages.length) return hits;
    const hidden = new Set(hiddenMessages);
    return hits.filter((hit) => {
        const message = hit.parsed.message;
        return !message || !hidden.has(message);
    });
}

export function groupHits(hits: ViewerHit[], filter = ''): ViewerGroup[] {
    const needle = filter.toLowerCase();
    const groups = new Map<string, ViewerHit[]>();
    for (const hit of hits) {
        if (needle && !searchableText(hit).includes(needle)) continue;
        const group = groups.get(hit.pod) ?? [];
        group.push(hit);
        groups.set(hit.pod, group);
    }
    return [...groups].map(([pod, group]) => ({ pod, hits: group }));
}

export type DisplayHit = ViewerHit & { repeats: number };

const TRACE_KEYS = ['id_correlacion', 'correlationId', 'correlation_id', 'traceId', 'trace_id'];

export function correlationId(hit: ViewerHit): string {
    for (const key of TRACE_KEYS) {
        const value = hit.parsed.fields[key];
        if (typeof value === 'string' && value) return value;
        if (typeof value === 'number') return String(value);
    }
    return '';
}

export function displayHits(hits: ViewerHit[], opts: { collapse: boolean; newestFirst: boolean }): DisplayHit[] {
    const rows: DisplayHit[] = [];
    if (opts.collapse) {
        const index = new Map<string, number>();
        for (const hit of hits) {
            const message = hit.parsed.message;
            if (!message) {
                rows.push({ ...hit, repeats: 1 });
                continue;
            }
            const at = index.get(message);
            if (at === undefined) {
                index.set(message, rows.length);
                rows.push({ ...hit, repeats: 1 });
                continue;
            }
            const current = rows[at];
            const newer = (hit.parsed.instant ?? -1) >= (current.parsed.instant ?? -1);
            rows[at] = {
                ...(newer ? hit : current),
                repeats: current.repeats + 1,
            };
        }
    } else {
        for (const hit of hits) rows.push({ ...hit, repeats: 1 });
    }
    if (!opts.newestFirst) return rows;
    return [...rows].sort((a, b) => (b.parsed.instant ?? 0) - (a.parsed.instant ?? 0));
}

function searchableText(hit: ViewerHit): string {
    const { method, url, status, message } = hit.parsed;
    return `${hit.pod} ${hit.container} ${hit.line} ${method} ${url} ${status} ${message} ${hit.parsed.duration} ${hit.parsed.time}`.toLowerCase();
}
