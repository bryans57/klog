import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Flags } from './cli/parse';

export type FileConfig = {
    defaultContext?: string;
    defaultNamespace?: string;
    concurrency?: number;
    viewerLimit?: number;
};

export async function loadConfig(path = join(homedir(), '.config/klog/config.yaml')): Promise<FileConfig> {
    const file = Bun.file(path);
    if (!(await file.exists())) return {};
    const text = await file.text();
    return parseSimpleYaml(text);
}

export function applyConfig(flags: Flags, cfg: FileConfig): Flags {
    return {
        ...flags,
        kubeContext: flags.kubeContext ?? cfg.defaultContext,
        namespace: flags.namespace ?? cfg.defaultNamespace,
        concurrency: flags.concurrency === 10 && cfg.concurrency ? cfg.concurrency : flags.concurrency,
        viewerLimit: flags.viewerLimit ?? cfg.viewerLimit,
    };
}

export function parseSimpleYaml(text: string): FileConfig {
    const out: FileConfig = {};
    for (const raw of text.split('\n')) {
        const line = raw.replace(/#.*$/, '').trim();
        if (!line) continue;
        const m = /^([\w]+):\s*(.+)$/.exec(line);
        if (!m) continue;
        const k = m[1];
        const v = m[2].replace(/^['"]|['"]$/g, '');
        if (k === 'defaultContext') out.defaultContext = v;
        if (k === 'defaultNamespace') out.defaultNamespace = v;
        if (k === 'concurrency') out.concurrency = Number(v);
        if (k === 'viewerLimit') out.viewerLimit = Number(v);
    }
    return out;
}
