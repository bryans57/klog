const ENTER_SCREEN = '\u001b[?1049h\u001b[?25l';
const LEAVE_SCREEN = '\u001b[?25h\u001b[?1049l';

export function createScreenLifecycle(write: (text: string) => void) {
    let active = false;
    return {
        enter() {
            if (active) return;
            active = true;
            write(ENTER_SCREEN);
        },
        restore() {
            if (!active) return;
            active = false;
            write(LEAVE_SCREEN);
        },
    };
}
