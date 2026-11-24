import { describe, expect, test } from 'bun:test';
import { matchSpans } from '../src/viewer/highlight';

const opts = { regex: false, ignoreCase: true, word: false };

describe('matchSpans', () => {
    test('leaves an empty query unmarked', () => {
        expect(matchSpans('Redis: listo', '', opts)).toEqual([{ text: 'Redis: listo', match: false }]);
    });

    test('marks every case-insensitive substring and preserves the original text', () => {
        const spans = matchSpans('Redis redis REDIS', 'redis', opts);

        expect(spans.filter((span) => span.match).map((span) => span.text)).toEqual(['Redis', 'redis', 'REDIS']);
        expect(spans.map((span) => span.text).join('')).toBe('Redis redis REDIS');
    });

    test('respects case-sensitive matching', () => {
        expect(matchSpans('error ERROR', 'ERROR', { ...opts, ignoreCase: false }).filter((span) => span.match)).toEqual(
            [{ text: 'ERROR', match: true }],
        );
    });

    test('respects whole-token matching', () => {
        const spans = matchSpans('/ejemplo /ejemplos', '/ejemplo', { ...opts, word: true });

        expect(spans.filter((span) => span.match).map((span) => span.text)).toEqual(['/ejemplo']);
        expect(spans.map((span) => span.text).join('')).toBe('/ejemplo /ejemplos');
    });

    test('marks every regex occurrence', () => {
        const spans = matchSpans('id=12 id=345', String.raw`id=\d+`, { ...opts, regex: true });

        expect(spans.filter((span) => span.match).map((span) => span.text)).toEqual(['id=12', 'id=345']);
        expect(spans.map((span) => span.text).join('')).toBe('id=12 id=345');
    });

    test('does not throw if an invalid regex reaches the viewer', () => {
        expect(matchSpans('anything', '[', { ...opts, regex: true })).toEqual([{ text: 'anything', match: false }]);
    });
});
