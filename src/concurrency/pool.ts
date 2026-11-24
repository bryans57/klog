export type Settled<T> = PromiseSettledResult<T>;

export async function runPool<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, signal: AbortSignal) => Promise<R>,
    signal: AbortSignal,
): Promise<Settled<R>[]> {
    const results: Settled<R>[] = new Array(items.length);
    let next = 0;
    const limit = Math.max(1, Math.min(concurrency, Math.max(items.length, 1)));

    async function runWorker() {
        while (next < items.length) {
            if (signal.aborted) break;
            const i = next++;
            try {
                const value = await worker(items[i], signal);
                results[i] = { status: 'fulfilled', value };
            } catch (reason) {
                results[i] = { status: 'rejected', reason };
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
    for (let i = 0; i < items.length; i++) {
        if (!results[i]) {
            results[i] = { status: 'rejected', reason: signal.reason ?? new Error('aborted') };
        }
    }
    return results;
}
