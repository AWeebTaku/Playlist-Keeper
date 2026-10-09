// Usage: npm run version:set -- 0.2.0
// One command keeps every place that carries the version in step (the release workflow refuses a mismatched tag).
import { readFileSync, writeFileSync } from 'node:fs';

const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/u.test(v ?? '')) {
  console.error('Usage: npm run version:set -- <major.minor.patch>');
  process.exit(1);
}
const edit = (file, fn) => writeFileSync(file, fn(readFileSync(file, 'utf8')));
const json = (file) =>
  edit(file, (t) => {
    const j = JSON.parse(t);
    j.version = v;
    if (j.packages?.['']) j.packages[''].version = v; // package-lock.json
    return JSON.stringify(j, null, 2) + '\n';
  });
json('package.json');
json('package-lock.json');
json('src-tauri/tauri.conf.json');
edit('src-tauri/Cargo.toml', (t) => t.replace(/^version = ".*"$/mu, `version = "${v}"`));
edit('src-tauri/Cargo.lock', (t) => t.replace(/(name = "playlist-keeper"\nversion = ")[^"]*(")/u, `$1${v}$2`));
console.log(`Version set to ${v}. Next: git commit -am "v${v}" && git tag v${v} && git push --follow-tags`);
