export type BufferMode = 'prefix' | 'ring';
export type Truncation = BufferMode | false;

export type HitBuffer<T> = {
    mode: BufferMode;
    limit: number;
    hits: T[];
    truncated: Truncation;
};

export function createBuffer<T>(mode: BufferMode, limit: number): HitBuffer<T> {
    return {
        mode,
        limit: Math.max(1, Math.floor(limit) || 1),
        hits: [],
        truncated: false,
    };
}

export function pushHit<T>(state: HitBuffer<T>, hit: T): HitBuffer<T> {
    if (state.hits.length < state.limit) return { ...state, hits: [...state.hits, hit] };
    if (state.mode === 'prefix') {
        if (state.truncated === 'prefix') return state;
        return { ...state, truncated: 'prefix' };
    }
    return { ...state, hits: [...state.hits.slice(1), hit], truncated: 'ring' };
}
