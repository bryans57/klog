export type GkeRef = {
    project: string;
    location: string;
    cluster: string;
    locationFlag: 'region' | 'zone';
};

const ZONE = /^[a-z]+-[a-z]+\d+-[a-z]$/;

export function parseGkeContext(name: string): GkeRef | null {
    const parts = name.split('_');
    if (parts.length < 4 || parts[0] !== 'gke') return null;
    const project = parts[1];
    const location = parts[2];
    const cluster = parts.slice(3).join('_');
    if (!project || !location || !cluster) return null;
    return {
        project,
        location,
        cluster,
        locationFlag: ZONE.test(location) ? 'zone' : 'region',
    };
}

export function compactCluster(name: string): string {
    return name.replace(/-ap-/g, '-').replace(/--+/g, '-');
}

export function resolveGkeClusterName(wanted: string, available: string[]): string | null {
    if (available.includes(wanted)) return wanted;
    const compactWanted = compactCluster(wanted);
    const compactHits = available.filter((n) => compactCluster(n) === compactWanted);
    if (compactHits.length === 1) return compactHits[0];
    const contains = available.filter((n) => n.includes(wanted) || wanted.includes(n));
    if (contains.length === 1) return contains[0];
    return null;
}
