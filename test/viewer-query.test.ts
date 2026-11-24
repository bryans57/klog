import { describe, expect, test } from 'bun:test';
import { formatQueryHeader, type ViewerQuery } from '../src/viewer/query';

const query: ViewerQuery = {
    context: 'gke_demo',
    namespace: 'ejemplos',
    target: 'app=adjuntos',
    query: 'REPOSITORY_ERROR',
    since: '40m',
    ignoreCase: true,
    regex: false,
    word: false,
};

describe('formatQueryHeader', () => {
    test('formats context, namespace, target, query and time bounds', () => {
        expect(formatQueryHeader({ ...query, until: '2026-09-11T20:00:00Z' })).toEqual([
            'gke_demo · ejemplos/app=adjuntos · since 40m · until 2026-09-11T20:00:00Z',
            'query: "REPOSITORY_ERROR"',
        ]);
    });

    test('shows matcher modes and omits absent values', () => {
        expect(formatQueryHeader({ ...query, since: undefined, regex: true, word: true })).toEqual([
            'gke_demo · ejemplos/app=adjuntos',
            'query: "REPOSITORY_ERROR" · --regex · -w',
        ]);
    });

    test('omits the query line when query is empty', () => {
        expect(formatQueryHeader({ ...query, query: '' })).toEqual(['gke_demo · ejemplos/app=adjuntos · since 40m']);
    });
});
