import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

const SRC = join(import.meta.dir, '../src');
const FORBIDDEN = ['apply', 'delete', 'exec', 'patch', 'create', 'replace', 'rollout', 'edit'];

async function walkTs(dir: string): Promise<string[]> {
    const out: string[] = [];
    for (const ent of await readdir(dir, { withFileTypes: true })) {
        const p = join(dir, ent.name);
        if (ent.isDirectory()) out.push(...(await walkTs(p)));
        else if (ent.name.endsWith('.ts')) out.push(p);
    }
    return out;
}

describe('CA-011 kubectl/gcloud surface', () => {
    test('only kubectl.ts spawns processes', async () => {
        const files = await walkTs(SRC);
        const spawners: string[] = [];
        for (const file of files) {
            const text = await Bun.file(file).text();
            if (text.includes('Bun.spawn')) spawners.push(file.replace(`${SRC}/`, ''));
        }
        expect(spawners).toEqual(['k8s/kubectl.ts']);
    });

    test('kubectl.ts does not pass mutating verbs', async () => {
        const text = await Bun.file(join(SRC, 'k8s/kubectl.ts')).text();
        for (const verb of FORBIDDEN) {
            expect(text, `forbidden kubectl verb ${verb}`).not.toMatch(
                new RegExp(`['"\`]${verb}['"\`]`),
            );
        }
        expect(text).toContain("'config'");
        expect(text).toContain("'get'");
        expect(text).toContain("'logs'");
        expect(text).toContain("'gcloud'");
        expect(text).toContain('get-credentials');
    });
});

describe('CA-015 quality gates wiring', () => {
    test('package.json and install.sh run typecheck, tests, and compile', async () => {
        const pkg = (await Bun.file(join(import.meta.dir, '../package.json')).json()) as {
            scripts: Record<string, string>;
        };
        expect(pkg.scripts.typecheck).toContain('tsc');
        expect(pkg.scripts.check).toContain('typecheck');
        expect(pkg.scripts.check).toContain('bun test');
        expect(pkg.scripts.build).toContain('src/cli.ts');
        const install = await Bun.file(join(import.meta.dir, '../install.sh')).text();
        expect(install).toContain('bun run check');
        expect(install).toContain('bun run build');
    });

    test('viewer dependencies stay on the approved allowlist', async () => {
        const pkg = (await Bun.file(join(import.meta.dir, '../package.json')).json()) as {
            dependencies?: Record<string, string>;
        };
        expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual([
            '@ink-tools/ink-mouse',
            'ink',
            'react',
        ]);
    });
});
