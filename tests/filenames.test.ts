import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Every source file under a folder, as paths relative to the project root. */
function walk(dir: URL, rel = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, dir), `${rel}${e.name}/`) : [`${rel}${e.name}`]));
}

describe('file names', () => {
  it('never clash once case is ignored (Windows and macOS file systems do)', () => {
    // "Combine.svelte" next to "combine.svelte.ts" made `import './combine.svelte'` load the component on Windows and macOS,
    // while it worked on Linux. The test compares names the way an import does, without a trailing ".ts".
    const clashes: string[] = [];
    for (const root of ['../src/', '../tests/']) {
      const seen: Record<string, string> = {};
      for (const f of walk(new URL(root, import.meta.url))) {
        const key = f.replace(/\.ts$/u, '').toLowerCase();
        if (seen[key] && seen[key] !== f) clashes.push(`${root}${seen[key]} / ${root}${f}`);
        seen[key] = f;
      }
    }
    expect(clashes).toEqual([]);
  });
});
