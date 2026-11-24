export type CommandName = 'search' | 'tail' | 'pods' | 'apps' | 'contexts' | 'use' | 'help' | 'version';

export type Flags = {
    namespace?: string;
    selector?: string;
    deployment?: string;
    pod?: string;
    container?: string;
    allContainers: boolean;
    since?: string;
    until?: string;
    tail?: number;
    previous: boolean;
    current: boolean;
    both: boolean;
    concurrency: number;
    kubeContext?: string;
    ignoreCase: boolean;
    regex: boolean;
    word: boolean;
    around: number;
    before?: number;
    after?: number;
    output: 'pretty' | 'plain' | 'json';
    outputExplicit?: boolean;
    outputFile?: string;
    viewerLimit?: number;
    verbose: boolean;
    followPods: boolean;
    timestamps?: boolean;
    query?: string;
    status?: string;
    level?: string;
    app?: string;
};

export type ParsedArgv = {
    command: CommandName;
    query?: string;
    flags: Flags;
};

const BOOLEAN = new Set([
    'all-containers',
    'previous',
    'current',
    'both',
    'regex',
    'word',
    'verbose',
    'follow-pods',
    'ignore-case',
    'help',
    'version',
    'timestamps',
]);

const ALIASES: Record<string, string> = {
    n: 'namespace',
    l: 'selector',
    i: 'ignore-case',
    w: 'word',
    C: 'around',
    h: 'help',
    V: 'version',
    f: 'follow-pods',
};

export function parseArgv(argv: string[]): ParsedArgv {
    const flags: Flags = {
        allContainers: false,
        previous: false,
        current: false,
        both: false,
        concurrency: 10,
        ignoreCase: true,
        regex: false,
        word: false,
        around: 0,
        output: 'pretty',
        outputExplicit: false,
        verbose: false,
        followPods: false,
    };
    const positional: string[] = [];
    let i = 0;
    while (i < argv.length) {
        const a = argv[i];
        if (a === '--') {
            positional.push(...argv.slice(i + 1));
            break;
        }
        if (a === '--no-ignore-case') {
            flags.ignoreCase = false;
            i++;
            continue;
        }
        if (a.startsWith('--')) {
            const [raw, inline] = splitEq(a.slice(2));
            i = assign(flags, raw, inline, argv, i);
            continue;
        }
        if (a.startsWith('-') && a.length > 1) {
            const name = ALIASES[a.slice(1)] ?? a.slice(1);
            const long = name.length > 1 && !ALIASES[a.slice(1)] ? a.slice(1) : name;
            i = assign(flags, long, undefined, argv, i);
            continue;
        }
        positional.push(a);
        i++;
    }

    if (flags.both) {
        flags.previous = true;
        flags.current = true;
    } else if (flags.previous && !flags.current) {
        flags.current = false;
    } else if (!flags.previous) {
        flags.current = true;
    }

    let command: CommandName = 'help';
    let query: string | undefined;
    const cmd = positional[0];
    if (!cmd || cmd === 'help' || (flags as Flags & { help?: boolean }).help) {
        if ((argv.includes('--version') || argv.includes('-V')) && !cmd) command = 'version';
        else command = cmd === 'help' || !cmd ? 'help' : (cmd as CommandName);
    }
    if (argv.includes('--version') || argv.includes('-V')) {
        if (!positional.length) return { command: 'version', flags };
    }
    if (cmd === 'search' || cmd === 'tail' || cmd === 'pods' || cmd === 'apps' || cmd === 'contexts' || cmd === 'use') {
        command = cmd;
        const rest = positional.slice(1);
        query = rest[0];
    } else if (cmd && cmd !== 'help' && cmd !== 'version' && !(flags as Flags & { help?: boolean }).help) {
        throw new Error(`Unknown command "${cmd}"`);
    }

    return { command, query, flags };
}

function splitEq(s: string): [string, string | undefined] {
    const n = s.indexOf('=');
    if (n === -1) return [s, undefined];
    return [s.slice(0, n), s.slice(n + 1)];
}

function assign(flags: Flags, raw: string, inline: string | undefined, argv: string[], i: number): number {
    const key = camel(raw);
    if (raw === 'help') return i + 1;
    if (raw === 'version') return i + 1;
    if (BOOLEAN.has(raw) || raw === 'ignore-case') {
        (flags as unknown as Record<string, boolean>)[key] = true;
        return i + 1;
    }
    const value = inline ?? argv[i + 1];
    if (value === undefined || value.startsWith('-')) {
        throw new Error(`Missing value for --${raw}`);
    }
    if (raw === 'context') {
        if (/^\d+$/.test(value)) flags.around = Number(value);
        else flags.kubeContext = value;
        return inline ? i + 1 : i + 2;
    }
    if (raw === 'around' || raw === 'context-lines') {
        flags.around = Number(value);
        return inline ? i + 1 : i + 2;
    }
    if (raw === 'before') {
        flags.before = Number(value);
        return inline ? i + 1 : i + 2;
    }
    if (raw === 'after') {
        flags.after = Number(value);
        return inline ? i + 1 : i + 2;
    }
    if (raw === 'tail' || raw === 'concurrency' || raw === 'viewer-limit') {
        if (raw === 'viewer-limit') flags.viewerLimit = Number(value);
        else {
            (flags as unknown as Record<string, number>)[key] = Number(value);
        }
        return inline ? i + 1 : i + 2;
    }
    if (raw === 'output') {
        if (value !== 'pretty' && value !== 'plain' && value !== 'json') {
            throw new Error('output must be pretty, plain, or json');
        }
        flags.output = value;
        flags.outputExplicit = true;
        return inline ? i + 1 : i + 2;
    }
    if (raw === 'output-file') {
        flags.outputFile = value;
        return inline ? i + 1 : i + 2;
    }
    if (raw === 'kube-context') {
        flags.kubeContext = value;
        return inline ? i + 1 : i + 2;
    }
    const map: Record<string, keyof Flags> = {
        namespace: 'namespace',
        selector: 'selector',
        deployment: 'deployment',
        pod: 'pod',
        container: 'container',
        since: 'since',
        until: 'until',
        status: 'status',
        level: 'level',
        app: 'app',
    };
    const field = map[raw];
    if (!field) throw new Error(`Unknown flag --${raw}`);
    (flags as unknown as Record<string, string>)[field] = value;
    return inline ? i + 1 : i + 2;
}

function camel(s: string): string {
    return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
