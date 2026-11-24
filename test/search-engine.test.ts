import { describe, expect, test } from 'bun:test';
import { createMatcher, searchLines } from '../src/search/engine';

async function collect(lines: string[], query: string, opts: Parameters<typeof searchLines>[2] = {}) {
    const hits = [];
    for await (const hit of searchLines(lines, query, opts)) hits.push(hit);
    return hits;
}

describe('createMatcher', () => {
    test('literal search is case-insensitive by default', () => {
        const m = createMatcher('error', { regex: false, ignoreCase: true });
        expect(m('ERROR in pod')).toBe(true);
        expect(m('info')).toBe(false);
    });

    test('literal search can be case-sensitive', () => {
        const m = createMatcher('error', { regex: false, ignoreCase: false });
        expect(m('ERROR')).toBe(false);
        expect(m('error')).toBe(true);
    });

    test('regex search', () => {
        const m = createMatcher('id_ejemplo=[0-9]+', { regex: true, ignoreCase: true });
        expect(m('id_ejemplo=123456')).toBe(true);
        expect(m('id_ejemplo=abc')).toBe(false);
    });

    test('word match does not match a longer token', () => {
        const m = createMatcher('/ejemplo', { regex: false, ignoreCase: true, word: true });
        expect(m('GET /ejemplo/542')).toBe(true);
        expect(m('GET /ejemplos/542')).toBe(false);
        expect(m('GET /ejemplo')).toBe(true);
    });
});

describe('searchLines', () => {
    test('returns matching lines only', async () => {
        const hits = await collect(['a', '123456 ok', 'b'], '123456');
        expect(hits.map((h) => h.line)).toEqual(['123456 ok']);
    });

    test('skips pods with no matches', async () => {
        const hits = await collect(['nothing here'], '123456');
        expect(hits).toHaveLength(0);
    });

    test('includes before/after context', async () => {
        const lines = ['1', '2', 'MATCH', '4', '5', '6'];
        const hits = await collect(lines, 'MATCH', { before: 2, after: 2 });
        expect(hits).toHaveLength(1);
        expect(hits[0].before).toEqual(['1', '2']);
        expect(hits[0].line).toBe('MATCH');
        expect(hits[0].after).toEqual(['4', '5']);
    });

    test('filters lines after until when timestamps are present', async () => {
        const lines = [
            '2026-09-09T10:00:00Z keep 123',
            '2026-09-09T12:00:00Z drop 123',
        ];
        const hits = await collect(lines, '123', {
            until: new Date('2026-09-09T11:00:00Z'),
        });
        expect(hits.map((h) => h.line)).toEqual(['2026-09-09T10:00:00Z keep 123']);
    });

    test('stops pulling lines once a timestamp passes until', async () => {
        const lines = [
            '2026-09-09T10:00:00Z keep 123',
            '2026-09-09T12:00:00Z drop 123',
            '2026-09-09T13:00:00Z later 123',
        ];
        let pulled = 0;
        const source = {
            async *[Symbol.asyncIterator]() {
                for (const line of lines) {
                    pulled++;
                    yield line;
                }
            },
        };
        const hits = [];
        for await (const hit of searchLines(source, '123', { until: new Date('2026-09-09T11:00:00Z') })) {
            hits.push(hit);
        }
        expect(hits).toHaveLength(1);
        expect(pulled).toBe(2);
    });

    test('status and level match parsed fields and ignore the same digits elsewhere', async () => {
        const lines = [
            '{"status":502,"level":"error","msg":"upstream"}',
            '{"status":200,"level":"error","msg":"id 502"}',
            '{"statusCode":502,"level":"info","msg":"other"}',
        ];
        const status = await collect(lines, '', { status: '502' });
        expect(status.map((hit) => hit.line)).toEqual([lines[0], lines[2]]);
        const both = await collect(lines, '', { status: '502', level: 'error' });
        expect(both.map((hit) => hit.line)).toEqual([lines[0]]);
    });
});
