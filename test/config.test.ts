import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { applyConfig, loadConfig, parseSimpleYaml } from '../src/config';
import { parseArgv } from '../src/cli/parse';

describe('parseSimpleYaml', () => {
    test('reads the three keys and strips comments', () => {
        const c = parseSimpleYaml(
            'defaultContext: ctx-a # comment\ndefaultNamespace: ejemplos\nconcurrency: 8\n',
        );
        expect(c.defaultContext).toBe('ctx-a');
        expect(c.defaultNamespace).toBe('ejemplos');
        expect(c.concurrency).toBe(8);
    });
});

describe('applyConfig', () => {
    const flags = parseArgv(['search', 'q']).flags;

    test('fills namespace and context when flags omit them', () => {
        const next = applyConfig(flags, {
            defaultContext: 'gke-test',
            defaultNamespace: 'ejemplos',
            concurrency: 4,
            viewerLimit: 300,
        });
        expect(next.kubeContext).toBe('gke-test');
        expect(next.namespace).toBe('ejemplos');
        expect(next.concurrency).toBe(4);
        expect(next.viewerLimit).toBe(300);
    });

    test('does not override an explicit concurrency other than 10', () => {
        const next = applyConfig({ ...flags, concurrency: 3 }, { concurrency: 9 });
        expect(next.concurrency).toBe(3);
    });

    test('CLI namespace wins over file', () => {
        const next = applyConfig({ ...flags, namespace: 'ns-cli' }, { defaultNamespace: 'from-file' });
        expect(next.namespace).toBe('ns-cli');
    });
});

describe('loadConfig', () => {
    test('missing file returns empty config and does not create it', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'klog-cfg-'));
        const path = join(dir, 'config.yaml');
        try {
            expect(await loadConfig(path)).toEqual({});
            expect(await Bun.file(path).exists()).toBe(false);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
