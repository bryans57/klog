import React, { useEffect, useReducer, useRef } from 'react';
import { Box, Text, useInput, type DOMElement } from 'ink';
import { MouseProvider, getElementPosition, useOnClick, useOnWheel } from '@ink-tools/ink-mouse';
import { isMouseReport, isRowClick, sanitizeTypedText } from './input';
import type { Truncation } from './buffer';
import { matchSpans } from './highlight';
import { clampScroll, clampViewport, fitRows, formatGroupRow, truncate, wrapValue } from './layout';
import { displayHits, groupHits, withoutHidden, type ViewerHit } from './model';
import { formatQueryHeader, type ViewerQuery } from './query';
import { detailEntries } from './detail';
import { formatPodSpan, type PodSpan } from './span';
import {
    createViewerState,
    reduceViewerState,
    selectionLabel,
    visibleItems,
    type ViewerAction,
    type ViewerSelection,
    type ViewerState,
} from './state';

export type ViewerAppProps = {
    command: 'search' | 'tail';
    hits: ViewerHit[];
    truncated: Truncation;
    limit: number;
    query?: ViewerQuery;
    mouseEnabled?: boolean;
    rows?: number;
    columns?: number;
    podSpans?: Record<string, PodSpan>;
    onQuit: (interrupted?: boolean) => void;
};

const DETAIL_FIELDS = 8;
const DETAIL_ROWS = 9;
const DETAIL_WRAP = 2;
const LABEL_WIDTH = 12;
const TIME_WIDTH = 14;
const DUR_WIDTH = 5;
const LEVEL_WIDTH = 5;

export function ViewerApp(props: ViewerAppProps) {
    return (
        <MouseProvider autoEnable={props.mouseEnabled ?? true}>
            <ViewerContent {...props} />
        </MouseProvider>
    );
}

function ViewerContent(props: ViewerAppProps) {
    const { command, hits, truncated, limit, query, onQuit, podSpans } = props;
    const { rows, columns } = clampViewport(props);
    const [state, dispatch] = useReducer(reduceViewerState, hits, createViewerState);
    const rootRef = useRef<DOMElement>(null);
    useEffect(() => dispatch({ type: 'replace-hits', hits }), [hits]);
    useOnWheel(rootRef, (event) => {
        dispatch({ type: 'wheel', delta: event.button === 'wheel-up' ? -3 : 3 });
    });
    useInput((input, key) => {
        if (key.ctrl && input === 'c') return onQuit(true);
        if (isMouseReport(input)) return;
        if (state.filtering) {
            if (key.escape) return dispatch({ type: 'escape' });
            if (key.return) return dispatch({ type: 'confirm-filter' });
            if (key.backspace || key.delete) return dispatch({ type: 'backspace' });
            if (key.upArrow) return dispatch({ type: 'up' });
            if (key.downArrow) return dispatch({ type: 'down' });
            const value = sanitizeTypedText(input);
            if (value && !key.ctrl && !key.meta) dispatch({ type: 'text', value });
            return;
        }
        if (state.unhiding) {
            if (input === 'q') return onQuit(false);
            if (key.escape) return dispatch({ type: 'escape' });
            if (key.upArrow) return dispatch({ type: 'unhide-move', delta: -1 });
            if (key.downArrow) return dispatch({ type: 'unhide-move', delta: 1 });
            if (key.return) return dispatch({ type: 'restore-hidden' });
            if (input === 'X') return dispatch({ type: 'clear-hidden' });
            return;
        }
        if (input === 'q') return onQuit(false);
        if (key.escape) return dispatch({ type: 'escape' });
        if (input === '/') return dispatch({ type: 'start-filter' });
        if (input === 'd') return dispatch({ type: 'toggle-detail' });
        if (input === 'x') return dispatch({ type: 'hide-message' });
        if (input === 'X') return dispatch({ type: 'clear-hidden' });
        if (input === 'u') return dispatch({ type: 'open-unhide' });
        if (input === 'c') return dispatch({ type: 'toggle-collapse' });
        if (input === 'o') return dispatch({ type: 'toggle-order' });
        if (input === 't') return dispatch({ type: 'follow-trace' });
        if (key.upArrow) return dispatch({ type: 'up' });
        if (key.downArrow) return dispatch({ type: 'down' });
        if (key.return) dispatch({ type: 'enter' });
    });

    const groups = groupHits(withoutHidden(state.hits, state.hiddenMessages), state.filter);
    const displayOpts = { collapse: state.collapseRepeats, newestFirst: state.newestFirst };
    const repeats = new Map<string, number>();
    for (const group of groups) {
        for (const row of displayHits(group.hits, displayOpts)) repeats.set(row.id, row.repeats);
    }
    const shownHits = groups.reduce((total, group) => total + group.hits.length, 0);
    const all = visibleItems(state);
    const selectedId = state.selected.kind === 'hit' ? state.selected.id : undefined;
    const selectedHit = selectedId ? state.hits.find((hit) => hit.id === selectedId) : undefined;
    const showFilter = state.filtering || Boolean(state.filter);
    const queryHeader = query ? formatQueryHeader(query) : [];
    const chrome = 3 + queryHeader.length + (showFilter ? 1 : 0) + (truncated ? 1 : 0);
    const detailBudget = state.detailExpanded
        ? Math.max(1, rows - chrome - 4)
        : Math.min(DETAIL_ROWS, rows - chrome - 4);
    const detail =
        state.unhiding || !selectedHit
            ? []
            : detailLines(selectedHit, columns - 3, detailBudget, state.detailExpanded);
    const unhideRows = state.unhiding ? state.hiddenMessages.length + 2 : 0;
    const reserved = chrome + (detail.length ? detail.length + 3 : 0) + unhideRows;
    const listRows = fitRows(rows, reserved);
    const selectedIndex = all.findIndex((item) => sameSelection(item, state.selected));
    const scroll = clampScroll({
        scroll: state.scroll,
        selectedIndex,
        listRows,
        total: all.length,
    });
    const items = all.slice(scroll, scroll + listRows);
    const lastStamp = [...state.hits].reverse().find((hit) => hit.parsed.time)?.parsed.time;

    return (
        <Box ref={rootRef} flexDirection="column" width={columns}>
            <Text wrap="truncate">
                <Text bold color="cyan">
                    klog {command}
                </Text>
                <Text dimColor>
                    {' '}
                    · {state.filter ? `${shownHits} of ${state.hits.length}` : state.hits.length}{' '}
                    {state.hits.length === 1 ? 'hit' : 'hits'} in {groups.length} {groups.length === 1 ? 'pod' : 'pods'}
                    {lastStamp ? ` · last ${lastStamp}` : ''}
                </Text>
            </Text>
            {queryHeader.map((line) => (
                <Text key={line} dimColor wrap="truncate">
                    {truncate(line, columns)}
                </Text>
            ))}
            {showFilter ? (
                <Text color="yellow" wrap="truncate">
                    {truncate(
                        state.filtering
                            ? `filter: ${state.filter || 'type to filter…'}▌ (enter confirms · esc clears)`
                            : `filter: ${state.filter} (esc clears)`,
                        columns,
                    )}
                </Text>
            ) : null}
            {truncated ? (
                <Text color="yellow" wrap="truncate">
                    {truncated === 'ring'
                        ? `showing latest ${limit} hits · older lines dropped`
                        : `showing first ${limit} hits · rest not kept in memory`}
                </Text>
            ) : null}
            {items.length ? (
                <Text dimColor wrap="truncate">
                    {`  ${'time'.padEnd(TIME_WIDTH)} ${'dur'.padEnd(DUR_WIDTH)} ${'level'.padEnd(LEVEL_WIDTH)} message`}
                </Text>
            ) : (
                <Text dimColor wrap="truncate">
                    {truncate(emptyState(command, state.filter), columns)}
                </Text>
            )}
            {items.map((item) =>
                item.kind === 'group' ? (
                    <GroupRow
                        key={`group:${item.pod}`}
                        item={item}
                        count={groups.find((group) => group.pod === item.pod)?.hits.length ?? 0}
                        span={formatPodSpan(podSpans?.[item.pod])}
                        collapsed={state.collapsed.includes(item.pod)}
                        selected={sameSelection(item, state.selected)}
                        width={columns}
                        dispatch={dispatch}
                    />
                ) : (
                    <HitRow
                        key={`hit:${item.id}`}
                        item={item}
                        hit={state.hits.find((hit) => hit.id === item.id)}
                        repeats={repeats.get(item.id) ?? 1}
                        selected={sameSelection(item, state.selected)}
                        width={columns}
                        query={query}
                        dispatch={dispatch}
                    />
                ),
            )}
            {state.unhiding ? (
                <Box flexDirection="column" borderStyle="single" borderColor="gray">
                    {state.hiddenMessages.map((message, index) => (
                        <Text key={`${index}:${message}`} wrap="truncate">
                            {truncate(`${index === state.unhideIndex ? '→' : ' '} ${message}`, columns - 2)}
                        </Text>
                    ))}
                </Box>
            ) : selectedHit ? (
                <Detail hit={selectedHit} lines={detail} width={columns} query={query} />
            ) : null}
            <Text dimColor wrap="truncate">
                {truncate(footerHint(state, scroll, items.length, all.length), columns)}
            </Text>
        </Box>
    );
}

function emptyState(command: 'search' | 'tail', filter: string): string {
    if (filter) return `No hits match "${filter}" · esc clears the filter`;
    return command === 'tail' ? 'Waiting for log lines…' : 'Searching…';
}

function scrollHint(scroll: number, shown: number, total: number): string {
    const above = scroll > 0 ? ' ▴' : '';
    const below = scroll + shown < total ? ' ▾' : '';
    return `${above}${below}`;
}

function footerHint(state: ViewerState, scroll: number, shown: number, total: number): string {
    if (state.unhiding) return 'unhide · ↑↓ · enter restore · esc back · q quit';
    const hiding = state.hiddenMessages.length
        ? ` · hiding ${state.hiddenMessages.length} · u choose · X clear`
        : '';
    const clearFilter = state.filter ? ' · esc clear filter' : '';
    const position = `${selectionLabel(state)}${scrollHint(scroll, shown, total)}`;
    const keys = '↑↓ move · enter/click expand · / filter · d fields · x hide · c collapse · o order · t trace';
    const order = state.newestFirst ? ' · newest first' : '';
    return `${position}${hiding}${order} · ${keys}${clearFilter} · q quit`;
}

function GroupRow({
    item,
    count,
    span,
    collapsed,
    selected,
    width,
    dispatch,
}: {
    item: Extract<ViewerSelection, { kind: 'group' }>;
    count: number;
    span: string;
    collapsed: boolean;
    selected: boolean;
    width: number;
    dispatch: React.Dispatch<ViewerAction>;
}) {
    const ref = useRef<DOMElement>(null);
    useOnClick(ref, (event) => {
        if (isRowClick(getElementPosition(ref.current)?.top, event.y)) {
            dispatch({ type: 'click-group', pod: item.pod });
        }
    });
    return (
        <Box ref={ref}>
            <Text bold color={selected ? 'cyan' : undefined} wrap="truncate">
                {formatGroupRow({ collapsed, pod: item.pod, count, span, width })}
            </Text>
        </Box>
    );
}

function HitRow({
    item,
    hit,
    repeats,
    selected,
    width,
    query,
    dispatch,
}: {
    item: Extract<ViewerSelection, { kind: 'hit' }>;
    hit?: ViewerHit;
    repeats: number;
    selected: boolean;
    width: number;
    query?: ViewerQuery;
    dispatch: React.Dispatch<ViewerAction>;
}) {
    const ref = useRef<DOMElement>(null);
    useOnClick(ref, (event) => {
        if (isRowClick(getElementPosition(ref.current)?.top, event.y)) {
            dispatch({ type: 'click-hit', id: item.id });
        }
    });
    if (!hit) return null;
    const { time, duration, level, message, status } = hit.parsed;
    const timeText = `${selected ? '→' : ' '} ${time.padEnd(TIME_WIDTH)} `;
    const rest = `${duration.padEnd(DUR_WIDTH)} ${level.padEnd(LEVEL_WIDTH)} `;
    const badge = repeats > 1 ? ` ×${repeats}` : '';
    const shownMessage = truncate(message, Math.max(1, width - timeText.length - rest.length - badge.length)) + badge;
    return (
        <Box ref={ref}>
            <Text wrap="truncate">
                <Text bold color={selected ? 'cyan' : 'white'}>
                    {timeText}
                </Text>
                <Text color={selected ? 'cyan' : rowColor(level, status)}>
                    {rest}
                    <HighlightedText text={shownMessage} query={query} />
                </Text>
            </Text>
        </Box>
    );
}

function Detail({ hit, lines, width, query }: { hit: ViewerHit; lines: string[]; width: number; query?: ViewerQuery }) {
    return (
        <Box flexDirection="column" borderStyle="single" borderColor="gray">
            <Text bold wrap="truncate">
                {` ${truncate(`detail · ${hit.pod}/${hit.container}`, width - 3)}`.padEnd(width - 2)}
            </Text>
            {lines.map((line, index) => (
                <Text key={index} wrap="truncate">
                    {' '}
                    <HighlightedText text={line} query={query} />
                    {' '.repeat(Math.max(0, width - 3 - line.length))}
                </Text>
            ))}
        </Box>
    );
}

function HighlightedText({ text, query }: { text: string; query?: ViewerQuery }) {
    if (!query) return <>{text}</>;
    return (
        <>
            {matchSpans(text, query.query, query).map((span, index) => (
                <Text key={index} color={span.match ? 'yellow' : undefined} bold={span.match}>
                    {span.text}
                </Text>
            ))}
        </>
    );
}

function detailLines(hit: ViewerHit, width: number, maxRows: number, expanded: boolean): string[] {
    if (maxRows < 1) return [];
    const entries = detailEntries(hit.parsed, expanded);
    const fieldCap = expanded ? entries.length : DETAIL_FIELDS;
    const wrap = expanded ? 1 : DETAIL_WRAP;

    const lines: string[] = [];
    let used = 0;
    for (const [key, value] of entries) {
        if (used >= fieldCap || lines.length >= maxRows) break;
        const label = `${key.padEnd(LABEL_WIDTH)} `;
        const budget = Math.min(wrap, maxRows - lines.length);
        const chunks = wrapValue(value, Math.max(8, width - label.length), budget);
        lines.push(`${label}${chunks[0]}`);
        for (const chunk of chunks.slice(1)) lines.push(`${' '.repeat(label.length)}${chunk}`);
        used += 1;
    }
    const hidden = entries.length - used;
    if (hidden > 0) {
        if (lines.length >= maxRows) lines.length = maxRows - 1;
        lines.push(truncate(`… +${hidden} more fields (d to expand)`, width));
    }
    return lines;
}

function rowColor(level: string, status: string): string | undefined {
    const code = Number(status);
    if (level === 'ERROR' || level === 'FATAL' || code >= 500) return 'red';
    if (level === 'WARN' || level === 'WARNING' || code >= 400) return 'yellow';
    return undefined;
}

function sameSelection(a: ViewerSelection, b: ViewerSelection): boolean {
    return a.kind === b.kind && a.pod === b.pod && (a.kind === 'group' || (b.kind === 'hit' && a.id === b.id));
}
