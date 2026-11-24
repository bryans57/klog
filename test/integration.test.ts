import { describe, expect, test } from 'bun:test';

const enabled = process.env.KLOG_INTEGRATION === '1';

describe.skipIf(!enabled)('kubectl integration', () => {
    test('current-context works', async () => {
        const proc = Bun.spawn(['kubectl', 'config', 'current-context'], { stdout: 'pipe', stderr: 'pipe' });
        const out = await new Response(proc.stdout).text();
        expect((await proc.exited) === 0).toBe(true);
        expect(out.trim().length).toBeGreaterThan(0);
    });
});
