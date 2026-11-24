import { describe, expect, test } from 'bun:test';
import { classifyLogError } from '../src/k8s/classify';
import { parseKubectlPrefix } from '../src/k8s/stream';
import { parsePodList, appLabels } from '../src/k8s/kubectl';
import { resolveAppPick } from '../src/k8s/app-pick';
import { parseSimpleYaml } from '../src/config';
import { pickContainers } from '../src/k8s/types';

describe('classifyLogError', () => {
    test('previous missing', () => {
        expect(classifyLogError('previous terminated container "app" not found', true)).toBe('no_previous');
    });

    test('pod gone', () => {
        expect(classifyLogError('pods "x" not found', false)).toBe('unavailable');
    });
});

describe('parseKubectlPrefix', () => {
    test('bracket prefix', () => {
        expect(parseKubectlPrefix('[pod-a/application] hello')).toEqual({
            pod: 'pod-a',
            container: 'application',
            line: 'hello',
        });
    });

    test('colon prefix from kubectl --prefix', () => {
        expect(parseKubectlPrefix('app-adjuntos-ms-abc/app-adjuntos-ms: hello')).toEqual({
            pod: 'app-adjuntos-ms-abc',
            container: 'app-adjuntos-ms',
            line: 'hello',
        });
    });

    test('does not strip pino JSON whose path contains slashes', () => {
        const line =
            '{"path":"/sigo-ejemplos/app-adjuntos-ms/adjuntos/pdf/26152","status":200,"msg":"http_request_ok"}';
        expect(parseKubectlPrefix(line)).toEqual({ line });
    });
});

describe('parsePodList', () => {
    test('reads names and containers', () => {
        const pods = parsePodList({
            items: [
                { metadata: { name: 'p1' }, spec: { containers: [{ name: 'application' }, { name: 'istio-proxy' }] } },
            ],
        });
        expect(pods[0]).toEqual({ name: 'p1', containers: ['application', 'istio-proxy'] });
        expect(pickContainers(pods[0], false)).toEqual(['application']);
    });
});

describe('app labels', () => {
    test('lists unique app labels in order and picks by number or fragment', () => {
        const names = appLabels({
            items: [
                { metadata: { labels: { app: 'app-proceso-ms' } } },
                { metadata: { labels: { app: 'app-errores-ms' } } },
                { metadata: { labels: { app: 'app-proceso-ms' } } },
            ],
        });
        expect(names).toEqual(['app-errores-ms', 'app-proceso-ms']);
        expect(resolveAppPick(names, '2')).toEqual({ ok: true, name: 'app-proceso-ms' });
        expect(resolveAppPick(names, 'proceso')).toEqual({ ok: true, name: 'app-proceso-ms' });
        expect(resolveAppPick(names, 'ejemplos').ok).toBe(false);
    });
});

describe('parseSimpleYaml', () => {
    test('reads config keys', () => {
        const c = parseSimpleYaml('defaultNamespace: ejemplos\nconcurrency: 8\n');
        expect(c.defaultNamespace).toBe('ejemplos');
        expect(c.concurrency).toBe(8);
    });
});
