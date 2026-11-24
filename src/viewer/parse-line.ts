import { formatAbbrevDuration, formatBogotaStamp } from './clock';

export type ParsedLogLine = {
    raw: string;
    time: string;
    instant: number | null;
    duration: string;
    level: string;
    message: string;
    method: string;
    url: string;
    status: string;
    fields: Record<string, unknown>;
};

const TIME_KEYS = ['ts', 'time', 'timestamp', '@timestamp'];
const LEVEL_KEYS = ['level', 'severity'];
const MESSAGE_KEYS = ['msg', 'message'];
const METHOD_KEYS = ['method'];
const URL_KEYS = ['url', 'path', 'uri'];
const STATUS_KEYS = ['status', 'statusCode', 'status_code'];
const DURATION_KEYS = ['responseTimeMs', 'responseTime', 'durationMs', 'duration', 'elapsedMs', 'elapsed'];
const PREFIX = /^(\d{4}-\d{2}-\d{2}T[0-9:.+-]+Z?)\s+(.*)$/;
const GENERIC_MSG = /^(request completed|http_request_ok|ok|success)$/i;

export function parseLogLine(raw: string): ParsedLogLine {
    const prefixed = PREFIX.exec(raw);
    const prefixTime = prefixed?.[1];
    const body = prefixed?.[2] ?? raw;

    let value: unknown;
    try {
        value = JSON.parse(body);
    } catch {
        return fallback(raw, prefixTime);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback(raw, prefixTime);

    const fields = { ...(value as Record<string, unknown>) };
    const timeValue = pickTime(fields, prefixTime);
    const levelValue = take(fields, LEVEL_KEYS);
    const messageValue = take(fields, MESSAGE_KEYS);
    const method = stringifyField(take(fields, METHOD_KEYS));
    const url = stringifyField(take(fields, URL_KEYS));
    const status = stringifyField(take(fields, STATUS_KEYS)) || nestedStatus(fields);
    const duration = readDuration(fields);
    const instant = instantFrom(timeValue);
    const message = stripLeadingStamps(
        buildRowMessage(messageValue, method, url, status, fields) ||
            (typeof body === 'string' && body !== raw ? body : raw),
    );

    return {
        raw,
        time: formatClock(timeValue),
        instant,
        duration,
        level: typeof levelValue === 'string' ? levelValue.toUpperCase() : '',
        message,
        method,
        url,
        status,
        fields,
    };
}

export function httpSummary(method: string, url: string, status: string): string {
    return [status, method, shortUrl(url)].filter(Boolean).join('  ');
}

function buildRowMessage(
    messageValue: unknown,
    method: string,
    url: string,
    status: string,
    fields: Record<string, unknown>,
): string {
    const error = nestedError(fields);
    const generic = typeof messageValue === 'string' && GENERIC_MSG.test(messageValue.trim());
    if (error) return [status, method, error].filter(Boolean).join('  ');
    if (typeof messageValue === 'string' && !generic) return messageValue;
    return httpSummary(method, url, status) || (typeof messageValue === 'string' ? messageValue : '');
}

function shortUrl(url: string): string {
    if (!url) return '';
    const parts = url.split('/').filter(Boolean);
    if (parts.length <= 3) return url;
    return parts.slice(-2).join('/');
}

function nestedStatus(fields: Record<string, unknown>): string {
    const response = asRecord(fields.response);
    if (!response) return '';
    return stringifyField(response.statusCode ?? response.status);
}

function nestedError(fields: Record<string, unknown>): string {
    const response = fields.response;
    if (typeof response === 'string')
        return messageFromUnknown(tryJson(response)) || stringifyField(fields.error_message);
    const record = asRecord(response);
    if (record) {
        if (typeof record.message === 'string' && record.message) return record.message;
        const fromPayload = messageFromUnknown(record.payload) || messageFromUnknown(tryJson(record.payload));
        if (fromPayload) return fromPayload;
    }
    return stringifyField(fields.error_message);
}

function readDuration(fields: Record<string, unknown>): string {
    const top = take(fields, DURATION_KEYS);
    const nested = asRecord(fields.response);
    const value = top ?? (nested ? take(nested, DURATION_KEYS) : undefined);
    if (typeof value === 'number') return formatAbbrevDuration(value);
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value)))
        return formatAbbrevDuration(Number(value));
    return '';
}

function messageFromUnknown(value: unknown): string {
    if (typeof value === 'string') {
        const parsed = tryJson(value);
        if (parsed !== value) return messageFromUnknown(parsed);
        return '';
    }
    const record = asRecord(value);
    return typeof record?.message === 'string' ? record.message : '';
}

function tryJson(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return value as Record<string, unknown>;
}

function stringifyField(value: unknown): string {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return '';
}

function pickTime(fields: Record<string, unknown>, prefixTime?: string): unknown {
    for (const key of TIME_KEYS) {
        if (!(key in fields)) continue;
        const value = fields[key];
        delete fields[key];
        if (instantFrom(value) != null) return value;
    }
    return prefixTime;
}

function take(fields: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
        if (key in fields) {
            const value = fields[key];
            delete fields[key];
            return value;
        }
    }
}

function instantFrom(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value < 1e12 ? value * 1000 : value;
    }
    if (typeof value !== 'string') return null;
    const date = new Date(normalizeIso(value));
    return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function normalizeIso(value: string): string {
    const gmt = /GMT([+-])(\d{1,2})$/.exec(value);
    if (gmt) return `${value.slice(0, -gmt[0].length)}${gmt[1]}${gmt[2].padStart(2, '0')}:00`;
    if (value.endsWith('COT')) return `${value.slice(0, -3)}-05:00`;
    return value;
}

function formatClock(value: unknown): string {
    const ms = instantFrom(value);
    return ms == null ? '' : formatBogotaStamp(ms);
}

function stripLeadingStamps(text: string): string {
    let rest = text;
    while (true) {
        const match = PREFIX.exec(rest);
        if (!match) return rest;
        rest = match[2];
    }
}

function fallback(raw: string, prefixTime?: string): ParsedLogLine {
    const stamped = PREFIX.exec(raw);
    return {
        raw,
        time: formatClock(prefixTime ?? stamped?.[1]),
        instant: instantFrom(prefixTime ?? stamped?.[1]),
        duration: '',
        level: '',
        message: stripLeadingStamps(raw),
        method: '',
        url: '',
        status: '',
        fields: {},
    };
}
