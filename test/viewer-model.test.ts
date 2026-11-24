import { describe, expect, test } from 'bun:test';
import { createViewerHit, displayHits, groupHits, withoutHidden } from '../src/viewer/model';

describe('viewer model', () => {
    test('groups hits by pod and filters case-insensitively', () => {
        const hits = [
            createViewerHit('1', 'pod-a', 'app', '{"level":"error","msg":"failed","trace":"A1B2"}'),
            createViewerHit('2', 'pod-a', 'app', 'healthy'),
            createViewerHit('3', 'pod-b', 'app', 'trace a1b2'),
        ];

        const all = groupHits(hits);
        expect(all.map((group) => [group.pod, group.hits.length])).toEqual([
            ['pod-a', 2],
            ['pod-b', 1],
        ]);

        const filtered = groupHits(hits, 'a1b2');
        expect(filtered.map((group) => [group.pod, group.hits.length])).toEqual([
            ['pod-a', 1],
            ['pod-b', 1],
        ]);
    });

    test('local filter matches HTTP method and status on parsed fields', () => {
        const hits = [
            createViewerHit('1', 'pod-a', 'app', '{"method":"GET","url":"/ejemplos/repartidores/1","status":400}'),
            createViewerHit('2', 'pod-a', 'app', '{"method":"POST","url":"/ejemplos/repartidores","status":200}'),
        ];
        expect(groupHits(hits, 'GET').map((group) => group.hits.map((hit) => hit.id))).toEqual([['1']]);
        expect(groupHits(hits, '400').map((group) => group.hits.map((hit) => hit.id))).toEqual([['1']]);
        expect(groupHits(hits, 'POST').map((group) => group.hits.map((hit) => hit.id))).toEqual([['2']]);
    });

    test('withoutHidden drops an exact message and keeps an empty one', () => {
        const hits = [
            createViewerHit('1', 'pod-a', 'app', '{"msg":"ruido"}'),
            createViewerHit('2', 'pod-a', 'app', '{"msg":"Ruido"}'),
            createViewerHit('3', 'pod-a', 'app', 'plain'),
        ];
        const shown = withoutHidden(hits, ['ruido']);
        expect(shown.map((hit) => hit.id)).toEqual(['2', '3']);
    });

    test('displayHits collapses the same message and can put the newest first', () => {
        const hits = [
            createViewerHit('1', 'pod-a', 'app', '{"ts":"2026-09-11T18:00:00Z","msg":"ruido"}'),
            createViewerHit('2', 'pod-a', 'app', '{"ts":"2026-09-11T19:00:00Z","msg":"ruido"}'),
            createViewerHit('3', 'pod-a', 'app', '{"ts":"2026-09-11T20:00:00Z","msg":"util"}'),
        ];
        const collapsed = displayHits(hits, { collapse: true, newestFirst: false });
        expect(collapsed.map((hit) => [hit.id, hit.repeats])).toEqual([
            ['2', 2],
            ['3', 1],
        ]);
        const newest = displayHits(hits, { collapse: true, newestFirst: true });
        expect(newest.map((hit) => hit.id)).toEqual(['3', '2']);
    });
});
