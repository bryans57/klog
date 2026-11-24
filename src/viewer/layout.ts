export function formatGroupRow(input: {
    collapsed: boolean;
    pod: string;
    count: number;
    span: string;
    width: number;
}): string {
    const glyph = input.collapsed ? '▸' : '▾';
    const hits = `${input.count} ${input.count === 1 ? 'hit' : 'hits'}`;
    const left = `${glyph} ${input.pod} · ${hits}`;
    if (!input.span) return truncate(left, input.width);
    const right = ` ${input.span}`;
    return `${truncate(left, Math.max(1, input.width - right.length))}${right}`;
}

export function truncate(text: string, width: number): string {
    const max = Math.max(1, Math.floor(width));
    const flat = text.replace(/[\u0000-\u001f\u007f]+/g, ' ').trimEnd();
    if (flat.length <= max) return flat;
    return `${flat.slice(0, max - 1)}…`;
}

export function wrapValue(text: string, width: number, maxLines: number): string[] {
    const size = Math.max(1, Math.floor(width));
    const lines = Math.max(1, Math.floor(maxLines));
    const flat = truncate(text, size * lines);
    const chunks: string[] = [];
    for (let index = 0; index < flat.length; index += size) chunks.push(flat.slice(index, index + size));
    return chunks.slice(0, lines);
}

export function clampViewport(size: { rows?: number; columns?: number }): {
    rows: number;
    columns: number;
} {
    return {
        rows: Math.max(8, Math.floor(size.rows ?? 0) || 24),
        columns: Math.max(40, Math.floor(size.columns ?? 0) || 80),
    };
}

export function fitRows(rows: number, reserved: number): number {
    return Math.max(1, Math.floor(rows) - reserved);
}

export function clampScroll(input: { scroll: number; selectedIndex: number; listRows: number; total: number }): number {
    const maxScroll = Math.max(0, input.total - input.listRows);
    let scroll = Math.min(Math.max(0, input.scroll), maxScroll);
    if (input.selectedIndex < 0) return scroll;
    if (input.selectedIndex < scroll) scroll = input.selectedIndex;
    else if (input.selectedIndex >= scroll + input.listRows) {
        scroll = input.selectedIndex - input.listRows + 1;
    }
    return Math.min(Math.max(0, scroll), maxScroll);
}
