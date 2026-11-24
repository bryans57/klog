import React from 'react';
import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from 'ink-testing-library';
import { ViewerApp } from '../src/viewer/app';
import { createViewerHit } from '../src/viewer/model';
import { notePodTime, type PodSpan } from '../src/viewer/span';
import type { ViewerQuery } from '../src/viewer/query';

afterEach(cleanup);

const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;]*m/g, '');

const viewerQuery: ViewerQuery = {
    context: 'gke_demo',
    namespace: 'ejemplos',
    target: 'app=adjuntos',
    query: 'REPOSITORY_ERROR',
    since: '40m',
    ignoreCase: true,
    regex: false,
    word: false,
};

const longHits = (count: number, pods = 1) =>
    Array.from({ length: count }, (_, index) =>
        createViewerHit(
            String(index + 1),
            `app-adjuntos-ms-6496b8686b-${index % pods}`,
            'app-adjuntos-ms',
            JSON.stringify({
                level: 'error',
                ts: '2026-09-11T18:02:11Z',
                msg: `El usuario de base de datos no tiene permisos para ejecutar ${'x'.repeat(300)}`,
                layer: 'http',
                status: 403,
            }),
        ),
    );

describe('ViewerApp', () => {
    test('renders the effective query context in the header', () => {
        const view = render(
            <ViewerApp
                command="search"
                query={viewerQuery}
                hits={[]}
                truncated={false}
                limit={5000}
                mouseEnabled={false}
                onQuit={() => undefined}
            />,
        );

        const frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('gke_demo · ejemplos/app=adjuntos · since 40m');
        expect(frame).toContain('query: "REPOSITORY_ERROR"');
    });

    test('highlights the klog query in the row and selected detail', async () => {
        const hit = createViewerHit(
            '1',
            'pod-a',
            'application',
            '{"level":"error","msg":"REPOSITORY_ERROR","error_message":"repository_error guardando anexo"}',
        );
        const view = render(
            <ViewerApp
                command="search"
                query={viewerQuery}
                hits={[hit]}
                truncated={false}
                limit={5000}
                mouseEnabled={false}
                rows={24}
                columns={100}
                onQuit={() => undefined}
            />,
        );

        view.stdin.write('\u001B[B');
        await Bun.sleep(10);

        const frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('REPOSITORY_ERROR');
        expect(frame).toContain('repository_error guardando anexo');
    });

    test('keeps the highlighted query independent from the local filter', async () => {
        const hit = createViewerHit('1', 'pod-a', 'application', '{"level":"error","msg":"ERROR Redis connection"}');
        const view = render(
            <ViewerApp
                command="search"
                query={{ ...viewerQuery, query: 'ERROR' }}
                hits={[hit]}
                truncated={false}
                limit={5000}
                mouseEnabled={false}
                onQuit={() => undefined}
            />,
        );

        view.stdin.write('/');
        await Bun.sleep(10);
        view.stdin.write('Redis');
        await Bun.sleep(10);

        const frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('ERROR Redis connection');
        expect(frame).toContain('filter: Redis');
    });

    test('keeps query header and detail inside a small viewport', async () => {
        const hit = createViewerHit('1', 'pod-with-a-very-long-name', 'application', 'REPOSITORY_ERROR');
        const view = render(
            <ViewerApp
                command="search"
                query={{ ...viewerQuery, target: 'app=a-very-long-target-name', query: 'REPOSITORY_ERROR'.repeat(5) }}
                hits={[hit]}
                truncated={false}
                limit={5000}
                mouseEnabled={false}
                rows={12}
                columns={60}
                onQuit={() => undefined}
            />,
        );

        view.stdin.write('\u001B[B');
        await Bun.sleep(10);

        const lines = stripAnsi(view.lastFrame() ?? '').split('\n');
        expect(lines.length).toBeLessThanOrEqual(12);
        expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(60);
    });

    test('renders a compact group, summary row, and selected detail', () => {
        const hit = createViewerHit(
            '1',
            'pod-a',
            'application',
            '{"level":"error","ts":"2026-09-11T18:02:11Z","msg":"proceso failed","trace":"a1b2"}',
        );
        const view = render(
            <ViewerApp
                command="search"
                hits={[hit]}
                truncated={false}
                limit={5000}
                mouseEnabled={false}
                onQuit={() => undefined}
            />,
        );

        const frame = view.lastFrame() ?? '';
        expect(frame).toContain('klog search');
        expect(frame).toContain('pod-a');
        expect(frame).toContain('09-11 13:02:11');
        expect(frame).toContain('ERROR');
        expect(frame).toContain('proceso failed');
    });

    test('renders the ring-buffer notice', () => {
        const view = render(
            <ViewerApp
                command="tail"
                hits={[]}
                truncated="ring"
                limit={2000}
                mouseEnabled={false}
                onQuit={() => undefined}
            />,
        );

        expect(view.lastFrame()).toContain('showing latest 2000');
    });

    test('never draws a frame taller or wider than the terminal viewport', () => {
        const view = render(
            <ViewerApp
                command="search"
                hits={longHits(40)}
                truncated={false}
                limit={5000}
                mouseEnabled={false}
                rows={14}
                columns={60}
                onQuit={() => undefined}
            />,
        );

        const lines = stripAnsi(view.lastFrame() ?? '').split('\n');
        expect(lines.length).toBeLessThanOrEqual(14);
        expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(60);
    });

    test('keeps the frame inside a short viewport even with a selected line open', async () => {
        const view = render(
            <ViewerApp
                command="search"
                hits={longHits(20)}
                truncated="prefix"
                limit={5000}
                mouseEnabled={false}
                rows={12}
                columns={60}
                onQuit={() => undefined}
            />,
        );

        view.stdin.write('\u001B[B');
        await Bun.sleep(10);

        const lines = stripAnsi(view.lastFrame() ?? '').split('\n');
        expect(lines.length).toBeLessThanOrEqual(12);
        expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(60);
    });

    test('labels the columns and how much of the list is on screen', () => {
        const view = render(
            <ViewerApp
                command="search"
                hits={longHits(40)}
                truncated={false}
                limit={5000}
                mouseEnabled={false}
                rows={14}
                columns={80}
                onQuit={() => undefined}
            />,
        );

        const frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('level');
        expect(frame).toContain('message');
        expect(frame).toContain('pod 1 of 1');
        expect(frame).toContain('▾');
    });

    test('shows the message inside the detail panel of the selected line', async () => {
        const view = render(
            <ViewerApp
                command="search"
                hits={longHits(3)}
                truncated={false}
                limit={5000}
                mouseEnabled={false}
                rows={24}
                columns={80}
                onQuit={() => undefined}
            />,
        );

        view.stdin.write('\u001B[B');
        await Bun.sleep(10);

        const frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('detail');
        expect(frame).toContain('message');
        expect(frame).toContain('El usuario de base de datos');
        const lines = frame.split('\n');
        expect(lines.length).toBeLessThanOrEqual(24);
        expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(80);
    });

    test('prioritises error fields over noise in the detail panel', async () => {
        const hit = createViewerHit(
            '1',
            'pod-a',
            'application',
            JSON.stringify({
                level: 'error',
                timestamp: '2026-09-11T19:35:42.053-05:00',
                pid: 28,
                hostname: 'pod-a',
                host: '172.21.208.203',
                port: 6379,
                layer: 'http',
                status: 403,
                error_message: 'El usuario de base de datos no tiene permisos',
                msg: 'REPOSITORY_ERROR',
            }),
        );
        const view = render(
            <ViewerApp
                command="search"
                hits={[hit]}
                truncated={false}
                limit={5000}
                mouseEnabled={false}
                rows={24}
                columns={100}
                onQuit={() => undefined}
            />,
        );

        view.stdin.write('\u001B[B');
        await Bun.sleep(10);

        const frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('El usuario de base de datos no tiene permisos');
        expect(frame).toContain('more fields');
    });

    test('ignores mouse tracking payloads while typing a filter', async () => {
        const view = render(
            <ViewerApp
                command="tail"
                hits={longHits(4)}
                truncated={false}
                limit={2000}
                mouseEnabled={false}
                rows={24}
                columns={80}
                onQuit={() => undefined}
            />,
        );

        view.stdin.write('/');
        await Bun.sleep(10);
        view.stdin.write('lista');
        await Bun.sleep(10);
        view.stdin.write('\u001b[<35;85;11M');
        await Bun.sleep(10);
        view.stdin.write('[<35;84;10M');
        await Bun.sleep(10);

        const frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('filter: lista');
        expect(frame).not.toContain('35;85;11M');
    });

    test('navigates and confirms with the keyboard while the filter is active', async () => {
        const view = render(
            <ViewerApp
                command="search"
                hits={longHits(4)}
                truncated={false}
                limit={5000}
                mouseEnabled={false}
                rows={24}
                columns={80}
                onQuit={() => undefined}
            />,
        );

        view.stdin.write('/');
        await Bun.sleep(10);
        view.stdin.write('permisos');
        await Bun.sleep(10);
        view.stdin.write('\u001B[B');
        await Bun.sleep(10);

        let frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('enter confirms');
        expect(frame).toContain('detail');

        view.stdin.write('\r');
        await Bun.sleep(10);
        frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('filter: permisos');
        expect(frame).not.toContain('enter confirms');
    });

    test('clears the filter with esc after it was confirmed with enter', async () => {
        const view = render(
            <ViewerApp
                command="search"
                hits={longHits(4)}
                truncated={false}
                limit={5000}
                mouseEnabled={false}
                rows={24}
                columns={80}
                onQuit={() => undefined}
            />,
        );

        view.stdin.write('/');
        await Bun.sleep(10);
        view.stdin.write('permisos');
        await Bun.sleep(10);
        view.stdin.write('\r');
        await Bun.sleep(10);
        expect(stripAnsi(view.lastFrame() ?? '')).toContain('filter: permisos');

        view.stdin.write('\u001b');
        await Bun.sleep(10);

        const frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).not.toContain('filter:');
        expect(frame).not.toContain('esc clear filter');
    });

    test('tells which log line is selected instead of raw row numbers', async () => {
        const view = render(
            <ViewerApp
                command="search"
                hits={longHits(4)}
                truncated={false}
                limit={5000}
                mouseEnabled={false}
                rows={24}
                columns={90}
                onQuit={() => undefined}
            />,
        );

        expect(stripAnsi(view.lastFrame() ?? '')).toContain('pod 1 of 1');

        view.stdin.write('c');
        await Bun.sleep(10);
        view.stdin.write('\u001B[B');
        await Bun.sleep(10);
        view.stdin.write('\u001B[B');
        await Bun.sleep(10);

        const frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('hit 2 of 4');
        expect(frame).not.toContain('of 5 ·');
    });

    test('says when the filter is what hides every hit', async () => {
        const view = render(
            <ViewerApp
                command="tail"
                hits={longHits(4)}
                truncated={false}
                limit={2000}
                mouseEnabled={false}
                rows={24}
                columns={80}
                onQuit={() => undefined}
            />,
        );

        view.stdin.write('/');
        await Bun.sleep(10);
        view.stdin.write('zzzz');
        await Bun.sleep(10);

        const frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('No hits match');
        expect(frame).not.toContain('Waiting for log lines');
    });

    test('quits from the keyboard without requiring mouse support', async () => {
        let quit = false;
        const view = render(
            <ViewerApp
                command="tail"
                hits={[]}
                truncated={false}
                limit={2000}
                mouseEnabled={false}
                onQuit={() => {
                    quit = true;
                }}
            />,
        );

        view.stdin.write('q');
        await Bun.sleep(10);
        expect(quit).toBe(true);
    });

    test('shows HTTP method, url, status and the pod time span', async () => {
        const pod = 'app-consulta-ms-5c5d989887-ltv7t';
        const spans = new Map<string, PodSpan>();
        notePodTime(spans, pod, new Date('2026-09-16T08:54:18-05:00').getTime(), '2026-09-16T08:54:18-05:00');
        notePodTime(spans, pod, new Date('2026-09-16T10:22:01-05:00').getTime(), '2026-09-16T10:22:01-05:00');
        const hit = createViewerHit(
            '1',
            pod,
            'app-consulta-ms',
            '2026-09-16T08:54:18.707-05:00 {"method":"GET","url":"/ejemplos/repartidores/consultar-repartidor/48151","status":400,"request":{"headers":{"host":"apiv2"}}}',
        );
        const view = render(
            <ViewerApp
                command="search"
                hits={[hit]}
                podSpans={Object.fromEntries(spans)}
                truncated={false}
                limit={5000}
                mouseEnabled={false}
                rows={24}
                columns={100}
                onQuit={() => undefined}
            />,
        );

        view.stdin.write('\u001B[B');
        await Bun.sleep(10);

        const frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('GET');
        expect(frame).toContain('consultar-repartidor/48151');
        expect(frame).toContain('400');
        expect(frame).not.toContain('"application"');
        expect(frame).toContain('08:54 → 10:22');
        expect(frame).toContain('status');
        expect(frame).not.toContain('request');
    });

    test('shows Bogota date-time, duration and last hit clock on tail', async () => {
        const first = createViewerHit(
            '1',
            'pod-a',
            'app',
            JSON.stringify({
                ts: '2026-09-25T15:30:00-05:00',
                method: 'PUT',
                status: 502,
                responseTimeMs: 3,
                error_message: 'timeout',
            }),
        );
        const second = createViewerHit(
            '2',
            'pod-a',
            'app',
            JSON.stringify({
                ts: '2026-09-25T15:31:08-05:00',
                method: 'PUT',
                status: 502,
                responseTimeMs: 1200,
                error_message: 'timeout',
            }),
        );
        const view = render(
            <ViewerApp
                command="tail"
                hits={[first, second]}
                truncated={false}
                limit={2000}
                mouseEnabled={false}
                rows={24}
                columns={100}
                onQuit={() => undefined}
            />,
        );

        view.stdin.write('c');
        await Bun.sleep(10);
        view.stdin.write('\u001B[B');
        await Bun.sleep(10);

        const frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('09-25 15:30:00');
        expect(frame).toContain('3ms');
        expect(frame).toContain('last 09-25 15:31:08');
        expect(frame).toContain('dur');
    });

    test('x hides a message and u restores the chosen one', async () => {
        const hits = [
            createViewerHit('1', 'pod-a', 'app', '{"level":"info","msg":"ruido"}'),
            createViewerHit('2', 'pod-a', 'app', '{"level":"info","msg":"util"}'),
        ];
        const view = render(
            <ViewerApp
                command="tail"
                hits={hits}
                truncated={false}
                limit={2000}
                mouseEnabled={false}
                rows={24}
                columns={100}
                onQuit={() => undefined}
            />,
        );
        view.stdin.write('\u001B[B');
        await Bun.sleep(20);
        view.stdin.write('x');
        await Bun.sleep(20);
        let frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).not.toContain('ruido');
        expect(frame).toContain('util');
        expect(frame).toContain('hiding 1');

        view.stdin.write('u');
        await Bun.sleep(20);
        frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('ruido');
        expect(frame).toContain('enter restore');

        view.stdin.write('\r');
        await Bun.sleep(20);
        frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('ruido');
        expect(frame).not.toContain('hiding 1');
    });

    test('x typed into the slash filter does not hide', async () => {
        const hits = [createViewerHit('1', 'pod-a', 'app', '{"msg":"extra"}')];
        const view = render(
            <ViewerApp
                command="tail"
                hits={hits}
                truncated={false}
                limit={2000}
                mouseEnabled={false}
                rows={24}
                columns={100}
                onQuit={() => undefined}
            />,
        );
        view.stdin.write('/');
        await Bun.sleep(20);
        view.stdin.write('x');
        await Bun.sleep(20);
        const frame = stripAnsi(view.lastFrame() ?? '');
        expect(frame).toContain('filter: x');
        expect(frame).toContain('extra');
        expect(frame).not.toContain('hiding 1');
    });
});
