#!/usr/bin/env bun
import { appendFileSync } from 'node:fs';
import { parseArgv } from './cli/parse';
import { HELP } from './cli/help';
import { applyConfig, loadConfig } from './config';
import { KubectlClient } from './k8s/kubectl';
import { runSearch, renderSummary } from './commands/search';
import { runTail } from './commands/tail';
import { runContexts, runPods, runApps, runUse } from './commands/meta';
import { VERSION } from './version';
import { shouldUseViewer } from './viewer/surface';
import { mountViewer, type ViewerController } from './viewer/mount';
import type { ViewerQuery } from './viewer/query';

async function main(argv = process.argv.slice(2)): Promise<number> {
    let parsed;
    try {
        parsed = parseArgv(argv);
    } catch (e) {
        console.error(e instanceof Error ? e.message : e);
        return 2;
    }

    if (parsed.command === 'version' || argv.includes('--version') || argv.includes('-V')) {
        console.log(`klog ${VERSION}`);
        return 0;
    }
    if (parsed.command === 'help' || argv.includes('--help') || argv.includes('-h')) {
        console.log(HELP);
        return 0;
    }

    const flags = applyConfig(parsed.flags, await loadConfig());
    const client = new KubectlClient();
    const ac = new AbortController();
    let interruptedBySignal = false;
    const stop = () => {
        interruptedBySignal = true;
        ac.abort();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);

    const writeMatch = (text: string) => {
        console.log(text);
        if (flags.outputFile) appendFileSync(flags.outputFile, `${text}\n`);
    };

    try {
        if (parsed.command === 'search') {
            if (parsed.query === undefined && !flags.status && !flags.level) {
                console.error('search requires a query string. Use "" to dump every line.');
                return 2;
            }
            const query = parsed.query ?? '';
            let viewerEnabled = shouldUseViewer({
                command: parsed.command,
                isTTY: Boolean(process.stdout.isTTY),
                outputExplicit: Boolean(flags.outputExplicit),
                term: process.env.TERM,
            });
            let viewer: ViewerController | undefined;
            let viewerQuery: ViewerQuery | undefined;
            let searchDone = false;
            let interruptedDuringSearch = false;
            const summary = await runSearch(
                client,
                { ...flags, query },
                {
                    onMatch: (text) => {
                        if (!viewerEnabled) writeMatch(text);
                    },
                    onHit: (event) => {
                        if (!viewerEnabled) return;
                        if (!viewer) {
                            try {
                                viewer = mountViewer({
                                    command: 'search',
                                    mode: 'prefix',
                                    limit: flags.viewerLimit ?? 5000,
                                    query: viewerQuery!,
                                    onQuit: () => {
                                        if (!searchDone) {
                                            interruptedDuringSearch = true;
                                            ac.abort();
                                        }
                                    },
                                });
                            } catch {
                                viewerEnabled = false;
                                return;
                            }
                        }
                        viewer.push(event);
                        if (flags.outputFile) appendFileSync(flags.outputFile, `${event.line}\n`);
                    },
                    onQuery: (info) => {
                        viewerQuery = {
                            ...info,
                            query,
                            ignoreCase: flags.ignoreCase,
                            regex: flags.regex,
                            word: flags.word,
                        };
                    },
                    onHeader: (t) => {
                        if (!viewerEnabled) console.error(t);
                    },
                },
                ac.signal,
            );
            searchDone = true;
            if (interruptedBySignal) viewer?.close();
            if (viewer) await viewer.waitUntilExit();
            console.error(renderSummary(summary));
            if (interruptedBySignal || interruptedDuringSearch) return 130;
            return summary.matches === 0 ? 1 : 0;
        }
        if (parsed.command === 'tail') {
            const viewerEnabled = shouldUseViewer({
                command: parsed.command,
                isTTY: Boolean(process.stdout.isTTY),
                outputExplicit: Boolean(flags.outputExplicit),
                term: process.env.TERM,
            });
            let viewer: ViewerController | undefined;
            let interruptedInViewer = false;
            try {
                await runTail(
                    client,
                    { ...flags, query: parsed.query },
                    {
                        onQuery: (info) => {
                            if (!viewerEnabled) return;
                            try {
                                viewer = mountViewer({
                                    command: 'tail',
                                    mode: 'ring',
                                    limit: flags.viewerLimit ?? 2000,
                                    query: {
                                        ...info,
                                        query: parsed.query ?? '',
                                        ignoreCase: flags.ignoreCase,
                                        regex: flags.regex,
                                        word: flags.word,
                                    },
                                    onQuit: (interrupted) => {
                                        interruptedInViewer = interrupted;
                                        ac.abort();
                                    },
                                });
                            } catch {
                                viewer = undefined;
                            }
                        },
                        onLine: (text) => {
                            if (!viewer) writeMatch(text);
                        },
                        onHit: (event) => {
                            viewer?.push(event);
                            if (viewer && flags.outputFile) appendFileSync(flags.outputFile, `${event.line}\n`);
                        },
                        onInfo: (t) => {
                            if (!viewer) console.error(t);
                        },
                    },
                    ac.signal,
                );
            } finally {
                viewer?.close();
            }
            if (interruptedBySignal || interruptedInViewer) return 130;
            return 0;
        }
        if (parsed.command === 'pods') {
            console.log(await runPods(client, flags));
            return 0;
        }
        if (parsed.command === 'apps') {
            const result = await runApps(client, flags, parsed.query);
            console.log(result.text);
            return result.ok ? 0 : 2;
        }
        if (parsed.command === 'contexts') {
            console.log(await runContexts(client));
            return 0;
        }
        if (parsed.command === 'use') {
            const result = await runUse(client, parsed.query);
            console.log(result.text);
            if (!parsed.query || result.switched || result.text.startsWith('Already using')) return 0;
            return 2;
        }
        console.log(HELP);
        return 2;
    } catch (e) {
        if (ac.signal.aborted) {
            console.error('\nInterrupted.');
            return 130;
        }
        console.error(e instanceof Error ? e.message : e);
        return 1;
    } finally {
        process.off('SIGINT', stop);
        process.off('SIGTERM', stop);
    }
}

main().then((code) => process.exit(code));
