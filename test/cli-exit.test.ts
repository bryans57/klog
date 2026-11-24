import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const cli = join(import.meta.dir, '../src/cli.ts');

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
    const proc = Bun.spawn([process.execPath, cli, ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
        stdin: 'ignore',
    });
    const [stdout, stderr, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
    ]);
    return { stdout, stderr, code: code ?? 1 };
}

describe('CLI exit codes (entrypoint)', () => {
    test('--version exits 0', async () => {
        const r = await runCli(['--version']);
        expect(r.code).toBe(0);
        expect(r.stdout).toMatch(/^klog \d+\.\d+\.\d+/);
    });

    test('--help exits 0', async () => {
        const r = await runCli(['--help']);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('klog search');
    });

    test('search without query exits 2', async () => {
        const r = await runCli(['search']);
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('search requires a query string');
    });

    test('unknown command exits 2', async () => {
        const r = await runCli(['nope']);
        expect(r.code).toBe(2);
        expect(r.stderr).toContain('Unknown command');
    });
});
