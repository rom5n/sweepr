// Builds src-tauri/icons from the logo generator (src/logo.ts).
// Needs the dev server running (npm run dev) and Microsoft Edge.
// Full mark for 48 px and up, small mark for 32 px and below (style-system rule).
//   node scripts/make-icons.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'src-tauri/icons';
const tmp = mkdtempSync(join(tmpdir(), 'sweepr-icons-'));

const dom = execFileSync(EDGE, ['--headless=new', `--user-data-dir=${join(tmp, 'prof')}`, '--disable-gpu',
  '--virtual-time-budget=3000', '--dump-dom', 'http://127.0.0.1:1420/icon.html'], { encoding: 'utf8' });
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const svgs = {};
for (const m of dom.matchAll(/<textarea id="(logo-[a-z-]+)">([\s\S]*?)<\/textarea>/g)) svgs[m[1]] = unescape(m[2]);
if (Object.keys(svgs).length !== 4) throw new Error('logo SVGs not found in icon.html output');

mkdirSync(OUT, { recursive: true });
for (const [id, s] of Object.entries(svgs)) writeFileSync(join(OUT, id + '.svg'), s);

// The app icon uses the light tile; the tray swaps by theme later.
const tauri = (src, sizes, dir) => execFileSync('npx', ['tauri', 'icon', src, '-o', dir, '-p', sizes], { stdio: 'inherit', shell: true });
tauri(join(OUT, 'logo-light-small.svg'), '16,24,32', join(tmp, 's'));
tauri(join(OUT, 'logo-light-full.svg'), '48,128,256', join(tmp, 'f'));

const png = (dir, n) => readFileSync(join(tmp, dir, `${n}x${n}.png`));
const entries = [[16, 's'], [24, 's'], [32, 's'], [48, 'f'], [256, 'f']].map(([n, d]) => [n, png(d, n)]);
writeFileSync(join(OUT, '32x32.png'), png('s', 32));
writeFileSync(join(OUT, '128x128.png'), png('f', 128));
writeFileSync(join(OUT, 'icon.png'), png('f', 256));

// ICO with embedded PNGs (Vista+).
const head = Buffer.alloc(6 + 16 * entries.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(entries.length, 4);
let offset = head.length;
entries.forEach(([n, data], i) => {
  const o = 6 + 16 * i;
  head.writeUInt8(n >= 256 ? 0 : n, o); head.writeUInt8(n >= 256 ? 0 : n, o + 1);
  head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
  head.writeUInt32LE(data.length, o + 8); head.writeUInt32LE(offset, o + 12);
  offset += data.length;
});
writeFileSync(join(OUT, 'icon.ico'), Buffer.concat([head, ...entries.map((e) => e[1])]));
console.log('icons written to', OUT);
