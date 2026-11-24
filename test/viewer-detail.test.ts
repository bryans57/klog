import { describe, expect, test } from 'bun:test';
import { parseLogLine } from '../src/viewer/parse-line';
import { detailEntries } from '../src/viewer/detail';

describe('detailEntries', () => {
    test('puts HTTP status before request headers so a 400 is visible', () => {
        const parsed = parseLogLine(
            JSON.stringify({
                application: 'app-consulta-ms',
                method: 'GET',
                url: '/ejemplos/repartidores/consultar-repartidor/48151',
                status: 400,
                request: { headers: { authorization: 'Bearer x', host: 'apiv2.example' } },
                response: { error: 'bad request' },
            }),
        );
        const keys = detailEntries(parsed, false).map(([key]) => key);
        expect(keys).toContain('status');
        expect(keys).toContain('response');
        expect(keys).not.toContain('request');
        expect(keys.indexOf('status')).toBeLessThan(keys.indexOf('response'));
        expect(keys).not.toContain('message');
    });

    test('compact mode hides request; expanded mode keeps it', () => {
        const parsed = parseLogLine(
            JSON.stringify({
                method: 'GET',
                url: '/x',
                status: 200,
                request: { headers: { a: 1 } },
            }),
        );
        expect(detailEntries(parsed, false).map(([key]) => key)).not.toContain('request');
        expect(detailEntries(parsed, true).map(([key]) => key)).toContain('request');
    });
});
