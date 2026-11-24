import type { Hit } from '../search/engine';
import { parseKubectlPrefix } from '../k8s/stream';

export type OutputMode = 'pretty' | 'plain' | 'json';

export type HitMeta = {
    pod: string;
    container: string;
    allContainers: boolean;
};

export function formatHit(hit: Hit, meta: HitMeta, mode: OutputMode): string {
    const line = parseKubectlPrefix(hit.line).line || hit.line;
    const shown = { ...hit, line };
    if (mode === 'json') {
        return JSON.stringify({
            pod: meta.pod,
            container: meta.container,
            timestamp: hit.timestamp ? hit.timestamp.toISOString() : null,
            line,
        });
    }
    if (mode === 'plain') {
        return formatBlock(shown, false);
    }
    const header = meta.allContainers ? `[pod=${meta.pod}][container=${meta.container}]` : `[${meta.pod}]`;
    const body = formatBlock(shown, true);
    return `${header}\n${body}`;
}

function formatBlock(hit: Hit, markMatch: boolean): string {
    const lines: string[] = [];
    for (const l of hit.before) lines.push(l);
    lines.push(markMatch && (hit.before.length > 0 || hit.after.length > 0) ? `>>> ${hit.line}` : hit.line);
    for (const l of hit.after) lines.push(l);
    return lines.join('\n');
}

export type Summary = {
    matches: number;
    pods: number;
    successful: number;
    unavailable: number;
    noPrevious: number;
    elapsedMs: number;
};

export function formatSummary(s: Summary): string {
    const elapsed = `Elapsed: ${(s.elapsedMs / 1000).toFixed(2)}s`;
    const head =
        s.matches === 0 ? `No matches found across ${s.pods} pods.` : `${s.matches} matches\n${s.pods} pods searched`;
    const extra: string[] = [];
    if (s.successful && s.matches !== 0) extra.push(`${s.successful} successful`);
    if (s.unavailable) extra.push(`${s.unavailable} unavailable`);
    if (s.noPrevious) extra.push(`${s.noPrevious} no previous logs`);
    return ['────────────────────────────────────────────', head, ...extra, elapsed].join('\n');
}

export function formatHeader(info: {
    kubeContext: string;
    namespace: string;
    target: string;
    pods: number;
    concurrency: number;
    since?: string;
}): string {
    return [
        'Kubernetes log search',
        '',
        `Context:   ${info.kubeContext}`,
        `Namespace: ${info.namespace}`,
        `Target:    ${info.target}`,
        `Pods:      ${info.pods}`,
        `Workers:   ${info.concurrency}`,
        info.since ? `Since:     ${info.since}` : undefined,
        '',
        'Searching...',
    ]
        .filter((l) => l !== undefined)
        .join('\n');
}
