import type { Flags } from '../cli/parse';
import { formatContextList, resolveContextPick } from '../k8s/context-pick';
import type { K8sClient } from '../k8s/types';
import { resolveAppPick, formatAppList } from '../k8s/app-pick';
import { resolvePods, withApp } from './search';

export async function runPods(client: K8sClient, input: Flags): Promise<string> {
    const flags = await withApp(client, input);
    const ctx = await client.currentContext(flags.kubeContext);
    const pods = await resolvePods(client, flags);
    const lines = [`Context: ${ctx}`, `Namespace: ${flags.namespace}`, `Pods: ${pods.length}`, ''];
    for (const p of pods) {
        lines.push(`${p.name}  containers=${p.containers.join(',')}`);
    }
    return lines.join('\n');
}

export async function runApps(
    client: K8sClient,
    flags: Flags,
    pick?: string,
): Promise<{ text: string; ok: boolean }> {
    if (!flags.namespace) {
        throw new Error('Namespace is required. Pass -n or set defaultNamespace in ~/.config/klog/config.yaml');
    }
    const apps = await client.listApps(flags.namespace, flags.kubeContext);
    if (!pick) {
        return {
            ok: true,
            text: [
                `Namespace: ${flags.namespace}`,
                formatAppList(apps),
                '',
                'klog search --app 2 --status 502 --since ayer17:00 --until ayer19:00',
                'klog search --app proceso --since ayer17:00',
            ].join('\n'),
        };
    }
    const result = resolveAppPick(apps, pick);
    if (!result.ok) return { text: result.message, ok: false };
    return { text: `app=${result.name}`, ok: true };
}

export async function runContexts(client: K8sClient): Promise<string> {
    const list = await client.listContexts();
    return formatContextList(list);
}

export async function runUse(client: K8sClient, pick?: string): Promise<{ text: string; switched: boolean }> {
    const list = await client.listContexts();
    const result = resolveContextPick(list, pick ?? '');
    if (!result.ok) return { text: result.message, switched: false };
    const current = list.find((c) => c.current)?.name;
    const lines: string[] = [];
    let switched = false;
    if (current !== result.name) {
        await client.useContext(result.name);
        switched = true;
        lines.push(`Switched to ${result.name}`);
    } else {
        lines.push(`Already using ${result.name}`);
    }
    lines.push(await client.refreshCredentials(result.name));
    lines.push(await client.pingApi(8));
    return { text: lines.join('\n'), switched };
}
