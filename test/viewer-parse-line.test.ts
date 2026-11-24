import { describe, expect, test } from 'bun:test';
import { parseLogLine } from '../src/viewer/parse-line';

describe('parseLogLine', () => {
    test('extracts summary fields and preserves remaining fields', () => {
        const parsed = parseLogLine(
            '{"level":"error","ts":"2026-09-11T18:02:11Z","msg":"proceso failed","id_ejemplo":123456,"trace":"a1b2"}',
        );

        expect(parsed.time).toBe('09-11 13:02:11');
        expect(parsed.level).toBe('ERROR');
        expect(parsed.message).toBe('proceso failed');
        expect(parsed.fields).toEqual({ id_ejemplo: 123456, trace: 'a1b2' });
    });

    test('reads the pino-style timestamp key used by the services', () => {
        const parsed = parseLogLine(
            '{"level":"info","timestamp":"2026-09-11T19:35:42.055-05:00","msg":"Redis: listo"}',
        );

        expect(parsed.time).toBe('09-11 19:35:42');
        expect(parsed.fields).toEqual({});
    });

    test.each(['plain text', '{"broken"', '["an","array"]'])('falls back to raw text for %s', (raw) => {
        expect(parseLogLine(raw)).toEqual({
            raw,
            time: '',
            level: '',
            message: raw,
            method: '',
            url: '',
            status: '',
            instant: null,
            duration: '',
            fields: {},
        });
    });

    test('synthesizes an HTTP summary when the line has no msg', () => {
        const parsed = parseLogLine(
            '{"application":"app-consulta-ms","method":"GET","url":"/sigo-ejemplos/app-consulta-ms/ejemplos/repartidores/consultar-repartidor/48151","status":400,"request":{"headers":{}}}',
        );
        expect(parsed.message).toContain('GET');
        expect(parsed.message).toContain('consultar-repartidor/48151');
        expect(parsed.message).toContain('400');
        expect(parsed.method).toBe('GET');
        expect(parsed.url).toContain('consultar-repartidor/48151');
        expect(parsed.status).toBe('400');
        expect(parsed.message).not.toContain('"application"');
    });

    test('uses path if url is absent and keeps a pino msg when present', () => {
        const http = parseLogLine('{"method":"POST","path":"/adjuntos/pdf/1"}');
        expect(http.message).toBe('POST  /adjuntos/pdf/1');
        const pino = parseLogLine('{"method":"GET","url":"/x","msg":"http_request_ok","status":200}');
        expect(pino.message).toContain('200');
        expect(pino.message).toContain('GET');
        expect(pino.message).not.toBe('http_request_ok');
        expect(pino.status).toBe('200');
    });

    test('converts a kubectl UTC prefix to Bogota time', () => {
        const parsed = parseLogLine(
            '2026-09-23T00:31:05.371Z {"msg":"Request completed","method":"POST","url":"/reintentos/preproceso/entrega"}',
        );
        expect(parsed.time).toBe('09-22 19:31:05');
    });

    test('uses nested response statusCode and payload message instead of Request completed', () => {
        const parsed = parseLogLine(
            JSON.stringify({
                msg: 'Request completed',
                method: 'POST',
                url: '/sigo-ejemplos/app-errores-ms/reintentos/preproceso/entrega',
                response: {
                    statusCode: 500,
                    payload: '{"isError":true,"message":"Query read timeout","code":"UNKNOWN_ERROR","statusCode":500}',
                },
            }),
        );
        expect(parsed.status).toBe('500');
        expect(parsed.message).toContain('500');
        expect(parsed.message).toContain('POST');
        expect(parsed.message).toContain('Query read timeout');
        expect(parsed.message).not.toContain('Request completed');
    });

    test('reads a kubectl --timestamps prefix as the instant', () => {
        const parsed = parseLogLine('2026-09-16T08:54:18.707-05:00 {"method":"GET","url":"/ejemplos/repartidores/1"}');
        expect(parsed.time).toBe('09-16 08:54:18');
        expect(parsed.instant).toBe(new Date('2026-09-16T08:54:18.707-05:00').getTime());
        expect(parsed.message).toBe('GET  /ejemplos/repartidores/1');
    });

    test('reads a numeric pino time and an HTTP duration when present', () => {
        const ms = new Date('2026-09-11T18:02:11Z').getTime();
        const parsed = parseLogLine(JSON.stringify({ time: ms, msg: 'ok', responseTimeMs: 3 }));
        expect(parsed.time).toBe('09-11 13:02:11');
        expect(parsed.instant).toBe(ms);
        expect(parsed.duration).toBe('3ms');
    });

    test('does not let an unparseable pino GMT-5 timestamp hide the kubectl clock', () => {
        const parsed = parseLogLine(
            '2026-09-25T16:00:24.204120701Z {"level":"INFO","timestamp":"2026-09-25T11:00:24GMT-5","msg":"Guía REST unificada (federada + SIFA)"}',
        );
        expect(parsed.time).toBe('09-25 11:00:24');
        expect(parsed.level).toBe('INFO');
        expect(parsed.message).toBe('Guía REST unificada (federada + SIFA)');
    });

    test('parses AuthTokenManager plaintext and keeps the ISO off the message', () => {
        const parsed = parseLogLine(
            '2026-09-25T16:00:24.204120701Z 2026-09-25T16:00:24.204120701Z [AuthTokenManager] Token obtenido desde Redis (cache)',
        );
        expect(parsed.time).toBe('09-25 11:00:24');
        expect(parsed.message).toBe('[AuthTokenManager] Token obtenido desde Redis (cache)');
    });
});
