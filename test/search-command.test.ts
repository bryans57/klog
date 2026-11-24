import { describe, expect, test } from 'bun:test';
import { runSearch } from '../src/commands/search';
import type { K8sClient, PodInfo } from '../src/k8s/types';

async function* lines(text: string): AsyncGenerator<string> {
    for (const line of text.split('\n')) yield line;
}

function fake(opts: { pods: PodInfo[]; logs: Record<string, string>; fail?: Record<string, Error> }): K8sClient {
    return {
        currentContext: async (explicit) => explicit ?? 'ctx-test',
        listContexts: async () => [{ name: 'ctx-test', current: true }],
        useContext: async () => undefined,
        refreshCredentials: async () => '',
        pingApi: async () => '',
        listPods: async () => opts.pods,
        listApps: async () => [],
        podsForDeployment: async () => opts.pods,
        getPod: async (_ns, name) => {
            const p = opts.pods.find((p) => p.name === name);
            if (!p) throw new Error('not found');
            return p;
        },
        streamLogs: async function* (_ns, source) {
            const key = `${source.pod}|${source.container ?? 'all'}|${source.previous ? 'prev' : 'cur'}`;
            if (opts.fail?.[key]) throw opts.fail[key];
            const body = opts.logs[key] ?? opts.logs[source.pod] ?? '';
            yield* lines(body);
        },
    };
}

const flags = {
    namespace: 'ejemplos',
    selector: 'app=ms',
    ignoreCase: true,
    regex: false,
    word: false,
    around: 0,
    concurrency: 4,
    output: 'pretty' as const,
    allContainers: false,
    previous: false,
    current: true,
    both: false,
    verbose: false,
    followPods: false,
};

describe('runSearch', () => {
    test('emits the effective query context before hits', async () => {
        const client = fake({
            pods: [{ name: 'pod-1', containers: ['application'] }],
            logs: { 'pod-1': 'found\n' },
        });
        let queryInfo: unknown;

        await runSearch(
            client,
            { ...flags, query: 'found' },
            {
                onMatch: () => undefined,
                onHeader: () => undefined,
                onQuery: (info) => {
                    queryInfo = info;
                },
            },
        );

        expect(queryInfo).toEqual({
            context: 'ctx-test',
            namespace: 'ejemplos',
            target: 'app=ms',
            since: '1h',
            until: undefined,
        });
    });

    test('finds matches across pods and skips empty pods', async () => {
        const client = fake({
            pods: [
                { name: 'pod-1', containers: ['application'] },
                { name: 'pod-2', containers: ['application'] },
                { name: 'pod-3', containers: ['application'] },
            ],
            logs: {
                'pod-1': 'nada\n',
                'pod-2': 'id=123456 ok\n',
                'pod-3': 'otro 123456\n',
            },
        });
        const matches: string[] = [];
        const summary = await runSearch(
            client,
            { ...flags, query: '123456' },
            {
                onMatch: (text) => matches.push(text),
                onHeader: () => undefined,
            },
        );
        expect(summary.matches).toBe(2);
        expect(summary.pods).toBe(3);
        expect(matches.some((m) => m.includes('pod-2'))).toBe(true);
        expect(matches.some((m) => m.includes('pod-1'))).toBe(false);
    });

    test('searches ten pods concurrently', async () => {
        const pods = Array.from({ length: 10 }, (_, i) => ({ name: `pod-${i}`, containers: ['application'] }));
        const logs = Object.fromEntries(pods.map((p, i) => [p.name, i === 7 ? 'found-xyz\n' : 'nope\n']));
        const client = fake({ pods, logs });
        const summary = await runSearch(
            client,
            { ...flags, query: 'xyz', concurrency: 10 },
            {
                onMatch: () => undefined,
                onHeader: () => undefined,
            },
        );
        expect(summary.pods).toBe(10);
        expect(summary.matches).toBe(1);
        expect(summary.successful).toBe(10);
    });

    test('pod errors do not abort the rest', async () => {
        const err = Object.assign(new Error('pods "pod-2" not found'), { code: 'unavailable' as const });
        const client = fake({
            pods: [
                { name: 'pod-1', containers: ['application'] },
                { name: 'pod-2', containers: ['application'] },
            ],
            logs: { 'pod-1': 'match 9\n' },
            fail: { 'pod-2|application|cur': err },
        });
        const summary = await runSearch(
            client,
            { ...flags, query: 'match' },
            {
                onMatch: () => undefined,
                onHeader: () => undefined,
            },
        );
        expect(summary.matches).toBe(1);
        expect(summary.unavailable).toBe(1);
        expect(summary.successful).toBe(1);
    });

    test('previous uses previous source', async () => {
        const client = fake({
            pods: [{ name: 'pod-1', containers: ['application'] }],
            logs: {
                'pod-1|application|cur': 'current only\n',
                'pod-1|application|prev': 'old 123\n',
            },
        });
        const summary = await runSearch(
            client,
            { ...flags, query: '123', previous: true, current: false },
            { onMatch: () => undefined, onHeader: () => undefined },
        );
        expect(summary.matches).toBe(1);
    });

    test('emits json lines', async () => {
        const client = fake({
            pods: [{ name: 'p', containers: ['application'] }],
            logs: { p: 'abc\n' },
        });
        const linesOut: string[] = [];
        await runSearch(
            client,
            { ...flags, query: 'abc', output: 'json' },
            {
                onMatch: (t) => linesOut.push(t),
                onHeader: () => undefined,
            },
        );
        expect(JSON.parse(linesOut[0]).pod).toBe('p');
    });

    test('emits structured hits without changing formatted output', async () => {
        const client = fake({
            pods: [{ name: 'p', containers: ['application'] }],
            logs: { p: '{"level":"info","msg":"ready"}\n' },
        });
        const events: { pod: string; container: string; line: string }[] = [];
        await runSearch(
            client,
            { ...flags, query: 'ready' },
            {
                onMatch: () => undefined,
                onHit: (event) => events.push(event),
                onHeader: () => undefined,
            },
        );
        expect(events).toEqual([{ pod: 'p', container: 'application', line: '{"level":"info","msg":"ready"}' }]);
    });

    test('multiple containers search the app container by default', async () => {
        const client = fake({
            pods: [{ name: 'p', containers: ['application', 'istio-proxy'] }],
            logs: {
                'p|application|cur': 'app 123\n',
                'p|istio-proxy|cur': 'proxy 123\n',
            },
        });
        const linesOut: string[] = [];
        await runSearch(
            client,
            { ...flags, query: '123' },
            {
                onMatch: (t) => linesOut.push(t),
                onHeader: () => undefined,
            },
        );
        expect(linesOut).toHaveLength(1);
        expect(linesOut[0]).toContain('app 123');
    });

    test('empty query dumps every line', async () => {
        const client = fake({
            pods: [{ name: 'p', containers: ['application'] }],
            logs: { p: 'linea 1\nlinea 2\nlinea 3' },
        });
        const linesOut: string[] = [];
        const summary = await runSearch(
            client,
            { ...flags, query: '' },
            {
                onMatch: (t) => linesOut.push(t),
                onHeader: () => undefined,
            },
        );
        expect(summary.matches).toBe(3);
        expect(linesOut[2]).toContain('linea 3');
    });

    test('rejects --since without a unit', async () => {
        const client = fake({
            pods: [{ name: 'p', containers: ['application'] }],
            logs: { p: 'x\n' },
        });
        await expect(
            runSearch(
                client,
                { ...flags, query: 'x', since: '168' },
                {
                    onMatch: () => undefined,
                    onHeader: () => undefined,
                },
            ),
        ).rejects.toThrow(/unit is required/);
    });
});
