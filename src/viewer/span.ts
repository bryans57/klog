import { bogotaDateParts, formatBogotaHm } from './clock';

const PREFIX = /^(\d{4}-\d{2}-\d{2}T[0-9:.+-]+Z?)\s/;
const JSON_TIME = /"(?:timestamp|ts|time|@timestamp)"\s*:\s*"([^"]+)"/;

export type PodSpan = {
    fromMs: number;
    toMs: number;
    fromYmd: string;
    toYmd: string;
    fromClock: string;
    toClock: string;
    fromDay: string;
    toDay: string;
};

export function readLogInstant(raw: string): number | null {
    const prefix = PREFIX.exec(raw)?.[1];
    if (prefix) {
        const date = new Date(prefix);
        if (!Number.isNaN(date.getTime())) return date.getTime();
    }
    const json = JSON_TIME.exec(raw)?.[1];
    if (!json) return null;
    const date = new Date(json);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function notePodTime(
    spans: Map<string, PodSpan>,
    pod: string,
    ms: number,
    _stamp?: string,
): Map<string, PodSpan> {
    const mark = markFromMs(ms);
    const current = spans.get(pod);
    if (!current) {
        spans.set(pod, {
            fromMs: ms,
            toMs: ms,
            fromYmd: mark.ymd,
            toYmd: mark.ymd,
            fromClock: mark.clock,
            toClock: mark.clock,
            fromDay: mark.day,
            toDay: mark.day,
        });
        return spans;
    }
    if (ms < current.fromMs) {
        current.fromMs = ms;
        current.fromYmd = mark.ymd;
        current.fromClock = mark.clock;
        current.fromDay = mark.day;
    }
    if (ms > current.toMs) {
        current.toMs = ms;
        current.toYmd = mark.ymd;
        current.toClock = mark.clock;
        current.toDay = mark.day;
    }
    return spans;
}

export function formatPodSpan(span: PodSpan | undefined): string {
    if (!span) return '';
    if (span.fromYmd === span.toYmd) return `${span.fromClock} → ${span.toClock}`;
    return `${span.fromDay} ${span.fromClock} → ${span.toDay} ${span.toClock}`;
}

function markFromMs(ms: number): { ymd: string; day: string; clock: string } {
    const date = bogotaDateParts(ms);
    return { ...date, clock: formatBogotaHm(ms) };
}
