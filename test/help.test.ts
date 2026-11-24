import { describe, expect, test } from 'bun:test';
import { parseArgv } from '../src/cli/parse';
import { HELP } from '../src/cli/help';
import { VERSION } from '../src/version';

describe('help and version text', () => {
    test('help documents search tail previous regex', () => {
        expect(HELP).toContain('klog search');
        expect(HELP).toContain('klog tail');
        expect(HELP).toContain('--previous');
        expect(HELP).toContain('--regex');
        expect(HELP).toContain('-w, --word');
        expect(HELP).toContain('-n, --namespace');
        expect(HELP).toContain('--follow-pods');
        expect(HELP).toContain('--viewer-limit');
        expect(HELP).toContain('keyboard and mouse');
        expect(HELP).toContain('klog use');
        expect(HELP).toContain('--until');
        expect(HELP).toContain('-05:00');
        expect(HELP).toContain('10 unless --since');
    });

    test('version command parses', () => {
        expect(parseArgv(['--version']).command).toBe('version');
        expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
});
