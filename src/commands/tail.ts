import type { Flags } from '../cli/parse';
import type { K8sClient, LogHitEvent } from '../k8s/types';
import { searchLines } from '../search/engine';
import { formatHit } from '../output/format';
import { parseKubectlPrefix } from '../k8s/stream';
import { buildJobs, queryTarget, resolvePods, withApp, type Job, type QueryInfo } from './search';

export type TailIO = {
    onLine: (text: string) => void;
    onHit?: (event: LogHitEvent) => void;
    onInfo: (text: string) => void;
    onQuery?: (info: QueryInfo) => void;
};

export async function runTail(client: K8sClient, input: Flags, io: TailIO, signal: AbortSignal): Promise<void> {
    const flags = await withApp(client, input);
    const kubeContext = await client.currentContext(flags.kubeContext);
    const pods = await resolvePods(client, flags);
    io.onQuery?.({
        context: kubeContext,
        namespace: flags.namespace ?? '',
        target: queryTarget(flags),
        since: flags.since,
        until: flags.until,
    });
    io.onInfo(
        [
            'Kubernetes log tail',
            `Context:   ${kubeContext}`,
            `Namespace: ${flags.namespace}`,
            `Pods:      ${pods.length}`,
            flags.followPods ? 'Follow:    new pods enabled' : undefined,
            '',
        ]
            .filter(Boolean)
            .join('\n'),
    );

    const attached = new Set<string>();
    const running: Promise<void>[] = [];

    const start = (job: Job) => {
        const key = `${job.pod.name}|${job.container ?? 'all'}`;
        if (attached.has(key)) return;
        attached.add(key);
        running.push(followJob(client, flags, job, io, signal));
    };

    for (const job of buildJobs(pods, { ...flags, previous: false, current: true, both: false })) {
        start(job);
    }

    let timer: ReturnType<typeof setInterval> | undefined;
    if (flags.followPods) {
        timer = setInterval(() => {
            void (async () => {
                try {
                    const latest = await resolvePods(client, flags);
                    for (const job of buildJobs(latest, { ...flags, previous: false, current: true, both: false })) {
                        if (attached.has(`${job.pod.name}|${job.container ?? 'all'}`)) continue;
                        io.onInfo(`+ pod ${job.pod.name}`);
                        start(job);
                    }
                } catch (e) {
                    if (flags.verbose) io.onInfo(String(e));
                }
            })();
        }, 5000);
        signal.addEventListener('abort', () => {
            if (timer) clearInterval(timer);
        });
    }

    await Promise.all(running);
    if (timer) clearInterval(timer);
}

async function followJob(client: K8sClient, flags: Flags, job: Job, io: TailIO, signal: AbortSignal): Promise<void> {
    try {
        const stream = client.streamLogs(
            flags.namespace ?? '',
            {
                pod: job.pod.name,
                container: job.container,
                allContainers: job.allContainers,
                previous: false,
                since: flags.since,
                tail: flags.tail ?? (flags.since ? undefined : 10),
                timestamps: true,
                follow: true,
            },
            flags.kubeContext,
            signal,
        );
        for await (const hit of searchLines(stream, flags.query ?? '', {
            regex: flags.regex,
            ignoreCase: flags.ignoreCase,
            word: flags.word,
            status: flags.status,
            level: flags.level,
        })) {
            if (signal.aborted) return;
            const container = job.container ?? 'unknown';
            io.onHit?.({
                pod: job.pod.name,
                container,
                line: parseKubectlPrefix(hit.line).line,
            });
            io.onLine(formatHit(hit, { pod: job.pod.name, container, allContainers: job.allContainers }, flags.output));
        }
    } catch (e) {
        if (signal.aborted) return;
        if (flags.verbose) io.onInfo(`⚠ ${job.pod.name}  ${e instanceof Error ? e.message : e}`);
    }
}
