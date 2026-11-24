import { describe, expect, test } from 'bun:test';
import { parseDuration, parseTimeBound, normalizeSince, toKubectlSinceArg } from '../src/time';

describe('parseDuration', () => {
    test('parses seconds minutes hours days', () => {
        expect(parseDuration('30s')).toBe(30);
        expect(parseDuration('10m')).toBe(600);
        expect(parseDuration('2h')).toBe(7200);
        expect(parseDuration('1d')).toBe(86400);
    });

    test('rejects invalid values', () => {
        expect(() => parseDuration('')).toThrow();
        expect(() => parseDuration('2')).toThrow();
        expect(() => parseDuration('abc')).toThrow();
    });
});

describe('parseTimeBound', () => {
    test('parses RFC3339 as absolute Date', () => {
        const d = parseTimeBound('2026-09-09T12:00:00Z', new Date('2026-09-09T14:00:00Z'));
        expect(d.toISOString()).toBe('2026-09-09T12:00:00.000Z');
    });

    test('parses duration as now minus duration', () => {
        const now = new Date('2026-09-09T14:00:00Z');
        const d = parseTimeBound('2h', now);
        expect(d.toISOString()).toBe('2026-09-09T12:00:00.000Z');
    });
});

describe('normalizeSince', () => {
    test('accepts 2h and 7d', () => {
        expect(normalizeSince('2h')).toBe('2h');
        expect(normalizeSince('7d')).toBe('7d');
    });

    test('rejects a bare number', () => {
        expect(() => normalizeSince('168')).toThrow(/unit is required/);
    });

    test('expands ayer17:00 in Bogota and keeps a short date for kubectl', () => {
        const now = new Date('2026-09-29T13:00:00Z');
        expect(parseTimeBound('ayer17:00', now).toISOString()).toBe('2026-09-28T22:00:00.000Z');
        expect(parseTimeBound('hoy17:00', now).toISOString()).toBe('2026-09-29T22:00:00.000Z');
        expect(parseTimeBound('09-28 17:00', now).toISOString()).toBe('2026-09-28T22:00:00.000Z');
        expect(toKubectlSinceArg('2026-09-28 17:00')).toBe('--since-time=2026-09-28T17:00:00-05:00');
    });
});

describe('toKubectlSinceArg', () => {
    test('converts days to seconds because Go duration has no "d"', () => {
        expect(toKubectlSinceArg('7d')).toBe('--since=604800s');
        expect(toKubectlSinceArg('1d')).toBe('--since=86400s');
    });

    test('keeps units Go understands', () => {
        expect(toKubectlSinceArg('2h')).toBe('--since=2h');
        expect(toKubectlSinceArg('30s')).toBe('--since=30s');
        expect(toKubectlSinceArg('10m')).toBe('--since=10m');
    });

    test('uses since-time for an absolute timestamp', () => {
        expect(toKubectlSinceArg('2026-09-02T00:00:00Z')).toBe('--since-time=2026-09-02T00:00:00Z');
    });
});
