import { describe, expect, test } from 'bun:test';
import { createRedrawScheduler } from '../src/viewer/redraw';

describe('redraw scheduler', () => {
    test('coalesces many request() calls into one draw', async () => {
        let draws = 0;
        const scheduler = createRedrawScheduler(() => {
            draws += 1;
        }, 20);
        scheduler.request();
        scheduler.request();
        scheduler.request();
        expect(draws).toBe(0);
        await Bun.sleep(40);
        expect(draws).toBe(1);
        scheduler.stop();
    });

    test('flush draws immediately and stop prevents a later draw', async () => {
        let draws = 0;
        const scheduler = createRedrawScheduler(() => {
            draws += 1;
        }, 50);
        scheduler.request();
        scheduler.flush();
        expect(draws).toBe(1);
        scheduler.request();
        scheduler.stop();
        await Bun.sleep(70);
        expect(draws).toBe(1);
    });
});
