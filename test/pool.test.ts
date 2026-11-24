import { describe, expect, test } from 'bun:test';
import { runPool } from '../src/concurrency/pool';

describe('runPool', () => {
    test('runs work with limited concurrency', async () => {
        let inflight = 0;
        let max = 0;
        const items = [1, 2, 3, 4, 5];
        const ac = new AbortController();
        await runPool(
            items,
            2,
            async (n) => {
                inflight++;
                max = Math.max(max, inflight);
                await Bun.sleep(20);
                inflight--;
                return n;
            },
            ac.signal,
        );
        expect(max).toBeLessThanOrEqual(2);
        expect(max).toBeGreaterThan(1);
    });

    test('isolates worker failures', async () => {
        const ac = new AbortController();
        const results = await runPool(
            ['ok', 'boom', 'ok2'],
            2,
            async (id) => {
                if (id === 'boom') throw new Error('gone');
                return id;
            },
            ac.signal,
        );
        expect(results[0]).toEqual({ status: 'fulfilled', value: 'ok' });
        expect(results[1].status).toBe('rejected');
        expect(results[2]).toEqual({ status: 'fulfilled', value: 'ok2' });
    });

    test('stops scheduling after abort', async () => {
        const ac = new AbortController();
        let started = 0;
        const p = runPool(
            [1, 2, 3, 4, 5, 6, 7, 8],
            2,
            async () => {
                started++;
                if (started === 2) ac.abort();
                await Bun.sleep(30);
            },
            ac.signal,
        );
        await p;
        expect(started).toBeLessThan(8);
    });
});
