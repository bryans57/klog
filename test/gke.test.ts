import { describe, expect, test } from 'bun:test';
import { parseGkeContext, resolveGkeClusterName } from '../src/k8s/gke';

describe('parseGkeContext', () => {
    test('parses regional GKE context', () => {
        const r = parseGkeContext(
            'gke_cluster-bryans57-test_us-central1_cluster-test-ap-apis-01',
        );
        expect(r).toEqual({
            project: 'cluster-bryans57-test',
            location: 'us-central1',
            cluster: 'cluster-test-ap-apis-01',
            locationFlag: 'region',
        });
    });

    test('parses zonal GKE context', () => {
        const r = parseGkeContext('gke_my-proj_us-central1-a_my-cluster');
        expect(r?.locationFlag).toBe('zone');
        expect(r?.cluster).toBe('my-cluster');
    });

    test('returns null for non-GKE names', () => {
        expect(parseGkeContext('minikube')).toBeNull();
    });
});

describe('resolveGkeClusterName', () => {
    test('uses exact name when listed', () => {
        expect(resolveGkeClusterName('cluster-test-apis-01', ['cluster-test-apis-01'])).toBe(
            'cluster-test-apis-01',
        );
    });

    test('maps stale kube name to current GKE name', () => {
        expect(
            resolveGkeClusterName('cluster-test-ap-apis-01', [
                'cluster-test',
                'cluster-test-apis-01',
                'cluster-bryans57-test-02',
            ]),
        ).toBe('cluster-test-apis-01');
    });

    test('returns null when several clusters match', () => {
        expect(resolveGkeClusterName('test', ['cluster-test', 'cluster-test-02'])).toBeNull();
    });
});
