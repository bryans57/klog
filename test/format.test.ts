import { describe, expect, test } from 'bun:test';
import { formatHit, formatSummary } from '../src/output/format';
import type { Hit } from '../src/search/engine';

const hit: Hit = {
    line: 'hello 123',
    before: ['before'],
    after: ['after'],
    timestamp: new Date('2026-09-09T09:12:31.000Z'),
};

describe('formatHit', () => {
    test('pretty includes pod header', () => {
        const text = formatHit(hit, { pod: 'pod-a', container: 'application', allContainers: false }, 'pretty');
        expect(text).toContain('[pod-a]');
        expect(text).toContain('hello 123');
    });

    test('plain is just the line', () => {
        const text = formatHit(
            { ...hit, before: [], after: [] },
            { pod: 'pod-a', container: 'application', allContainers: false },
            'plain',
        );
        expect(text).toBe('hello 123');
    });

    test('json is one object', () => {
        const text = formatHit(hit, { pod: 'pod-a', container: 'application', allContainers: true }, 'json');
        const obj = JSON.parse(text);
        expect(obj.pod).toBe('pod-a');
        expect(obj.container).toBe('application');
        expect(obj.line).toBe('hello 123');
    });

    test('all-containers pretty labels container', () => {
        const text = formatHit(hit, { pod: 'pod-a', container: 'application', allContainers: true }, 'pretty');
        expect(text).toContain('[pod=pod-a][container=application]');
    });
});

describe('formatSummary', () => {
    test('reports matches', () => {
        expect(formatSummary({ matches: 3, pods: 10, successful: 10, unavailable: 0, noPrevious: 0, elapsedMs: 1370 })).toContain(
            '3 matches',
        );
    });

    test('reports no matches', () => {
        expect(formatSummary({ matches: 0, pods: 10, successful: 10, unavailable: 0, noPrevious: 0, elapsedMs: 1540 })).toContain(
            'No matches found',
        );
    });
});
