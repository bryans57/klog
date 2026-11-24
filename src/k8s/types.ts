export type PodInfo = {
    name: string;
    containers: string[];
};

export type LogHitEvent = {
    pod: string;
    container: string;
    line: string;
};

export type LogSource = {
    pod: string;
    container?: string;
    allContainers: boolean;
    previous: boolean;
    since?: string;
    tail?: number;
    timestamps: boolean;
    follow: boolean;
};

export type LogErrorCode = 'no_previous' | 'unavailable' | 'failed';

export class K8sLogError extends Error {
    constructor(
        message: string,
        public code: LogErrorCode,
    ) {
        super(message);
        this.name = 'K8sLogError';
    }
}

export type K8sClient = {
    currentContext(explicit?: string): Promise<string>;
    listContexts(): Promise<{ name: string; current: boolean }[]>;
    useContext(name: string): Promise<void>;
    refreshCredentials(contextName: string): Promise<string>;
    pingApi(timeoutSec?: number): Promise<string>;
    listPods(namespace: string, selector: string | undefined, kubeContext?: string): Promise<PodInfo[]>;
    listApps(namespace: string, kubeContext?: string): Promise<string[]>;
    podsForDeployment(namespace: string, deployment: string, kubeContext?: string): Promise<PodInfo[]>;
    getPod(namespace: string, name: string, kubeContext?: string): Promise<PodInfo>;
    streamLogs(
        namespace: string,
        source: LogSource,
        kubeContext: string | undefined,
        signal: AbortSignal,
    ): AsyncIterable<string>;
};

export const SIDECARS = new Set(['istio-proxy', 'istio-init', 'linkerd-proxy', 'linkerd-init', 'envoy']);

export function pickContainers(pod: PodInfo, allContainers: boolean, container?: string): string[] | 'all' {
    if (allContainers) return 'all';
    if (container) return [container];
    const apps = pod.containers.filter((c) => !SIDECARS.has(c));
    if (apps.length === 1) return [apps[0]];
    if (apps.length > 1) return apps;
    if (pod.containers.length === 1) return [pod.containers[0]];
    return 'all';
}
