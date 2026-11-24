export function createRedrawScheduler(draw: () => void, waitMs = 33) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false;
    const fire = () => {
        timer = undefined;
        if (!pending) return;
        pending = false;
        draw();
    };
    return {
        request() {
            pending = true;
            if (timer !== undefined) return;
            timer = setTimeout(fire, waitMs);
        },
        flush() {
            if (timer !== undefined) clearTimeout(timer);
            timer = undefined;
            if (!pending) return;
            pending = false;
            draw();
        },
        stop() {
            if (timer !== undefined) clearTimeout(timer);
            timer = undefined;
            pending = false;
        },
    };
}
