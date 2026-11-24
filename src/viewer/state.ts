import { correlationId, displayHits, groupHits, withoutHidden, type ViewerHit } from './model';

export type ViewerSelection = { kind: 'group'; pod: string } | { kind: 'hit'; pod: string; id: string };

export type ViewerState = {
    hits: ViewerHit[];
    collapsed: string[];
    selected: ViewerSelection;
    filter: string;
    filtering: boolean;
    scroll: number;
    quit: boolean;
    detailExpanded: boolean;
    hiddenMessages: string[];
    unhiding: boolean;
    unhideIndex: number;
    collapseRepeats: boolean;
    newestFirst: boolean;
};

export type ViewerAction =
    | {
          type:
              | 'up'
              | 'down'
              | 'enter'
              | 'start-filter'
              | 'confirm-filter'
              | 'escape'
              | 'quit'
              | 'backspace'
              | 'toggle-detail'
              | 'unknown';
      }
    | { type: 'text'; value: string }
    | { type: 'click-group'; pod: string }
    | { type: 'click-hit'; pod?: string; id: string }
    | { type: 'wheel'; delta: number }
    | { type: 'replace-hits'; hits: ViewerHit[] }
    | { type: 'hide-message' }
    | { type: 'open-unhide' }
    | { type: 'unhide-move'; delta: -1 | 1 }
    | { type: 'restore-hidden' }
    | { type: 'clear-hidden' }
    | { type: 'toggle-collapse' }
    | { type: 'toggle-order' }
    | { type: 'follow-trace' };

export function createViewerState(hits: ViewerHit[]): ViewerState {
    const pods = groupHits(hits).map((group) => group.pod);
    return {
        hits,
        collapsed: pods.length > 1 ? pods : [],
        selected: { kind: 'group', pod: pods[0] ?? '' },
        filter: '',
        filtering: false,
        scroll: 0,
        quit: false,
        detailExpanded: false,
        hiddenMessages: [],
        unhiding: false,
        unhideIndex: 0,
        collapseRepeats: true,
        newestFirst: false,
    };
}

export function visibleItems(state: ViewerState): ViewerSelection[] {
    const collapsed = new Set(state.collapsed);
    return groupHits(shownHits(state), state.filter).flatMap((group) => {
        const rows = displayHits(group.hits, {
            collapse: state.collapseRepeats,
            newestFirst: state.newestFirst,
        });
        return [
            { kind: 'group' as const, pod: group.pod },
            ...(collapsed.has(group.pod)
                ? []
                : rows.map((hit) => ({ kind: 'hit' as const, pod: group.pod, id: hit.id }))),
        ];
    });
}

export function reduceViewerState(state: ViewerState, action: ViewerAction): ViewerState {
    if (action.type === 'unknown') return state;
    if (action.type === 'replace-hits') return replaceHits(state, action.hits);
    if (action.type === 'toggle-detail') return { ...state, detailExpanded: !state.detailExpanded };
    if (action.type === 'quit') return { ...state, quit: true };
    if (action.type === 'start-filter') return { ...state, filtering: true };
    if (action.type === 'confirm-filter') return { ...state, filtering: false };
    if (action.type === 'escape') {
        if (state.unhiding) return { ...state, unhiding: false };
        return { ...state, filtering: false, filter: '', scroll: 0 };
    }
    if (action.type === 'hide-message') return hideMessage(state);
    if (action.type === 'open-unhide') {
        if (!state.hiddenMessages.length || state.unhiding) return state;
        return { ...state, unhiding: true, unhideIndex: 0 };
    }
    if (action.type === 'unhide-move') {
        if (!state.unhiding) return state;
        const last = state.hiddenMessages.length - 1;
        const next = Math.max(0, Math.min(last, state.unhideIndex + action.delta));
        return { ...state, unhideIndex: next };
    }
    if (action.type === 'restore-hidden') return restoreHidden(state);
    if (action.type === 'clear-hidden') return { ...state, hiddenMessages: [], unhiding: false, unhideIndex: 0 };
    if (action.type === 'toggle-collapse') return { ...state, collapseRepeats: !state.collapseRepeats, scroll: 0 };
    if (action.type === 'toggle-order') return { ...state, newestFirst: !state.newestFirst, scroll: 0 };
    if (action.type === 'follow-trace') return followTrace(state);
    if (action.type === 'text' && state.filtering) return applyFilter(state, state.filter + action.value);
    if (action.type === 'backspace' && state.filtering) return applyFilter(state, state.filter.slice(0, -1));
    if (action.type === 'click-group') return toggleGroup(state, action.pod);
    if (action.type === 'click-hit') {
        const hit = state.hits.find((candidate) => candidate.id === action.id);
        return hit ? { ...state, selected: { kind: 'hit', pod: hit.pod, id: hit.id } } : state;
    }
    if (action.type === 'wheel') return { ...state, scroll: Math.max(0, state.scroll + action.delta) };
    if (action.type === 'enter' && state.selected.kind === 'group') return toggleGroup(state, state.selected.pod);
    if (action.type === 'up' || action.type === 'down') return move(state, action.type === 'up' ? -1 : 1);
    return state;
}

function applyFilter(state: ViewerState, filter: string): ViewerState {
    const matching = new Set(groupHits(shownHits(state), filter).map((group) => group.pod));
    return {
        ...state,
        filter,
        collapsed: state.collapsed.filter((pod) => !matching.has(pod)),
        scroll: 0,
    };
}

export function selectionLabel(state: ViewerState): string {
    const groups = groupHits(shownHits(state), state.filter);
    if (!groups.length) return 'no hits';
    if (state.selected.kind === 'group') {
        const index = groups.findIndex((group) => group.pod === state.selected.pod);
        return `pod ${index + 1} of ${groups.length}`;
    }
    const selectedId = state.selected.id;
    const hits = groups.flatMap((group) => group.hits);
    const index = hits.findIndex((hit) => hit.id === selectedId);
    return index < 0 ? `${hits.length} hits` : `hit ${index + 1} of ${hits.length}`;
}

function toggleGroup(state: ViewerState, pod: string): ViewerState {
    const collapsed = new Set(state.collapsed);
    if (collapsed.has(pod)) collapsed.delete(pod);
    else collapsed.add(pod);
    return { ...state, collapsed: [...collapsed], selected: { kind: 'group', pod } };
}

function move(state: ViewerState, delta: number): ViewerState {
    const items = visibleItems(state);
    if (!items.length) return state;
    const current = items.findIndex((item) => sameSelection(item, state.selected));
    const next = Math.max(0, Math.min(items.length - 1, (current < 0 ? 0 : current) + delta));
    return { ...state, selected: items[next] };
}

function replaceHits(state: ViewerState, hits: ViewerHit[]): ViewerState {
    const pods = groupHits(hits).map((group) => group.pod);
    const collapsed = state.collapsed.filter((pod) => pods.includes(pod));
    for (const pod of pods) {
        if (!groupHits(state.hits).some((group) => group.pod === pod) && pods.length > 1) collapsed.push(pod);
    }
    const selectedExists = visibleItems({ ...state, hits, collapsed }).some((item) =>
        sameSelection(item, state.selected),
    );
    return {
        ...state,
        hits,
        collapsed,
        selected: selectedExists ? state.selected : { kind: 'group', pod: pods[0] ?? '' },
    };
}

function followTrace(state: ViewerState): ViewerState {
    const selected = state.selected;
    if (selected.kind !== 'hit') return state;
    const hit = state.hits.find((candidate) => candidate.id === selected.id);
    if (!hit) return state;
    const id = correlationId(hit);
    if (!id) return state;
    return { ...applyFilter(state, id), filtering: false };
}

function shownHits(state: ViewerState): ViewerHit[] {
    return withoutHidden(state.hits, state.hiddenMessages);
}

function hideMessage(state: ViewerState): ViewerState {
    const selected = state.selected;
    if (selected.kind !== 'hit') return state;
    const hit = state.hits.find((candidate) => candidate.id === selected.id);
    const message = hit?.parsed.message ?? '';
    if (!message || state.hiddenMessages.includes(message)) return state;
    const next = { ...state, hiddenMessages: [...state.hiddenMessages, message] };
    return { ...next, selected: selectionAfterHide(state, next) };
}

function restoreHidden(state: ViewerState): ViewerState {
    if (!state.unhiding) return state;
    const hiddenMessages = state.hiddenMessages.filter((_, index) => index !== state.unhideIndex);
    if (!hiddenMessages.length) return { ...state, hiddenMessages, unhiding: false, unhideIndex: 0 };
    return { ...state, hiddenMessages, unhideIndex: Math.min(state.unhideIndex, hiddenMessages.length - 1) };
}

function selectionAfterHide(before: ViewerState, after: ViewerState): ViewerSelection {
    const items = visibleItems(after);
    if (items.some((item) => sameSelection(item, before.selected))) return before.selected;
    const index = visibleItems(before).findIndex((item) => sameSelection(item, before.selected));
    return items[Math.min(Math.max(index, 0), items.length - 1)] ?? { kind: 'group', pod: '' };
}

function sameSelection(a: ViewerSelection, b: ViewerSelection): boolean {
    return a.kind === b.kind && a.pod === b.pod && (a.kind === 'group' || (b.kind === 'hit' && a.id === b.id));
}
