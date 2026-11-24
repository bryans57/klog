import { describe, expect, test } from 'bun:test';
import { shouldUseViewer } from '../src/viewer/surface';

describe('shouldUseViewer', () => {
    test.each(['search', 'tail'] as const)('enables the viewer for %s in a usable TTY', (command) => {
        expect(shouldUseViewer({ command, isTTY: true, outputExplicit: false, term: 'xterm-256color' })).toBe(true);
    });

    test.each([
        { command: 'search' as const, isTTY: false, outputExplicit: false, term: 'xterm' },
        { command: 'search' as const, isTTY: true, outputExplicit: true, term: 'xterm' },
        { command: 'search' as const, isTTY: true, outputExplicit: false, term: 'dumb' },
        { command: 'search' as const, isTTY: true, outputExplicit: false, term: undefined },
        { command: 'use' as const, isTTY: true, outputExplicit: false, term: 'xterm' },
    ])('disables the viewer for $command/$isTTY/$outputExplicit/$term', (input) => {
        expect(shouldUseViewer(input)).toBe(false);
    });
});
