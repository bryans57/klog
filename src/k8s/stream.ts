export async function* readLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx = buf.indexOf('\n');
            while (idx !== -1) {
                yield buf.slice(0, idx);
                buf = buf.slice(idx + 1);
                idx = buf.indexOf('\n');
            }
        }
        if (buf.length) yield buf;
    } finally {
        reader.releaseLock();
    }
}

export function parseKubectlPrefix(line: string): { pod?: string; container?: string; line: string } {
    const bracket = /^\[([^/]+)\/([^\]]+)\]\s?(.*)$/.exec(line);
    if (bracket) return { pod: bracket[1], container: bracket[2], line: bracket[3] };
    const colon = /^([a-z0-9][a-z0-9.-]*)\/([a-z0-9][a-z0-9._-]*):\s?(.*)$/i.exec(line);
    if (colon) return { pod: colon[1], container: colon[2], line: colon[3] };
    return { line };
}
