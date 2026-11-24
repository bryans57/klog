const MOUSE_REPORT = /\u001b?\[?<\d+;\d+;\d+[Mm]/;

export function isMouseReport(input: string): boolean {
    return MOUSE_REPORT.test(input);
}

export function sanitizeTypedText(input: string): string {
    return input.replace(new RegExp(MOUSE_REPORT.source, 'g'), '').replace(/[\u0000-\u001f\u007f]/g, '');
}

export function isRowClick(top: number | undefined, y: number): boolean {
    return top !== undefined && top === y;
}
