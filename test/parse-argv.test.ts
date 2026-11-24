import { describe, expect, test } from 'bun:test';
import { parseArgv } from '../src/cli/parse';

describe('parseArgv', () => {
    test('parses search with selector and since', () => {
        const r = parseArgv(['search', '123456', '-n', 'ejemplos', '-l', 'app=foo', '--since', '2h']);
        expect(r.command).toBe('search');
        expect(r.query).toBe('123456');
        expect(r.flags.namespace).toBe('ejemplos');
        expect(r.flags.selector).toBe('app=foo');
        expect(r.flags.since).toBe('2h');
    });

    test('parses --since=2h and --word', () => {
        const r = parseArgv(['search', '/ejemplo', '-n', 'ejemplos', '-l', 'app=foo', '--since=2h', '-w']);
        expect(r.flags.since).toBe('2h');
        expect(r.flags.word).toBe(true);
    });

    test('parses status and level and allows search without a text query', () => {
        const r = parseArgv(['search', '--status', '502', '--level', 'error', '-n', 'ejemplos']);
        expect(r.command).toBe('search');
        expect(r.query).toBeUndefined();
        expect(r.flags.status).toBe('502');
        expect(r.flags.level).toBe('error');
        expect(parseArgv(['search', '--app', '2', '-n', 'ejemplos']).flags.app).toBe('2');
    });

    test('parses kube context vs around lines', () => {
        const kube = parseArgv(['search', 'x', '--context', 'cluster-test']);
        expect(kube.flags.kubeContext).toBe('cluster-test');
        const around = parseArgv(['search', 'x', '-C', '3']);
        expect(around.flags.around).toBe(3);
        const contextNum = parseArgv(['search', 'x', '--context', '3']);
        expect(contextNum.flags.around).toBe(3);
        expect(contextNum.flags.kubeContext).toBeUndefined();
    });

    test('parses previous both regex json', () => {
        const r = parseArgv(['search', 'id=[0-9]+', '--regex', '--both', '--output', 'json', '--previous']);
        expect(r.flags.regex).toBe(true);
        expect(r.flags.both).toBe(true);
        expect(r.flags.output).toBe('json');
        expect(r.flags.outputExplicit).toBe(true);
    });

    test('parses viewer limit and keeps output implicit by default', () => {
        const r = parseArgv(['tail', '--viewer-limit', '250']);
        expect(r.flags.viewerLimit).toBe(250);
        expect(r.flags.outputExplicit).toBe(false);
    });

    test('keeps an empty query as a dump request', () => {
        const r = parseArgv(['search', '', '-n', 'ejemplos', '--pod', 'p1', '--previous']);
        expect(r.query).toBe('');
        expect(r.flags.previous).toBe(true);
    });

    test('parses use with a pick', () => {
        const r = parseArgv(['use', 'test']);
        expect(r.command).toBe('use');
        expect(r.query).toBe('test');
    });

    test('tail may omit query', () => {
        const r = parseArgv(['tail', '-n', 'ejemplos', '-l', 'app=foo']);
        expect(r.command).toBe('tail');
        expect(r.query).toBeUndefined();
    });

    test('accepts a single-dash -since the same as --since', () => {
        const r = parseArgv(['tail', '-n', 'ejemplos', '-l', 'app=foo', '-since', '2h']);
        expect(r.flags.since).toBe('2h');
    });

    test('rejects unknown commands', () => {
        expect(() => parseArgv(['nope'])).toThrow('Unknown command "nope"');
    });
});
