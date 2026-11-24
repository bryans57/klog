import { describe, expect, test } from 'bun:test';
import { createBuffer, pushHit } from '../src/viewer/buffer';

describe('viewer buffer', () => {
    test('prefix mode keeps the first hits', () => {
        let state = createBuffer<number>('prefix', 5);
        for (let hit = 1; hit <= 8; hit++) state = pushHit(state, hit);

        expect(state.hits).toEqual([1, 2, 3, 4, 5]);
        expect(state.truncated).toBe('prefix');
    });

    test('prefix mode returns the same buffer after the cap so callers can skip redraws', () => {
        let state = createBuffer<number>('prefix', 2);
        state = pushHit(state, 1);
        state = pushHit(state, 2);
        const capped = pushHit(state, 3);
        expect(capped.truncated).toBe('prefix');
        expect(pushHit(capped, 4)).toBe(capped);
    });

    test('ring mode keeps only the newest hits', () => {
        let state = createBuffer<number>('ring', 5);
        for (let hit = 1; hit <= 8; hit++) state = pushHit(state, hit);

        expect(state.hits).toEqual([4, 5, 6, 7, 8]);
        expect(state.truncated).toBe('ring');
    });

    test('normalizes an invalid limit to one', () => {
        const state = pushHit(createBuffer<number>('ring', 0), 1);
        expect(state.limit).toBe(1);
        expect(state.hits).toEqual([1]);
    });
});
