const DURATION = /^(\d+)(s|m|h|d)$/i;

export function parseDuration(value: string): number {
    const m = DURATION.exec(value.trim());
    if (!m) {
        throw new Error(`Invalid duration "${value}". Use Ns, Nm, Nh, or Nd.`);
    }
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === 's') return n;
    if (unit === 'm') return n * 60;
    if (unit === 'h') return n * 3600;
    return n * 86400;
}

export function normalizeSince(value: string): string {
    const v = value.trim();
    if (/^\d+$/.test(v)) {
        throw new Error(`Invalid --since "${value}". A unit is required: 30s, 10m, 2h, 7d (e.g. 168h or 7d).`);
    }
    if (DURATION.test(v)) {
        parseDuration(v);
        return v;
    }
    const short = expandTimeShorthand(v);
    if (short) return short;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
        throw new Error(`Invalid --since "${value}". Use 30s, 10m, 2h, 7d, ayer17:00, or an RFC3339 timestamp.`);
    }
    return v;
}

// Go's time.ParseDuration (used by kubectl) has no "d" unit, so days go as seconds.
export function toKubectlSinceArg(value: string): string {
    const v = normalizeSince(value);
    if (!DURATION.test(v)) return `--since-time=${v}`;
    if (/d$/i.test(v)) return `--since=${parseDuration(v)}s`;
    return `--since=${v}`;
}

export function parseTimeBound(value: string, now = new Date()): Date {
    if (DURATION.test(value.trim())) {
        return new Date(now.getTime() - parseDuration(value) * 1000);
    }
    const short = expandTimeShorthand(value, now);
    if (short) return new Date(short);
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
        throw new Error(`Invalid time "${value}". Use RFC3339, a duration like 2h, or ayer17:00.`);
    }
    return d;
}

const TS = /^(\d{4}-\d{2}-\d{2}T[0-9:.+-]+Z?)\s/;

const DAY_WORD = /^(hoy|today|ayer|yesterday)(?:[ T]?(\d{1,2}):(\d{2}))?$/i;

export function expandTimeShorthand(value: string, now = new Date()): string | undefined {
    const v = value.trim();
    const today = bogotaYmd(now.getTime());
    const word = DAY_WORD.exec(v);
    if (word) {
        const ymd = /ayer|yesterday/i.test(word[1]) ? shiftBogotaDay(today, -1) : today;
        return `${ymd}T${word[2] ? clock(word[2], word[3]) : '00:00:00-05:00'}`;
    }
    const hm = /^(\d{1,2}):(\d{2})$/.exec(v);
    if (hm) return `${today}T${clock(hm[1], hm[2])}`;
    const full = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(v);
    if (full) return `${full[1]}T${full[2] ? clock(full[2], full[3]) : '00:00:00-05:00'}`;
    const monthDay = /^(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(v);
    if (monthDay) {
        const year = today.slice(0, 4);
        const hmPart = monthDay[3] ? clock(monthDay[3], monthDay[4]) : '00:00:00-05:00';
        return `${year}-${monthDay[1]}-${monthDay[2]}T${hmPart}`;
    }
    return undefined;
}

function bogotaYmd(ms: number): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(ms));
}

function shiftBogotaDay(ymd: string, days: number): string {
    return bogotaYmd(new Date(`${ymd}T12:00:00-05:00`).getTime() + days * 86_400_000);
}

function clock(hour: string, minute: string): string {
    const hh = Number(hour);
    const mm = Number(minute);
    if (hh > 23 || mm > 59) {
        throw new Error(`Invalid time ${hour}:${minute}. Use 00:00–23:59.`);
    }
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00-05:00`;
}

export function parseLogTimestamp(line: string): Date | null {
    const m = TS.exec(line);
    if (!m) return null;
    const d = new Date(m[1]);
    return Number.isNaN(d.getTime()) ? null : d;
}
