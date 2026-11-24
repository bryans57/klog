import { createMatchRegex, type MatcherOptions } from '../search/engine';

export type HighlightSpan = {
    text: string;
    match: boolean;
};

export function matchSpans(text: string, query: string, options: MatcherOptions): HighlightSpan[] {
    if (!query) return [{ text, match: false }];

    let regex: RegExp;
    try {
        regex = createMatchRegex(query, options, true);
    } catch {
        return [{ text, match: false }];
    }

    const spans: HighlightSpan[] = [];
    let cursor = 0;
    for (const match of text.matchAll(regex)) {
        if (!match[0]) continue;
        const index = match.index;
        if (index > cursor) spans.push({ text: text.slice(cursor, index), match: false });
        spans.push({ text: match[0], match: true });
        cursor = index + match[0].length;
    }
    if (cursor < text.length) spans.push({ text: text.slice(cursor), match: false });
    return spans.length ? spans : [{ text, match: false }];
}
