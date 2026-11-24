import { describe, expect, test } from 'bun:test';
import { createViewerHit, groupHits } from '../src/viewer/model';
import {
    createViewerState,
    reduceViewerState,
    selectionLabel,
    visibleItems,
    type ViewerState,
} from '../src/viewer/state';

const hits = [
    createViewerHit('1', 'pod-a', 'app', '{"level":"error","msg":"failed","trace":"A1B2"}'),
    createViewerHit('2', 'pod-a', 'app', 'healthy'),
    createViewerHit('3', 'pod-b', 'app', 'trace a1b2'),
];

describe('viewer state', () => {
    test('starts multiple groups collapsed and toggles one with enter', () => {
        let state = createViewerState(hits);
        expect(state.collapsed).toEqual(['pod-a', 'pod-b']);
        expect(visibleItems(state).map((item) => item.kind)).toEqual(['group', 'group']);

        state = reduceViewerState(state, { type: 'enter' });
        expect(state.collapsed).toEqual(['pod-b']);
        expect(visibleItems(state).map((item) => item.kind)).toEqual(['group', 'hit', 'hit', 'group']);
    });

    test('uses the same state transitions for mouse clicks and wheel', () => {
        let state = createViewerState(hits);
        state = reduceViewerState(state, { type: 'click-group', pod: 'pod-a' });
        state = reduceViewerState(state, { type: 'click-hit', id: '2' });
        expect(state.selected).toEqual({ kind: 'hit', id: '2', pod: 'pod-a' });

        state = reduceViewerState(state, { type: 'wheel', delta: 2 });
        expect(state.scroll).toBe(2);
    });

    test('filters locally and escape clears the filter', () => {
        let state = createViewerState(hits);
        state = reduceViewerState(state, { type: 'start-filter' });
        state = reduceViewerState(state, { type: 'text', value: 'a1b2' });
        expect(state.filter).toBe('a1b2');
        expect(groupHits(state.hits, state.filter)).toHaveLength(2);

        state = reduceViewerState(state, { type: 'escape' });
        expect(state.filter).toBe('');
        expect(state.filtering).toBe(false);
    });

    test('a filter reveals the matching hits even when the pods were collapsed', () => {
        let state = createViewerState(hits);
        expect(state.collapsed).toEqual(['pod-a', 'pod-b']);

        state = reduceViewerState(state, { type: 'start-filter' });
        state = reduceViewerState(state, { type: 'text', value: 'a1b2' });
        expect(visibleItems(state).filter((item) => item.kind === 'hit')).toHaveLength(2);

        state = reduceViewerState(state, { type: 'escape' });
        expect(state.filter).toBe('');
        expect(visibleItems(state).filter((item) => item.kind === 'hit')).toHaveLength(3);
    });

    test('confirm-filter keeps the filter and stops editing', () => {
        let state = createViewerState(hits);
        state = reduceViewerState(state, { type: 'start-filter' });
        state = reduceViewerState(state, { type: 'text', value: 'a1b2' });
        state = reduceViewerState(state, { type: 'confirm-filter' });
        expect(state.filter).toBe('a1b2');
        expect(state.filtering).toBe(false);
    });

    test('keeps enter usable while filtering by expanding only the matching pods', () => {
        let state = createViewerState(hits);
        state = reduceViewerState(state, { type: 'start-filter' });
        state = reduceViewerState(state, { type: 'text', value: 'a1b2' });
        expect(state.collapsed).toEqual([]);

        state = reduceViewerState(state, { type: 'click-group', pod: 'pod-a' });
        expect(state.collapsed).toEqual(['pod-a']);
        expect(visibleItems(state).filter((item) => item.kind === 'hit')).toHaveLength(1);
    });

    test('describes which log line the selection is on', () => {
        let state = createViewerState(hits);
        expect(selectionLabel(state)).toBe('pod 1 of 2');

        state = reduceViewerState(state, { type: 'click-hit', id: '2' });
        expect(selectionLabel(state)).toBe('hit 2 of 3');

        expect(selectionLabel(createViewerState([]))).toBe('no hits');
    });

    test('moves selection and ignores unknown actions', () => {
        let state = reduceViewerState(createViewerState([hits[0]]), { type: 'down' });
        expect(state.selected.kind).toBe('hit');
        const same = reduceViewerState(state, { type: 'unknown' });
        expect(same).toBe(state);
    });

    test('d toggles expanded detail', () => {
        let state = createViewerState([hits[0]]);
        expect(state.detailExpanded).toBe(false);
        state = reduceViewerState(state, { type: 'toggle-detail' });
        expect(state.detailExpanded).toBe(true);
        state = reduceViewerState(state, { type: 'toggle-detail' });
        expect(state.detailExpanded).toBe(false);
    });

    test('replace-hits keeps an active local filter so new matching lines still show', () => {
        let state = createViewerState(hits);
        state = reduceViewerState(state, { type: 'start-filter' });
        state = reduceViewerState(state, { type: 'text', value: '502' });
        state = reduceViewerState(state, { type: 'confirm-filter' });
        const extra = createViewerHit('4', 'pod-a', 'app', '{"status":502,"msg":"timeout"}');
        state = reduceViewerState(state, { type: 'replace-hits', hits: [...hits, extra] });
        expect(state.filter).toBe('502');
        expect(groupHits(state.hits, state.filter).flatMap((group) => group.hits.map((hit) => hit.id))).toEqual(['4']);
    });
});

const noise = [
    createViewerHit('1', 'pod-a', 'app', '{"msg":"ruido"}'),
    createViewerHit('2', 'pod-a', 'app', '{"msg":"ruido"}'),
    createViewerHit('3', 'pod-a', 'app', '{"msg":"util"}'),
];

function hideFirst(): ViewerState {
    let state = createViewerState(noise);
    state = reduceViewerState(state, { type: 'down' });
    return reduceViewerState(state, { type: 'hide-message' });
}

describe('hidden messages', () => {
    test('x hides every hit with that message and keeps the rest', () => {
        const state = hideFirst();
        expect(state.hiddenMessages).toEqual(['ruido']);
        expect(visibleItems(state).filter((item) => item.kind === 'hit').map((item) => item.id)).toEqual(['3']);
    });

    test('a later hit with the same message stays hidden', () => {
        const opened = reduceViewerState(hideFirst(), { type: 'open-unhide' });
        const state = reduceViewerState(opened, {
            type: 'replace-hits',
            hits: [...noise, createViewerHit('4', 'pod-a', 'app', '{"msg":"ruido"}')],
        });
        expect(visibleItems(state).some((item) => item.kind === 'hit' && item.id === '4')).toBe(false);
        expect(state.hiddenMessages).toEqual(['ruido']);
        expect(state.unhiding).toBe(true);
    });

    test('empty message and a group selection do not hide', () => {
        const state = createViewerState(noise);
        expect(reduceViewerState(state, { type: 'hide-message' }).hiddenMessages).toEqual([]);

        const blank = createViewerHit('9', 'pod-a', 'app', '');
        expect(blank.parsed.message).toBe('');
        const selected = reduceViewerState(
            { ...createViewerState([blank]), selected: { kind: 'hit', pod: 'pod-a', id: '9' } },
            { type: 'hide-message' },
        );
        expect(selected.hiddenMessages).toEqual([]);
    });

    test('hiding the same message twice keeps a single entry', () => {
        const once = hideFirst();
        const twice = reduceViewerState(
            { ...once, selected: { kind: 'hit', pod: 'pod-a', id: '1' } },
            { type: 'hide-message' },
        );
        expect(twice.hiddenMessages).toEqual(['ruido']);
    });

    test('a pod with no visible hits disappears', () => {
        const pods = [
            createViewerHit('1', 'pod-a', 'app', '{"msg":"ruido"}'),
            createViewerHit('2', 'pod-b', 'app', '{"msg":"util"}'),
        ];
        let state = createViewerState(pods);
        state = reduceViewerState(state, { type: 'enter' });
        state = reduceViewerState(state, { type: 'down' });
        state = reduceViewerState(state, { type: 'hide-message' });
        expect(visibleItems(state).map((item) => item.kind === 'group' && item.pod)).toEqual(['pod-b']);
    });

    test('escape clears the slash filter and keeps hidden messages', () => {
        let state = hideFirst();
        state = reduceViewerState(state, { type: 'start-filter' });
        state = reduceViewerState(state, { type: 'text', value: 'util' });
        state = reduceViewerState(state, { type: 'escape' });
        expect(state.filter).toBe('');
        expect(state.hiddenMessages).toEqual(['ruido']);
    });

    test('u selects which hidden message to restore', () => {
        let state = hideFirst();
        state = reduceViewerState(state, { type: 'down' });
        state = reduceViewerState(state, { type: 'hide-message' });
        expect(state.hiddenMessages).toEqual(['ruido', 'util']);

        state = reduceViewerState(state, { type: 'open-unhide' });
        state = reduceViewerState(state, { type: 'unhide-move', delta: 1 });
        state = reduceViewerState(state, { type: 'restore-hidden' });
        expect(state.hiddenMessages).toEqual(['ruido']);
        expect(state.unhiding).toBe(true);

        state = reduceViewerState(state, { type: 'escape' });
        expect(state.unhiding).toBe(false);
        expect(state.hiddenMessages).toEqual(['ruido']);
        expect(state.filter).toBe('');
    });

    test('enter on the last hidden message closes the list', () => {
        let state = reduceViewerState(hideFirst(), { type: 'open-unhide' });
        state = reduceViewerState(state, { type: 'restore-hidden' });
        expect(state.hiddenMessages).toEqual([]);
        expect(state.unhiding).toBe(false);
    });

    test('open-unhide on an empty list is a no-op', () => {
        const state = createViewerState(noise);
        expect(reduceViewerState(state, { type: 'open-unhide' })).toEqual(state);
    });

    test('X clears every hidden message and closes the list', () => {
        let state = reduceViewerState(hideFirst(), { type: 'open-unhide' });
        state = reduceViewerState(state, { type: 'clear-hidden' });
        expect(state.hiddenMessages).toEqual([]);
        expect(state.unhiding).toBe(false);
        expect(state.hits).toHaveLength(3);
        expect(visibleItems(state).filter((item) => item.kind === 'hit')).toHaveLength(2);
    });

    test('the slash filter still applies after hidden messages', () => {
        let state = hideFirst();
        state = reduceViewerState(state, { type: 'start-filter' });
        state = reduceViewerState(state, { type: 'text', value: 'ruido' });
        expect(visibleItems(state).filter((item) => item.kind === 'hit')).toHaveLength(0);
    });

    test('hiding the selected hit moves the selection onto a remaining row', () => {
        const state = hideFirst();
        expect(state.selected).toEqual({ kind: 'hit', pod: 'pod-a', id: '3' });
    });

    test('o flips to newest first and t filters by correlation id', () => {
        const traced = [
            createViewerHit('1', 'pod-a', 'app', '{"ts":"2026-09-11T18:00:00Z","msg":"old","id_correlacion":"abc"}'),
            createViewerHit('2', 'pod-a', 'app', '{"ts":"2026-09-11T19:00:00Z","msg":"new","id_correlacion":"xyz"}'),
        ];
        let state = createViewerState(traced);
        state = reduceViewerState(state, { type: 'toggle-order' });
        expect(state.newestFirst).toBe(true);
        expect(visibleItems(state).filter((item) => item.kind === 'hit').map((item) => item.id)).toEqual(['2', '1']);

        state = reduceViewerState(state, { type: 'down' });
        state = reduceViewerState(state, { type: 'follow-trace' });
        expect(state.filter).toBe('xyz');
        expect(visibleItems(state).filter((item) => item.kind === 'hit').map((item) => item.id)).toEqual(['2']);
    });
});
