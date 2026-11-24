import type { MatcherOptions } from '../search/engine';

export type ViewerQuery = MatcherOptions & {
    context: string;
    namespace: string;
    target: string;
    query: string;
    since?: string;
    until?: string;
};

export function formatQueryHeader(query: ViewerQuery): string[] {
    const scope = [
        query.context,
        `${query.namespace}/${query.target}`,
        query.since ? `since ${query.since}` : undefined,
        query.until ? `until ${query.until}` : undefined,
    ]
        .filter(Boolean)
        .join(' · ');
    if (!query.query) return [scope];

    const modes = [query.regex ? '--regex' : undefined, query.word ? '-w' : undefined].filter(Boolean);
    return [scope, [`query: "${query.query}"`, ...modes].join(' · ')];
}
