import { describe, expect, test } from 'bun:test';
import { runUse } from '../src/commands/meta';
import type { K8sClient } from '../src/k8s/types';

function fakeClient(opts: {
    list: { name: string; current: boolean }[];
    onUse?: (name: string) => void;
    onRefresh?: (name: string) => string;
    onPing?: () => string;
}): K8sClient {
    return {
        currentContext: async () => opts.list.find((c) => c.current)?.name ?? '',
        listContexts: async () => opts.list,
        useContext: async (name) => opts.onUse?.(name),
        refreshCredentials: async (name) => opts.onRefresh?.(name) ?? 'skipped',
        pingApi: async () => opts.onPing?.() ?? 'ok',
        listPods: async () => [],
        listApps: async () => [],
        podsForDeployment: async () => [],
        getPod: async () => ({ name: 'x', containers: [] }),
        streamLogs: async function* () {},
    };
}

describe('runUse', () => {
    test('refreshes credentials even if already current', async () => {
        const calls: string[] = [];
        const client = fakeClient({
            list: [{ name: 'gke_proj_us-central1_cluster', current: true }],
            onUse: () => calls.push('use'),
            onRefresh: (n) => {
                calls.push(`refresh:${n}`);
                return 'credentials ok';
            },
            onPing: () => {
                calls.push('ping');
                return 'api ok (8s)';
            },
        });
        const r = await runUse(client, 'cluster');
        expect(calls).toContain('refresh:gke_proj_us-central1_cluster');
        expect(calls).toContain('ping');
        expect(calls).not.toContain('use');
        expect(r.text).toContain('credentials ok');
        expect(r.text).toContain('api ok');
    });

    test('switches via unique fragment then refreshes', async () => {
        let used = '';
        const client = fakeClient({
            list: [
                { name: 'gke-prod-apis', current: true },
                { name: 'gke-test-apis-02', current: false },
            ],
            onUse: (name) => {
                used = name;
            },
            onRefresh: () => 'refreshed',
            onPing: () => 'reachable',
        });
        const r = await runUse(client, 'test');
        expect(r.switched).toBe(true);
        expect(used).toBe('gke-test-apis-02');
        expect(r.text).toContain('Switched to');
        expect(r.text).toContain('reachable');
    });
});
