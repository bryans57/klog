export type NamedContext = { name: string; current: boolean };

export type ContextPick =
    | { ok: true; name: string }
    | { ok: false; message: string; matches: NamedContext[] };

export function formatContextList(list: NamedContext[]): string {
    return list
        .map((c, i) => {
            const mark = c.current ? '*' : ' ';
            return `${mark} ${i + 1}  ${c.name}`;
        })
        .join('\n');
}

export function resolveContextPick(list: NamedContext[], query: string): ContextPick {
    const q = query.trim();
    if (!q) {
        return { ok: false, message: formatUseHelp(list), matches: list };
    }

    if (/^\d+$/.test(q)) {
        const idx = Number(q) - 1;
        const hit = list[idx];
        if (!hit) {
            return {
                ok: false,
                message: `No context #${q}. Valid range: 1–${list.length}.\n${formatContextList(list)}`,
                matches: [],
            };
        }
        return { ok: true, name: hit.name };
    }

    const exact = list.find((c) => c.name === q);
    if (exact) return { ok: true, name: exact.name };

    const needle = q.toLowerCase();
    const matches = list.filter((c) => c.name.toLowerCase().includes(needle));
    if (matches.length === 1) return { ok: true, name: matches[0].name };
    if (matches.length === 0) {
        return {
            ok: false,
            message: `No context matches "${q}".\n${formatContextList(list)}`,
            matches: [],
        };
    }

    const numbered = matches
        .map((c) => {
            const n = list.indexOf(c) + 1;
            const mark = c.current ? '*' : ' ';
            return `${mark} ${n}  ${c.name}`;
        })
        .join('\n');
    const first = list.indexOf(matches[0]) + 1;
    return {
        ok: false,
        message: `"${q}" matches ${matches.length} contexts. Be more specific or pick a number:\n${numbered}\n\nklog use ${first}`,
        matches,
    };
}

function formatUseHelp(list: NamedContext[]): string {
    return [
        'Current kubectl context (klog uses this by default):',
        formatContextList(list),
        '',
        'Examples:',
        '  klog use 4',
        '  klog use apis-02',
        '  klog use test          # if more than one, lists them',
    ].join('\n');
}
