// Adjusts src-tauri/tauri.conf.json inside a CI checkout (never run locally).
//   --repo owner/name        point the updater at that repository's latest release
//   --no-updater-artifacts   build installers without update packages (CI builds have no signing key)
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = 'src-tauri/tauri.conf.json';
const conf = JSON.parse(readFileSync(file, 'utf8'));
const repo = args[args.indexOf('--repo') + 1];
if (args.includes('--repo')) {
  if (!/^[\w.-]+\/[\w.-]+$/u.test(repo ?? '')) throw new Error('--repo needs owner/name');
  conf.plugins.updater.endpoints = [`https://github.com/${repo}/releases/latest/download/latest.json`];
}
if (args.includes('--no-updater-artifacts')) conf.bundle.createUpdaterArtifacts = false;
writeFileSync(file, JSON.stringify(conf, null, 2) + '\n');
console.log('updated', file);
