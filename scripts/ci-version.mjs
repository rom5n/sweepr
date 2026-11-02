// CI: release version = MAJOR.MINOR.(PATCH + run number) from src-tauri/tauri.conf.json.
// Every push gets a higher version than the last one, and higher than the version committed in the repo.
// Writes it into tauri.conf.json and package.json and prints `version=<v>` for $GITHUB_OUTPUT.
//   node scripts/ci-version.mjs <run_number>
import { readFileSync, writeFileSync } from 'node:fs';

const run = Number(process.argv[2]);
if (!Number.isInteger(run) || run < 1) throw new Error('usage: ci-version.mjs <run_number>');

const confPath = 'src-tauri/tauri.conf.json';
const conf = JSON.parse(readFileSync(confPath, 'utf8'));
const [major, minor, patch] = conf.version.split('.').map(Number);
const version = `${major}.${minor}.${patch + run}`;

conf.version = version;
writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.version = version;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`version=${version}`);
