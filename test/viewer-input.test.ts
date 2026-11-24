import { describe, expect, test } from 'bun:test';
import { isMouseReport, isRowClick, sanitizeTypedText } from '../src/viewer/input';

describe('isMouseReport', () => {
    test.each(['\u001b[<35;85;11M', '[<35;84;10M', '<35;80;9M', '\u001b[<0;12;5m', '<35;85;11M[<35;84;10M[<35;80;9M'])(
        'detects the mouse tracking payload %s',
        (input) => {
            expect(isMouseReport(input)).toBe(true);
        },
    );

    test.each(['lista', '[RedisService]', 'a1b2', '403'])('leaves real typing alone: %s', (input) => {
        expect(isMouseReport(input)).toBe(false);
    });
});

describe('sanitizeTypedText', () => {
    test('keeps printable text, including brackets used in logs', () => {
        expect(sanitizeTypedText('[RedisService]')).toBe('[RedisService]');
    });

    test('drops mouse payloads that arrive mixed with typing', () => {
        expect(sanitizeTypedText('lista<35;85;11M[<35;84;10M')).toBe('lista');
    });

    test('drops control characters', () => {
        expect(sanitizeTypedText('a\u001b\u0007b')).toBe('ab');
    });
});

describe('isRowClick', () => {
    test('accepts a click on the row itself', () => {
        expect(isRowClick(7, 7)).toBe(true);
    });

    test('rejects the neighbour row that the hit test also reports', () => {
        expect(isRowClick(7, 8)).toBe(false);
        expect(isRowClick(7, 6)).toBe(false);
    });

    test('rejects when the row position is unknown', () => {
        expect(isRowClick(undefined, 8)).toBe(false);
    });
});
