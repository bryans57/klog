import { describe, expect, test } from 'bun:test';
import { runSearch } from '../src/commands/search';
import type { K8sClient, PodInfo } from '../src/k8s/types';

function fakeLogs(logs: Record<string, string>, pods: PodInfo[]): K8sClient {
    return {
        currentContext: async () => 'ctx',
        listContexts: async () => [{ name: 'ctx', current: true }],
        useContext: async () => undefined,
        refreshCredentials: async () => '',
        pingApi: async () => '',
        listPods: async () => pods,
        listApps: async () => [],
        podsForDeployment: async () => pods,
        getPod: async (_n, name) => pods.find((p) => p.name === name)!,
        streamLogs: async function* (_ns, source, _ctx, signal) {
            if (signal.aborted) return;
            const body = logs[source.pod] ?? '';
            for (const line of body.split('\n')) {
                if (signal.aborted) return;
                yield line;
                await Bun.sleep(20);
            }
        },
    };
}

const base = {
    namespace: 'ns',
    selector: 'app=x',
    ignoreCase: true,
    regex: false,
    word: false,
    around: 0,
    concurrency: 4,
    output: 'plain' as const,
    allContainers: false,
    previous: false,
    current: true,
    both: false,
    verbose: false,
    followPods: false,
};

describe('search cancellation', () => {
    test('abort stops further work', async () => {
        const pods = Array.from({ length: 6 }, (_, i) => ({
            name: `pod-${i}`,
            containers: ['application'],
        }));
        const logs = Object.fromEntries(pods.map((p) => [p.name, 'hit-value\n'.repeat(20)]));
        const client = fakeLogs(logs, pods);
        const ac = new AbortController();
        setTimeout(() => ac.abort(), 25);
        const summary = await runSearch(
            client,
            { ...base, query: 'hit' },
            { onMatch: () => undefined, onHeader: () => undefined },
            ac.signal,
        );
        expect(summary.elapsedMs).toBeLessThan(2000);
    });
});
