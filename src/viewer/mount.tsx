import React from 'react';
import { render, type Instance } from 'ink';
import type { LogHitEvent } from '../k8s/types';
import { createBuffer, pushHit, type BufferMode, type HitBuffer } from './buffer';
import { ViewerApp } from './app';
import { createViewerHit, type ViewerHit } from './model';
import type { ViewerQuery } from './query';
import { createRedrawScheduler } from './redraw';
import { createScreenLifecycle } from './screen';
import { notePodTime, readLogInstant, type PodSpan } from './span';

export type ViewerController = {
    push(event: LogHitEvent): void;
    close(): void;
    waitUntilExit(): Promise<void>;
};

export function mountViewer(options: {
    command: 'search' | 'tail';
    mode: BufferMode;
    limit: number;
    query: ViewerQuery;
    onQuit: (interrupted: boolean) => void;
}): ViewerController {
    let buffer: HitBuffer<ViewerHit> = createBuffer(options.mode, options.limit);
    let nextId = 1;
    let instance: Instance | undefined;
    let closed = false;
    const podSpans = new Map<string, PodSpan>();
    const screen = createScreenLifecycle((text) => process.stdout.write(text));
    const tree = () => (
        <ViewerApp
            command={options.command}
            query={options.query}
            hits={buffer.hits}
            truncated={buffer.truncated}
            limit={buffer.limit}
            rows={process.stdout.rows ?? 24}
            columns={process.stdout.columns ?? 80}
            mouseEnabled={Boolean(process.stdin.isTTY && process.stdin.setRawMode)}
            podSpans={Object.fromEntries(podSpans)}
            onQuit={quit}
        />
    );
    const redraw = () => {
        if (!closed) instance?.rerender(tree());
    };
    const scheduler = createRedrawScheduler(redraw);
    const close = () => {
        if (closed) return;
        closed = true;
        scheduler.stop();
        process.stdout.off('resize', redraw);
        instance?.unmount();
        screen.restore();
    };
    const quit = (interrupted = false) => {
        options.onQuit(interrupted);
        close();
    };

    try {
        screen.enter();
        instance = render(tree(), {
            exitOnCtrlC: false,
            patchConsole: true,
            maxFps: 30,
        });
        process.stdout.on('resize', redraw);
    } catch (error) {
        close();
        throw error;
    }

    return {
        push(event) {
            if (closed) return;
            const instant = readLogInstant(event.line);
            if (instant != null) {
                notePodTime(podSpans, event.pod, instant, event.line);
                scheduler.request();
            }
            if (buffer.truncated === 'prefix') return;
            const next = pushHit(buffer, createViewerHit(String(nextId++), event.pod, event.container, event.line));
            if (next === buffer) return;
            buffer = next;
            try {
                scheduler.request();
            } catch (error) {
                close();
                throw error;
            }
        },
        close,
        async waitUntilExit() {
            try {
                scheduler.flush();
                await instance?.waitUntilExit();
            } finally {
                close();
            }
        },
    };
}
