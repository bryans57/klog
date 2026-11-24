export type AppPick = { ok: true; name: string } | { ok: false; message: string };

export function formatAppList(names: string[]): string {
    if (!names.length) return '(no apps with label app=…)';
    return names.map((name, index) => `  ${index + 1}  ${name}`).join('\n');
}

export function resolveAppPick(names: string[], query: string): AppPick {
    const q = query.trim();
    if (!q) {
        return { ok: false, message: formatAppList(names) };
    }
    if (/^\d+$/.test(q)) {
        const hit = names[Number(q) - 1];
        if (!hit) {
            return { ok: false, message: `No app #${q}. Valid range: 1–${names.length}.\n${formatAppList(names)}` };
        }
        return { ok: true, name: hit };
    }
    const exact = names.find((name) => name === q);
    if (exact) return { ok: true, name: exact };
    const needle = q.toLowerCase();
    const matches = names.filter((name) => name.toLowerCase().includes(needle));
    if (matches.length === 1) return { ok: true, name: matches[0] };
    if (matches.length === 0) {
        return { ok: false, message: `No app matches "${q}".\n${formatAppList(names)}` };
    }
    const numbered = matches
        .map((name) => {
            const n = names.indexOf(name) + 1;
            return `  ${n}  ${name}`;
        })
        .join('\n');
    return {
        ok: false,
        message: `"${q}" matches ${matches.length} apps. Pick a number:\n${numbered}`,
    };
}
