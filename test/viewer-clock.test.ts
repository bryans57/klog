import { describe, expect, test } from 'bun:test';
import { formatAbbrevDuration, formatBogotaHm, formatBogotaStamp, formatBogotaTime } from '../src/viewer/clock';

describe('Bogota clock', () => {
    test('converts a UTC instant to America/Bogota', () => {
        const ms = new Date('2026-09-23T00:31:05.371Z').getTime();
        expect(formatBogotaTime(ms)).toBe('19:31:05');
        expect(formatBogotaHm(ms)).toBe('19:31');
        expect(formatBogotaStamp(ms)).toBe('09-22 19:31:05');
    });

    test('keeps an already-offset Colombia timestamp', () => {
        const ms = new Date('2026-09-16T08:54:18.707-05:00').getTime();
        expect(formatBogotaTime(ms)).toBe('08:54:18');
        expect(formatBogotaStamp(ms)).toBe('09-16 08:54:18');
    });
});

describe('formatAbbrevDuration', () => {
    test('abbreviates milliseconds, seconds, minutes and hours', () => {
        expect(formatAbbrevDuration(3)).toBe('3ms');
        expect(formatAbbrevDuration(1200)).toBe('1.2s');
        expect(formatAbbrevDuration(1000)).toBe('1s');
        expect(formatAbbrevDuration(61000)).toBe('1m');
        expect(formatAbbrevDuration(3_600_000)).toBe('1h');
    });
});
