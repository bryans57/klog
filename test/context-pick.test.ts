import { describe, expect, test } from 'bun:test';
import { formatContextList, resolveContextPick } from '../src/k8s/context-pick';

const list = [
    { name: 'gke_cluster-bryans57-dev_us-central1_cluster-apis-dev-02', current: false },
    { name: 'gke_cluster-bryans57-prod_us-central1_cluster-prod-ap-apis-02', current: true },
    { name: 'gke_cluster-bryans57-test_us-central1_cluster-test', current: false },
    { name: 'gke_cluster-bryans57-test_us-central1_cluster-test-ap-apis-02', current: false },
];

describe('resolveContextPick', () => {
    test('picks by 1-based index', () => {
        const r = resolveContextPick(list, '4');
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.name).toBe(list[3].name);
    });

    test('picks unique substring', () => {
        const r = resolveContextPick(list, 'apis-dev');
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.name).toContain('dev');
    });

    test('exact name wins', () => {
        const r = resolveContextPick(list, list[1].name);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.name).toBe(list[1].name);
    });

    test('ambiguous env shortcut lists candidates', () => {
        const r = resolveContextPick(list, 'test');
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.matches).toHaveLength(2);
            expect(r.message).toContain('klog use 3');
            expect(r.message).toContain('4  ');
        }
    });

    test('unknown query fails', () => {
        const r = resolveContextPick(list, 'staging');
        expect(r.ok).toBe(false);
    });
});

describe('formatContextList', () => {
    test('numbers contexts and marks current', () => {
        const text = formatContextList(list);
        expect(text).toContain('* 2');
        expect(text).toContain('  4');
    });
});
