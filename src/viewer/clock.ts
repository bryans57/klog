const TZ = 'America/Bogota';

export function formatBogotaTime(ms: number): string {
    return format(ms, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatBogotaHm(ms: number): string {
    return format(ms, { hour: '2-digit', minute: '2-digit' });
}

export function formatBogotaStamp(ms: number): string {
    const { ymd } = bogotaDateParts(ms);
    const [, month, day] = ymd.split('-');
    return `${month}-${day} ${formatBogotaTime(ms)}`;
}

export function formatAbbrevDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return '';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60_000) {
        const seconds = ms / 1000;
        if (seconds < 10 && seconds % 1 !== 0) return `${seconds.toFixed(1)}s`;
        return `${Math.round(seconds)}s`;
    }
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
    return `${Math.round(ms / 3_600_000)}h`;
}

export function bogotaDateParts(ms: number): { ymd: string; day: string } {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date(ms));
    const year = value(parts, 'year');
    const month = value(parts, 'month');
    const day = value(parts, 'day');
    return { ymd: `${year}-${month}-${day}`, day: String(Number(day)) };
}

function format(ms: number, extra: Intl.DateTimeFormatOptions): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ,
        hourCycle: 'h23',
        ...extra,
    }).formatToParts(new Date(ms));
    const hour = value(parts, 'hour').padStart(2, '0');
    const minute = value(parts, 'minute').padStart(2, '0');
    if (!extra.second) return `${hour}:${minute}`;
    const second = value(parts, 'second').padStart(2, '0');
    return `${hour}:${minute}:${second}`;
}

function value(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
    return parts.find((part) => part.type === type)?.value ?? '';
}
