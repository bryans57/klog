import { logError } from './classify';
import { parseKubectlPrefix, readLines } from './stream';
import type { K8sClient, LogSource, PodInfo } from './types';
import { K8sLogError } from './types';
import { parseGkeContext, resolveGkeClusterName } from './gke';
import { toKubectlSinceArg } from '../time';

type KubeJson = Record<string, unknown>;

export class KubectlClient implements K8sClient {
    constructor(private bin = 'kubectl') {}

    async currentContext(explicit?: string): Promise<string> {
        if (explicit) return explicit;
        const r = await this.run(['config', 'current-context']);
        if (r.code !== 0) throw new Error(r.stderr || 'No current kubectl context');
        return r.stdout.trim();
    }

    async listContexts(): Promise<{ name: string; current: boolean }[]> {
        const current = (await this.currentContext()).trim();
        const r = await this.run(['config', 'get-contexts', '-o', 'name']);
        if (r.code !== 0) throw new Error(r.stderr || 'kubectl config get-contexts failed');
        return r.stdout
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((name) => ({ name, current: name === current }));
    }

    async useContext(name: string): Promise<void> {
        const r = await this.run(['config', 'use-context', name]);
        if (r.code !== 0) throw new Error(r.stderr.trim() || `kubectl config use-context ${name} failed`);
    }

    async refreshCredentials(contextName: string): Promise<string> {
        const gke = parseGkeContext(contextName);
        if (!gke) return 'Not a GKE context; skipped get-credentials';
        const listed = await this.listGkeClusters(gke.project);
        const cluster =
            listed.length > 0 ? resolveGkeClusterName(gke.cluster, listed) : gke.cluster;
        if (!cluster) {
            throw new Error(
                `No GKE cluster matching "${gke.cluster}" in ${gke.project}. Found: ${listed.join(', ') || '(none)'}`,
            );
        }
        const loc = gke.locationFlag === 'zone' ? '--zone' : '--region';
        const r = await this.runBin('gcloud', [
            'container',
            'clusters',
            'get-credentials',
            cluster,
            loc,
            gke.location,
            '--project',
            gke.project,
            '--quiet',
        ]);
        if (r.code !== 0) {
            throw new Error(r.stderr.trim() || `gcloud get-credentials ${cluster} failed`);
        }
        const mapped = cluster !== gke.cluster ? ` (kubeconfig had ${gke.cluster})` : '';
        return `Credentials refreshed: ${cluster}${mapped}`;
    }

    async pingApi(timeoutSec = 8): Promise<string> {
        const r = await this.run(['--request-timeout', `${timeoutSec}s`, 'get', 'ns', '--no-headers']);
        if (r.code !== 0) {
            throw new Error(
                `API unreachable in ${timeoutSec}s. Endpoint may be stale or you need VPN/IAP.\n${r.stderr.trim()}`,
            );
        }
        return `API reachable (${timeoutSec}s)`;
    }

    private async listGkeClusters(project: string): Promise<string[]> {
        const r = await this.runBin('gcloud', [
            'container',
            'clusters',
            'list',
            '--project',
            project,
            '--format=value(name)',
        ]);
        if (r.code !== 0) return [];
        return r.stdout
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
    }

    async listPods(namespace: string, selector: string | undefined, kubeContext?: string): Promise<PodInfo[]> {
        const args = this.base(kubeContext, namespace);
        args.push('get', 'pods', '-o', 'json');
        if (selector) args.push('-l', selector);
        const json = await this.json(args);
        return parsePodList(json);
    }

    async listApps(namespace: string, kubeContext?: string): Promise<string[]> {
        const args = this.base(kubeContext, namespace);
        args.push('get', 'pods', '-o', 'json');
        return appLabels(await this.json(args));
    }

    async podsForDeployment(namespace: string, deployment: string, kubeContext?: string): Promise<PodInfo[]> {
        const args = this.base(kubeContext, namespace);
        args.push('get', 'deploy', deployment, '-o', 'json');
        const json = (await this.json(args)) as {
            spec?: { selector?: { matchLabels?: Record<string, string> } };
        };
        const labels = json.spec?.selector?.matchLabels;
        if (!labels || !Object.keys(labels).length) {
            throw new Error(`Deployment ${deployment} has no matchLabels selector`);
        }
        const selector = Object.entries(labels)
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return this.listPods(namespace, selector, kubeContext);
    }

    async getPod(namespace: string, name: string, kubeContext?: string): Promise<PodInfo> {
        const args = this.base(kubeContext, namespace);
        args.push('get', 'pod', name, '-o', 'json');
        const json = await this.json(args);
        const pods = parsePodList({ items: [json] });
        if (!pods.length) throw new K8sLogError(`pod ${name} not found`, 'unavailable');
        return pods[0];
    }

    async *streamLogs(
        namespace: string,
        source: LogSource,
        kubeContext: string | undefined,
        signal: AbortSignal,
    ): AsyncIterable<string> {
        const args = this.base(kubeContext, namespace);
        args.push('logs', source.pod);
        if (source.allContainers) args.push('--all-containers', '--prefix');
        else if (source.container) args.push('-c', source.container);
        if (source.previous) args.push('--previous');
        if (source.follow) args.push('-f');
        if (source.since) args.push(toKubectlSinceArg(source.since));
        if (source.tail !== undefined) args.push(`--tail=${source.tail}`);
        if (source.timestamps) args.push('--timestamps');

        const proc = Bun.spawn([this.bin, ...args], { stdout: 'pipe', stderr: 'pipe', stdin: 'ignore' });
        const kill = () => proc.kill();
        signal.addEventListener('abort', kill);
        let stderr = '';
        const errTask = new Response(proc.stderr).text().then((t) => {
            stderr = t;
        });
        try {
            for await (const raw of readLines(proc.stdout)) {
                if (signal.aborted) return;
                const parsed = parseKubectlPrefix(raw);
                yield parsed.container && source.allContainers ? `${source.pod}/${parsed.container}: ${parsed.line}` : parsed.line;
            }
            const code = await proc.exited;
            await errTask;
            if (signal.aborted) return;
            if (code !== 0) throw logError(stderr, source.previous);
        } finally {
            signal.removeEventListener('abort', kill);
            try {
                proc.kill();
            } catch {
                /* already exited */
            }
        }
    }

    private base(kubeContext: string | undefined, namespace?: string): string[] {
        const args: string[] = [];
        if (kubeContext) args.push('--context', kubeContext);
        if (namespace) args.push('-n', namespace);
        return args;
    }

    private async json(args: string[]): Promise<KubeJson> {
        const r = await this.run(args);
        if (r.code !== 0) throw new Error(r.stderr.trim() || `kubectl failed (${r.code})`);
        return JSON.parse(r.stdout) as KubeJson;
    }

    private async run(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
        return this.runBin(this.bin, args);
    }

    private async runBin(bin: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
        const proc = Bun.spawn([bin, ...args], { stdout: 'pipe', stderr: 'pipe', stdin: 'ignore' });
        const [stdout, stderr, code] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
            proc.exited,
        ]);
        return { stdout, stderr, code: code ?? 1 };
    }
}

export function parsePodList(json: unknown): PodInfo[] {
    const items = (json as { items?: unknown[] }).items ?? [];
    const pods: PodInfo[] = [];
    for (const item of items) {
        const pod = item as {
            metadata?: { name?: string };
            spec?: { containers?: { name: string }[] };
        };
        const name = pod.metadata?.name;
        if (!name) continue;
        const containers = (pod.spec?.containers ?? []).map((c) => c.name);
        pods.push({ name, containers });
    }
    return pods;
}

export function appLabels(json: unknown): string[] {
    const items = (json as { items?: unknown[] }).items ?? [];
    const names = new Set<string>();
    for (const item of items) {
        const app = (item as { metadata?: { labels?: { app?: unknown } } }).metadata?.labels?.app;
        if (typeof app === 'string' && app) names.add(app);
    }
    return [...names].sort();
}
