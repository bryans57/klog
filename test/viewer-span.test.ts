import { describe, expect, test } from 'bun:test';
import { formatPodSpan, notePodTime, readLogInstant } from '../src/viewer/span';

describe('pod time span', () => {
    test('readLogInstant prefers the kubectl prefix without parsing JSON', () => {
        const ms = readLogInstant('2026-09-16T08:54:18.707-05:00 {"method":"GET"}');
        expect(ms).toBe(new Date('2026-09-16T08:54:18.707-05:00').getTime());
    });

    test('tracks min and max per pod and formats same-day clocks', () => {
        const spans = new Map();
        notePodTime(spans, 'pod-a', new Date('2026-09-16T08:54:18-05:00').getTime(), '2026-09-16T08:54:18-05:00');
        notePodTime(spans, 'pod-a', new Date('2026-09-16T10:22:01-05:00').getTime(), '2026-09-16T10:22:01-05:00');
        notePodTime(spans, 'pod-a', new Date('2026-09-16T09:00:00-05:00').getTime(), '2026-09-16T09:00:00-05:00');
        expect(formatPodSpan(spans.get('pod-a'))).toBe('08:54 → 10:22');
    });

    test('formats UTC instants in America/Bogota so the group span matches the rows', () => {
        const spans = new Map();
        const start = new Date('2026-09-23T00:30:08Z').getTime();
        const end = new Date('2026-09-23T01:32:00Z').getTime();
        notePodTime(spans, 'pod-a', start, '2026-09-23T00:30:08Z');
        notePodTime(spans, 'pod-a', end, '2026-09-23T01:32:00Z');
        expect(formatPodSpan(spans.get('pod-a'))).toBe('19:30 → 20:32');
    });

    test('includes the day when the range crosses midnight', () => {
        const spans = new Map();
        notePodTime(spans, 'pod-a', new Date('2026-09-16T22:01:00-05:00').getTime(), '2026-09-16T22:01:00-05:00');
        notePodTime(spans, 'pod-a', new Date('2026-09-17T08:47:00-05:00').getTime(), '2026-09-17T08:47:00-05:00');
        expect(formatPodSpan(spans.get('pod-a'))).toBe('16 22:01 → 17 08:47');
    });
});
