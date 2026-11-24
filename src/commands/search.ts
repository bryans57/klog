import { runPool } from '../concurrency/pool';
import { resolveAppPick } from '../k8s/app-pick';
import type { Flags } from '../cli/parse';
import type { K8sClient, LogHitEvent, PodInfo } from '../k8s/types';
import { K8sLogError, pickContainers } from '../k8s/types';
import { parseKubectlPrefix } from '../k8s/stream';
import { searchLines } from '../search/engine';
import { parseTimeBound, normalizeSince } from '../time';
import { formatHeader, formatHit, formatSummary, type Summary } from '../output/format';

export type SearchIO = {
    onMatch: (text: string) => void;
    onHit?: (event: LogHitEvent) => void;
    onHeader: (text: string) => void;
    onQuery?: (info: QueryInfo) => void;
};

export type QueryInfo = {
    context: string;
    namespace: string;
    target: string;
    since?: string;
    until?: string;
};

export function queryTarget(flags: Flags): string {
    if (flags.pod) return `pod/${flags.pod}`;
    if (flags.deployment) return `deployment/${flags.deployment}`;
    return flags.selector ?? '';
}

export async function withApp(client: K8sClient, flags: Flags): Promise<Flags> {
    if (!flags.app) return flags;
    if (flags.selector || flags.deployment || flags.pod) {
        throw new Error('Pass only one of --app, -l, --deployment, or --pod');
    }
    if (!flags.namespace) {
        throw new Error('Namespace is required. Pass -n or set defaultNamespace in ~/.config/klog/config.yaml');
    }
    const apps = await client.listApps(flags.namespace, flags.kubeContext);
    const pick = resolveAppPick(apps, flags.app);
    if (!pick.ok) throw new Error(pick.message);
    return { ...flags, selector: `app=${pick.name}` };
}

export async function resolvePods(client: K8sClient, flags: Flags): Promise<PodInfo[]> {
    const ns = flags.namespace;
    if (!ns) throw new Error('Namespace is required. Pass -n or set defaultNamespace in ~/.config/klog/config.yaml');
    if (flags.pod) return [await client.getPod(ns, flags.pod, flags.kubeContext)];
    if (flags.deployment) return client.podsForDeployment(ns, flags.deployment, flags.kubeContext);
    if (flags.selector) return client.listPods(ns, flags.selector, flags.kubeContext);
    throw new Error('Specify --app, -l/--selector, --deployment, or --pod');
}

export type Job = {
    pod: PodInfo;
    container?: string;
    allContainers: boolean;
    previous: boolean;
};

export function buildJobs(pods: PodInfo[], flags: Flags): Job[] {
    const sources: boolean[] = [];
    if (flags.both || (flags.current && flags.previous)) {
        sources.push(false, true);
    } else if (flags.previous && !flags.current) {
        sources.push(true);
    } else {
        sources.push(false);
    }
    const jobs: Job[] = [];
    for (const pod of pods) {
        const picked = pickContainers(pod, flags.allContainers, flags.container);
        for (const previous of sources) {
            if (picked === 'all') {
                jobs.push({ pod, allContainers: true, previous });
            } else {
                for (const container of picked) {
                    jobs.push({ pod, container, allContainers: false, previous });
                }
            }
        }
    }
    return jobs;
}

export async function runSearch(
    client: K8sClient,
    input: Flags & { query: string },
    io: SearchIO,
    signal: AbortSignal = new AbortController().signal,
): Promise<Summary> {
    const flags = await withApp(client, input);
    const started = Date.now();
    const since = flags.since ? normalizeSince(flags.since) : flags.tail !== undefined ? undefined : '1h';
    const kubeContext = await client.currentContext(flags.kubeContext);
    const pods = await resolvePods(client, flags);
    const target = flags.pod ?? flags.deployment ?? flags.selector ?? '';
    io.onQuery?.({
        context: kubeContext,
        namespace: flags.namespace ?? '',
        target: queryTarget(flags),
        since,
        until: flags.until,
    });
    io.onHeader(
        formatHeader({
            kubeContext,
            namespace: flags.namespace ?? '',
            target,
            pods: pods.length,
            concurrency: flags.concurrency,
            since,
        }),
    );
    if (pods.length === 0) {
        return {
            matches: 0,
            pods: 0,
            successful: 0,
            unavailable: 0,
            noPrevious: 0,
            elapsedMs: Date.now() - started,
        };
    }

    const jobs = buildJobs(pods, flags);
    const until = flags.until ? parseTimeBound(flags.until) : undefined;
    const before = flags.before ?? flags.around;
    const after = flags.after ?? flags.around;
    const timestamps = true;
    const podOk = new Set<string>();
    const podFail = new Map<string, string>();
    let matches = 0;
    let noPrevious = 0;
    let unavailable = 0;

    await runPool(
        jobs,
        flags.concurrency,
        async (job, signal) => {
            try {
                const stream = client.streamLogs(
                    flags.namespace ?? '',
                    {
                        pod: job.pod.name,
                        container: job.container,
                        allContainers: job.allContainers,
                        previous: job.previous,
                        since,
                        tail: flags.tail,
                        timestamps,
                        follow: false,
                    },
                    flags.kubeContext,
                    signal,
                );
                for await (const hit of searchLines(stream, flags.query ?? '', {
                    regex: flags.regex,
                    ignoreCase: flags.ignoreCase,
                    word: flags.word,
                    before,
                    after,
                    until,
                    status: flags.status,
                    level: flags.level,
                })) {
                    const container = hitContainer(job, hit.line) ?? job.container ?? 'unknown';
                    io.onHit?.({
                        pod: job.pod.name,
                        container,
                        line: parseKubectlPrefix(hit.line).line,
                    });
                    io.onMatch(
                        formatHit(
                            hit,
                            { pod: job.pod.name, container, allContainers: job.allContainers },
                            flags.output,
                        ),
                    );
                    matches++;
                }
                podOk.add(job.pod.name);
            } catch (e) {
                const err = e instanceof K8sLogError ? e : toLogError(e);
                if (err.code === 'no_previous') noPrevious++;
                else unavailable++;
                podFail.set(job.pod.name, err.code);
                io.onHeader(`⚠ ${job.pod.name}  ${err.code}${flags.verbose ? `  ${err.message}` : ''}`);
            }
        },
        signal,
    );

    const successful = pods.filter((p) => podOk.has(p.name)).length;
    return {
        matches,
        pods: pods.length,
        successful,
        unavailable,
        noPrevious,
        elapsedMs: Date.now() - started,
    };
}

function hitContainer(job: Job, line: string): string | undefined {
    if (!job.allContainers) return job.container;
    const m = /^[^/\s]+\/([^:]+):\s/.exec(line);
    return m?.[1];
}

function toLogError(e: unknown): K8sLogError {
    if (e && typeof e === 'object' && 'code' in e && (e as K8sLogError).code) {
        const err = e as K8sLogError;
        return new K8sLogError(err.message, err.code);
    }
    return new K8sLogError(e instanceof Error ? e.message : String(e), 'failed');
}

export function renderSummary(s: Summary): string {
    return formatSummary(s);
}
