import { describe, expect, test } from 'bun:test';
import { clampScroll, clampViewport, fitRows, formatGroupRow, truncate, wrapValue } from '../src/viewer/layout';

describe('formatGroupRow', () => {
    test('keeps the time span visible on the right', () => {
        const row = formatGroupRow({
            collapsed: false,
            pod: 'app-consulta-ms-5c5d989887-ltv7t',
            count: 2438,
            span: '08:54 → 10:22',
            width: 80,
        });
        expect(row.endsWith('08:54 → 10:22')).toBe(true);
        expect(row).toContain('2438 hits');
        expect(row.length).toBeLessThanOrEqual(80);
    });
});

describe('wrapValue', () => {
    test('returns one chunk when the value fits', () => {
        expect(wrapValue('Redis: listo', 40, 3)).toEqual(['Redis: listo']);
    });

    test('wraps a long value across the allowed lines', () => {
        expect(wrapValue('abcdefghij', 4, 3)).toEqual(['abcd', 'efgh', 'ij']);
    });

    test('marks the cut when the value does not fit in the allowed lines', () => {
        expect(wrapValue('abcdefghij', 3, 2)).toEqual(['abc', 'de…']);
    });
});

describe('clampViewport', () => {
    test('keeps a real terminal size', () => {
        expect(clampViewport({ rows: 40, columns: 160 })).toEqual({
            rows: 40,
            columns: 160,
        });
    });

    test('falls back when the terminal reports no size', () => {
        expect(clampViewport({ rows: 0, columns: 0 })).toEqual({
            rows: 24,
            columns: 80,
        });
        expect(clampViewport({})).toEqual({ rows: 24, columns: 80 });
    });

    test('never goes below a usable minimum', () => {
        expect(clampViewport({ rows: 2, columns: 10 })).toEqual({
            rows: 8,
            columns: 40,
        });
    });
});

describe('truncate', () => {
    test('keeps text that already fits', () => {
        expect(truncate('Redis: listo', 40)).toBe('Redis: listo');
    });

    test('cuts long text and marks the cut', () => {
        expect(truncate('abcdefghij', 5)).toBe('abcd…');
    });

    test('flattens newlines and tabs so one hit never spans two rows', () => {
        expect(truncate('a\nb\tc', 20)).toBe('a b c');
    });

    test('keeps the padding that aligns the columns', () => {
        expect(truncate('19:35:42 INFO  Redis: listo', 40)).toBe('19:35:42 INFO  Redis: listo');
    });

    test('never returns more characters than the width', () => {
        expect(truncate('abc', 1).length).toBe(1);
    });
});

describe('fitRows', () => {
    test('subtracts the reserved chrome', () => {
        expect(fitRows(20, 6)).toBe(14);
    });

    test('always leaves one row for the list', () => {
        expect(fitRows(4, 10)).toBe(1);
    });
});

describe('clampScroll', () => {
    test('scrolls down to keep the selected row visible', () => {
        expect(clampScroll({ scroll: 0, selectedIndex: 12, listRows: 5, total: 40 })).toBe(8);
    });

    test('scrolls up to keep the selected row visible', () => {
        expect(clampScroll({ scroll: 20, selectedIndex: 3, listRows: 5, total: 40 })).toBe(3);
    });

    test('never scrolls past the last page', () => {
        expect(clampScroll({ scroll: 99, selectedIndex: -1, listRows: 5, total: 8 })).toBe(3);
    });

    test('stays at zero when everything fits', () => {
        expect(clampScroll({ scroll: 0, selectedIndex: 1, listRows: 10, total: 4 })).toBe(0);
    });
});
