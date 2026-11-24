import { describe, expect, test } from 'bun:test';
import { createScreenLifecycle } from '../src/viewer/screen';

describe('screen lifecycle', () => {
    test('enters alternate screen and restores exactly once', () => {
        const writes: string[] = [];
        const screen = createScreenLifecycle((text) => writes.push(text));

        screen.enter();
        screen.restore();
        screen.restore();

        expect(writes).toEqual(['\u001b[?1049h\u001b[?25l', '\u001b[?25h\u001b[?1049l']);
    });
});
