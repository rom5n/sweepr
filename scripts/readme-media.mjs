// Builds README screenshots and demo videos for every UI language (mock data, no real PC data).
// Needs the dev server (npm run dev), Microsoft Edge and ffmpeg.
//   node scripts/readme-media.mjs [en ru es zh]
// Output: docs/media/<lang>/{home,review,confirm,running,done,startup,settings,light}.png, demo.gif, demo.mp4
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'http://127.0.0.1:1420/';
const langs = process.argv.slice(2).length ? process.argv.slice(2) : ['en', 'ru', 'es', 'zh'];
const tmp = mkdtempSync(join(tmpdir(), 'sweepr-media-'));
const profile = join(tmp, 'profile');

/** One headless capture after `ms` of virtual time. */
function shot(out, params, ms, scale = 1) {
  const url = BASE + '?' + new URLSearchParams(params);
  execFileSync(EDGE, ['--headless=new', `--user-data-dir=${profile}`, '--disable-gpu', '--hide-scrollbars',
    `--force-device-scale-factor=${scale}`, `--virtual-time-budget=${ms}`, '--window-size=400,760', `--screenshot=${resolve(out)}`, url],
    { stdio: 'ignore' });
}

const STILLS = {
  home: [{ theme: 'dark' }, 2500],
  review: [{ theme: 'dark', startView: 'review' }, 2500],
  confirm: [{ theme: 'dark', demo: 'confirm' }, 2500],
  running: [{ theme: 'dark', demo: 'running' }, 3500],
  done: [{ theme: 'dark', demo: 'done' }, 12000],
  startup: [{ theme: 'dark', startView: 'startup' }, 2500],
  settings: [{ theme: 'dark', startView: 'settings' }, 2500],
  light: [{ theme: 'light', palette: 'pastel', seed: 'teal', chart: 'waffle' }, 2500]
};

// Video: [params, virtual ms, seconds on screen]
function scenes() {
  const s = [];
  for (let ms = 400; ms <= 2200; ms += 120) s.push([{ theme: 'dark' }, ms, 0.07]); // scan, then the ring grows
  s.push([{ theme: 'dark' }, 2500, 1.6]);
  s.push([{ theme: 'dark', startView: 'review' }, 2500, 1.8]);
  s.push([{ theme: 'dark', demo: 'confirm' }, 2500, 1.8]);
  for (let ms = 1600; ms <= 9600; ms += 500) s.push([{ theme: 'dark', demo: 'running' }, ms, 0.12]); // cleaning
  s.push([{ theme: 'dark', demo: 'done' }, 12000, 2]);
  s.push([{ theme: 'dark', startView: 'startup' }, 2500, 1.4]);
  s.push([{ theme: 'dark', startView: 'settings' }, 2500, 1.4]);
  for (let ms = 1000; ms <= 1800; ms += 100) s.push([{ theme: 'light', palette: 'pastel', seed: 'teal', chart: 'waffle' }, ms, 0.06]); // waffle fills in
  s.push([{ theme: 'light', palette: 'pastel', seed: 'teal', chart: 'waffle' }, 2500, 1.6]);
  s.push([{ theme: 'light', palette: 'bright', seed: 'violet', chart: 'bars' }, 2500, 1.4]);
  return s;
}

for (const lang of langs) {
  const dir = `docs/media/${lang}`;
  mkdirSync(dir, { recursive: true });
  for (const [name, [p, ms]] of Object.entries(STILLS)) shot(`${dir}/${name}.png`, { ...p, lang }, ms, 2);

  const fdir = join(tmp, lang);
  mkdirSync(fdir, { recursive: true });
  const list = [];
  scenes().forEach(([p, ms, sec], i) => {
    const f = join(fdir, `f${String(i).padStart(3, '0')}.png`);
    shot(f, { ...p, lang }, ms);
    list.push(`file '${f.replace(/\\/g, '/')}'`, `duration ${sec}`);
  });
  list.push(list[list.length - 2]); // concat demuxer: repeat the last file
  const concat = join(fdir, 'list.txt');
  writeFileSync(concat, list.join('\n'));
  const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  ff(['-f', 'concat', '-safe', '0', '-i', concat, '-vf', 'fps=15,scale=400:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', `${dir}/demo.gif`]);
  ff(['-f', 'concat', '-safe', '0', '-i', concat, '-vf', 'fps=30,scale=800:-2:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '24', '-movflags', '+faststart', `${dir}/demo.mp4`]);
  console.log(lang, 'done');
}
rmSync(tmp, { recursive: true, force: true });
