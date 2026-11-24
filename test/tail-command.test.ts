import { describe, expect, test } from 'bun:test';
import { runTail } from '../src/commands/tail';
import type { K8sClient } from '../src/k8s/types';

describe('runTail', () => {
    test('filters live lines by query', async () => {
        const ac = new AbortController();
        const client: K8sClient = {
            currentContext: async () => 'ctx',
            listContexts: async () => [],
            useContext: async () => undefined,
            refreshCredentials: async () => '',
            pingApi: async () => '',
            listPods: async () => [{ name: 'p1', containers: ['application'] }],
            listApps: async () => [],
            podsForDeployment: async () => [],
            getPod: async () => ({ name: 'p1', containers: ['application'] }),
            streamLogs: async function* (namespace, source) {
                expect(source.timestamps).toBe(true);
                expect(source.tail).toBe(10);
                expect(source.since).toBeUndefined();
                yield 'skip me';
                yield 'keep 99';
                ac.abort();
            },
        };
        const lines: string[] = [];
        const events: { pod: string; container: string; line: string }[] = [];
        let queryInfo: unknown;
        await runTail(
            client,
            {
                namespace: 'ns',
                selector: 'app=x',
                query: '99',
                ignoreCase: true,
                regex: false,
                word: false,
                around: 0,
                concurrency: 2,
                output: 'pretty',
                allContainers: false,
                previous: false,
                current: true,
                both: false,
                verbose: false,
                followPods: false,
            },
            {
                onLine: (t) => lines.push(t),
                onHit: (event) => events.push(event),
                onInfo: () => undefined,
                onQuery: (info) => {
                    queryInfo = info;
                },
            },
            ac.signal,
        );
        expect(lines.some((l) => l.includes('keep 99'))).toBe(true);
        expect(lines.some((l) => l.includes('skip me'))).toBe(false);
        expect(events).toEqual([{ pod: 'p1', container: 'application', line: 'keep 99' }]);
        expect(queryInfo).toEqual({
            context: 'ctx',
            namespace: 'ns',
            target: 'app=x',
            since: undefined,
            until: undefined,
        });
    });

    test('omits the default --tail=10 when --since is set so kubectl can return the window', async () => {
        const ac = new AbortController();
        let sourceTail: number | undefined = 10;
        const client: K8sClient = {
            currentContext: async () => 'ctx',
            listContexts: async () => [],
            useContext: async () => undefined,
            refreshCredentials: async () => '',
            pingApi: async () => '',
            listPods: async () => [{ name: 'p1', containers: ['application'] }],
            listApps: async () => [],
            podsForDeployment: async () => [],
            getPod: async () => ({ name: 'p1', containers: ['application'] }),
            streamLogs: async function* (_ns, source) {
                sourceTail = source.tail;
                expect(source.since).toBe('2h');
                ac.abort();
            },
        };
        await runTail(
            client,
            {
                namespace: 'ns',
                selector: 'app=x',
                since: '2h',
                ignoreCase: true,
                regex: false,
                word: false,
                around: 0,
                concurrency: 2,
                output: 'pretty',
                allContainers: false,
                previous: false,
                current: true,
                both: false,
                verbose: false,
                followPods: false,
            },
            {
                onLine: () => undefined,
                onInfo: () => undefined,
            },
            ac.signal,
        );
        expect(sourceTail).toBeUndefined();
    });
});
