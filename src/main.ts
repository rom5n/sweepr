import { html, svg, render, nothing } from 'lit-html';
import '@fontsource-variable/golos-text';
import '@fontsource-variable/noto-sans-sc';
import '@fontsource-variable/inter';
import '@fontsource-variable/manrope';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/jetbrains-mono/400.css';
import './design.css';
import './shell.css';
import { UI, DATA, LOCALE, LANGS } from './i18n';
import { sqPath } from './geometry';
import { logoDefs } from './logo';
import { unsafeSVG } from 'lit-html/directives/unsafe-svg.js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { IN_TAURI } from './api';
import { scan as runScan, liveStats, clean as runClean, pauseClean, cancelClean, queueCompact, startupApply, startupUndo, startupList, settingsLoad, settingsSave, setWeekly, onTray, pickFolder, type Target, type Impact, type ScanResult, type CleanItem, type Applied } from './api';

// ---------- static ----------
const SQ = sqPath(80, 80, 66, 4, 200);
const CIRCLE = 'M80 14 A66 66 0 1 1 80 146 A66 66 0 1 1 80 14';
const LOGO_DEFS = unsafeSVG(logoDefs());
const SEEDS = ['blue', 'violet', 'green', 'orange', 'pink', 'teal'];
const BOOT_W: Record<Impact, number> = { High: 4.5, Medium: 2, Low: 0.8 };
let BYID: Record<string, Target> = {};
const sum = (a: number[]) => a.reduce((t, v) => t + v, 0);
// Category order and colors from the design.
const CAT_META = [
  { id: 'dev', name: 'Developer caches', short: 'Dev caches', tc: 'tc1' },
  { id: 'gpu', name: 'GPU & games', short: 'GPU & games', tc: 'tc2' },
  { id: 'left', name: 'Leftovers & old files', short: 'Leftovers', tc: 'tc3' },
  { id: 'sys', name: 'Windows system', short: 'System', tc: 'tc4' },
  { id: 'apps', name: 'Apps', short: 'Apps', tc: 'tc5' },
  { id: 'web', name: 'Browsers', short: 'Browsers', tc: 'tc6' }
];


// ---------- state ----------
type Cfg = { age: number; bin: boolean; restore: boolean; dry: boolean; weekly: boolean; day: string; time: string; excludes: string[]; hc: boolean; cvd: boolean };
type RunItem = CleanItem;
type Run = { items: RunItem[]; paused: boolean; dry: boolean; freeBefore: number; startedAt: number; est: number; freed?: number; measured?: number; freeAfter?: number; endedAt?: number };

const q = new URLSearchParams(location.search);
const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
const sysReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const S = {
  lang: q.get('lang') || 'en',
  font: q.get('font') || 'golos',
  theme: q.get('theme') || (sysDark ? 'dark' : 'light'),
  palette: q.get('palette') || 'bright',
  seed: q.get('seed') || 'blue',
  chart: q.get('chart') || 'squircle',
  corners: q.get('corners') || 'mixed',
  motion: sysReduced ? 'reduced' : 'full',
  view: q.get('startView') || 'home',
  phase: 'review' as 'review' | 'running' | 'done',
  filter: 'all',
  hover: '',
  ready: false,
  scanning: false,
  scanP: 0,
  scanT: 0,
  data: null as ScanResult | null,
  free: 0,
  ram: 0,
  cpu: 0,
  upMs: 0,
  cleaned: {} as Record<string, boolean>,
  sel: null as Record<string, boolean> | null,
  confirm: false,
  ack: false,
  run: null as Run | null,
  stA: null as Record<string, boolean> | null,
  stC: null as Record<string, boolean> | null,
  adv: false,
  /** Admin tasks queued for the next admin batch (WSL disk compaction). */
  tasks: [] as { id: string; path: string }[],
  canUndo: false,
  stBusy: false,
  toast: '' as string,
  cfg: { age: 3, bin: true, restore: true, dry: false, weekly: false, day: 'SUN', time: '21:00', excludes: [] as string[], hc: !!q.get('hc'), cvd: !!q.get('cvd') } as Cfg
};

let toastTimer = 0;
// Persisted to %APPDATA%\Sweepr\settings.json.
const PERSIST = ['lang', 'font', 'theme', 'palette', 'seed', 'chart', 'corners', 'motion', 'cfg'] as const;
let saveTimer = 0;
function set(patch: Partial<typeof S>) {
  const sched = (c: Cfg) => [c.weekly, c.day, c.time].join('|');
  const weeklyBefore = S.cfg;
  Object.assign(S, patch);
  draw();
  if (PERSIST.some((k) => k in patch)) {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => settingsSave(Object.fromEntries(PERSIST.map((k) => [k, S[k]]))), 300);
  }
  if (sched(S.cfg) !== sched(weeklyBefore)) setWeekly(S.cfg.weekly, S.cfg.day, S.cfg.time).catch(() => set({ cfg: { ...S.cfg, weekly: weeklyBefore.weekly, day: weeklyBefore.day, time: weeklyBefore.time } }));
  if (S.cfg.excludes !== weeklyBefore.excludes) doScan();
}
async function loadSettings() {
  const saved = await settingsLoad();
  if (!saved) return; // first run: system theme and reduced-motion preference
  const patch: Record<string, unknown> = {};
  for (const k of PERSIST) if (saved[k] != null && !q.get(k)) patch[k] = k === 'cfg' ? { ...S.cfg, ...(saved.cfg as object) } : saved[k];
  Object.assign(S, patch);
  if (S.cfg.weekly) setWeekly(true, S.cfg.day, S.cfg.time); // re-create the task if it was removed
}
function toast(key: string) {
  clearTimeout(toastTimer);
  set({ toast: key });
  toastTimer = window.setTimeout(() => set({ toast: '' }), 2600);
}

// ---------- i18n / format ----------
function tr(key: string, vars?: Record<string, string | number>) {
  const L = UI[S.lang] || UI.en;
  let str = L[key] ?? UI.en[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) str = str.split('{' + k + '}').join(String(vars[k]));
  return str;
}
const dt = (s: string) => DATA[S.lang]?.[s] || s;
function num(v: number, digits = 1) {
  return v.toLocaleString(LOCALE[S.lang] || 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmt(bytes: number) {
  const gb = bytes / 2 ** 30;
  if (gb >= 1) return num(gb) + ' ' + tr('GB');
  if (gb > 0) return Math.max(1, Math.round(gb * 1024)) + ' ' + tr('MB');
  return '0 ' + tr('B');
}

// ---------- selection / startup helpers ----------
function defSel(cleaned: Record<string, boolean>) {
  const o: Record<string, boolean> = {};
  for (const id in BYID) if (BYID[id].risk === 'safe' && !cleaned[id] && BYID[id].size > 0) o[id] = true;
  return o;
}
const startupApps = () => S.data?.startup || [];
const st0 = () => Object.fromEntries(startupApps().map((a) => [a.id, a.enabled]));
const boot = (o: Record<string, boolean>) => Math.round(14 + sum(startupApps().filter((a) => o[a.id]).map((a) => BOOT_W[a.impact])));
const nm = (t: Target) => (t.nameKey ? tr(t.nameKey, { app: t.app || '' }) : dt(t.name));
const noteOf = (t: Target) => (t.noteKey ? tr(t.noteKey, { n: t.days ?? 0 }) : t.note ? dt(t.note) : '');

// ---------- clean run ----------
const synth = (id: string, name: string, display: string, size: number): Target =>
  ({ id, cat: 'sys', name, display, size, files: 0, risk: id === 'restore' ? 'safe' : 'low', admin: true, bin: false });
BYID.restore = synth('restore', 'Restore point', '', 0);

async function startRun(picked: string[]) {
  const dry = S.cfg.dry;
  const taskIds = dry ? [] : S.tasks.map((t) => t.id);
  const needsAdmin = !dry && (picked.some((id) => BYID[id]?.admin) || taskIds.length > 0);
  const ids = [...(needsAdmin && S.cfg.restore ? ['restore'] : []), ...picked, ...taskIds];
  const items: RunItem[] = ids.map((id) => ({ id, status: 'queued', p: 0, freed: 0, recycled: false, kept: 0 }));
  set({ phase: 'running', confirm: false, ack: false, view: 'review',
    run: { items, paused: false, dry, freeBefore: S.free, startedAt: Date.now(), est: sum(ids.map((id) => BYID[id].size)) } });
  const onItem = (it: CleanItem) => {
    if (!S.run) return;
    set({ run: { ...S.run, items: S.run.items.map((x) => (x.id === it.id ? it : x)) } });
  };
  const res = await runClean(ids, { dry, recycle: S.cfg.bin, minAgeDays: S.cfg.age, excludes: S.cfg.excludes }, onItem, BYID, S.free);
  const cleaned = { ...S.cleaned };
  const sel = { ...(S.sel || defSel(cleaned)) };
  if (!dry) res.items.forEach((x) => { if (x.status === 'done') { cleaned[x.id] = true; delete sel[x.id]; } });
  set({
    phase: 'done', cleaned, sel, free: res.freeAfter, tasks: dry ? S.tasks : [],
    run: { ...S.run!, items: res.items, freed: sum(res.items.map((x) => x.freed)), measured: Math.max(0, res.freeAfter - res.freeBefore),
      freeBefore: res.freeBefore, freeAfter: res.freeAfter, endedAt: Date.now() }
  });
}

setTimeout(() => set({ ready: true }), 100);

// ---------- scan + live stats ----------
async function doScan(manual = false) {
  if (S.scanning) return;
  const before = new Set(Object.keys(BYID));
  set({ scanning: true, scanP: 0, hover: '' });
  try {
    const data = await runScan(S.cfg.age, S.cfg.excludes, (p) => set({ scanP: p / 100 }));
    BYID = { ...Object.fromEntries(data.targets.map((t) => [t.id, t])), restore: BYID.restore, ...Object.fromEntries(S.tasks.map((t) => [t.id, BYID[t.id]])) };
    set({ data, free: data.drive.free, upMs: data.uptimeMs, scanT: data.scannedAt, cleaned: {}, sel: null, stA: null, stC: null, canUndo: !!data.undoAvailable });
    if (manual && data.targets.every((t) => before.has(t.id))) toast('tScan');
  } finally {
    set({ scanning: false, scanP: 0 });
  }
}
async function queueDisk(vd: { name: string; path: string; size: number }) {
  const id = await queueCompact(vd.path);
  BYID[id] = synth(id, 'Compact virtual disk', vd.name, 0);
  set({ tasks: [...S.tasks.filter((t) => t.id !== id), { id, path: vd.path }] });
  toast('tAdmin');
}

// ---------- startup apply / undo ----------
async function reloadStartup(res: Applied, okToast: string) {
  const startup = await startupList();
  set({ data: S.data && { ...S.data, startup }, stA: null, stC: null, canUndo: res.undoAvailable, stBusy: false });
  toast(res.failed.length ? 'tNotApplied' : okToast);
}
async function applyStartup() {
  const stA = S.stA || st0();
  const stC = S.stC || st0();
  const changes = Object.keys(stC).filter((k) => stC[k] !== stA[k]).map((id) => ({ id, enabled: stC[id] }));
  set({ stBusy: true });
  reloadStartup(await startupApply(changes), 'tApplied');
}
async function undoStartup() {
  set({ stBusy: true });
  reloadStartup(await startupUndo(), 'tUndone');
}

async function refreshLive() {
  const l = await liveStats();
  set({ ram: l.ramUsed / 2 ** 30, cpu: l.cpu, upMs: l.uptimeMs });
}
setInterval(refreshLive, 4000);
refreshLive();

// ---------- slider direction ----------
// The leading edge of the thumb moves first and the trailing edge follows, so it stretches like a rubber band.
const segPrev = new Map<string, { i: number; dir: string }>();
function segDir(key: string, i: number) {
  const p = segPrev.get(key);
  const dir = !p || p.i === i ? p?.dir || 'r' : i > p.i ? 'r' : 'l';
  segPrev.set(key, { i, dir });
  return dir;
}

// ---------- window drag ----------
// Drag the window from any spot that is not a control (header, empty areas, text).
const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"], [role="dialog"] .btn';
addEventListener('mousedown', (e) => {
  if (!IN_TAURI || e.button !== 0) return;
  const t = e.target as HTMLElement;
  if (t.closest(INTERACTIVE)) return;
  const sc = t.closest('.scroll') as HTMLElement | null;
  if (sc && e.offsetX >= sc.clientWidth && t === sc) return; // the scrollbar
  getCurrentWindow().startDragging();
});

// ---------- schedule / fonts ----------
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
/** 2024-01-01 was a Monday. */
const dayName = (d: string, style: 'short' | 'long') =>
  new Intl.DateTimeFormat(LOCALE[S.lang] || 'en-US', { weekday: style }).format(new Date(2024, 0, 1 + Math.max(0, DAYS.indexOf(d))));
const FONTS: [string, string][] = [['golos', 'Golos'], ['inter', 'Inter'], ['manrope', 'Manrope'], ['plex', 'IBM Plex']];

// ---------- icons ----------
const ic = (d: string, style = '', cls = 'ic') => svg`<svg class=${cls} viewBox="0 0 24 24" aria-hidden="true" style=${style}><path d=${d}></path></svg>`;
const CHECK = 'M5 12.5l4.5 4.5L19 7.5';
const CHEV_L = 'M15 6l-6 6 6 6';
const CHEV_R = 'M9 6l6 6-6 6';
const cb = (cls: string, label: string, pressed: boolean, onClick: () => void, mixed = false, style = '') => html`
  <button class="cb ${cls}" @click=${onClick} aria-label=${label} aria-pressed=${String(pressed)} style=${style}><span class="box">${ic(CHECK, '', 'ic ck')}${mixed ? ic('M6.5 12h11', '', 'ic mx') : nothing}</span></button>`;
const tg = (on: boolean, label: string, onClick: () => void) => html`
  <button class="tg ${on ? 'on' : ''}" @click=${onClick} aria-label=${label} aria-pressed=${String(on)}><i></i></button>`;
const header = (back: () => void, backLabel: string, title: string, right: unknown = html`<span></span>`) => html`
  <div data-tauri-drag-region style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 12px 12px 8px">
    <button class="back" @click=${back} style="justify-self: start">${ic(CHEV_L)}${backLabel}</button>
    <span data-tauri-drag-region style="font-size: 15px; font-weight: 600">${title}</span>
    ${right}
  </div>`;

// ---------- view ----------
function view() {
  const { cleaned, scanning, ready, hover, phase, filter, run, theme, chart, corners } = S;
  const cfg = S.cfg;
  const drv = S.data?.drive || { letter: 'C', total: 1, free: 0 };
  const sel = S.sel || defSel(cleaned);
  const RISK: Record<string, [string, string]> = { safe: [tr('rSafe'), 'r-safe'], low: [tr('rLow'), 'r-low'], medium: [tr('rMed'), 'r-med'], high: [tr('rHigh'), 'r-high'] };

  const cats = CAT_META.map((c) => {
    const items = (S.data?.targets || []).filter((it) => it.cat === c.id && !cleaned[it.id]);
    return { c, items, total: sum(items.map((it) => it.size)), selTotal: sum(items.filter((it) => sel[it.id]).map((it) => it.size)) };
  });
  const grand = sum(cats.map((x) => x.total));
  const maxCat = Math.max(...cats.map((x) => x.total), 1);

  // ring
  const GAP = corners === 'round' ? 3.6 : 0.9;
  let acc = 0;
  const ring = cats.map((x) => {
    const frac = grand > 0 ? (x.total / grand) * 100 : 0;
    const vis = frac > GAP && !scanning;
    const r = {
      dash: (ready && vis ? (frac - GAP).toFixed(2) : '0.01') + ' 100',
      off: (-(acc + GAP / 2)).toFixed(2),
      cls: x.c.tc + (!vis || !ready ? ' gone' : '') + (hover && hover !== x.c.id ? ' dim' : '')
    };
    acc += frac;
    return r;
  });

  // waffle: 100 cells, largest remainder
  const raw = cats.map((x) => (grand > 0 ? (x.total / grand) * 100 : 0));
  const base = raw.map((v) => Math.floor(v));
  let rest = 100 - sum(base);
  raw.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r).forEach((o) => { if (rest > 0 && grand > 0) { base[o.i]++; rest--; } });
  const cells: { cls: string; d: number }[] = [];
  cats.forEach((x, i) => { for (let k = 0; k < base[i]; k++) cells.push({ cls: x.c.tc + (hover && hover !== x.c.id ? ' dim' : ''), d: cells.length * 6 }); });
  while (cells.length < 100) cells.push({ cls: 'tcN dim', d: cells.length * 6 });

  const hv = cats.find((x) => x.c.id === hover);
  let center: { big: string; unit: string };
  if (scanning) center = { big: Math.round(S.scanP * 100) + '%', unit: tr('scanning') };
  else if (hv) {
    const g = hv.total / 2 ** 30;
    center = { big: g >= 1 ? num(g) : String(Math.round(g * 1024)), unit: (g >= 1 ? tr('GB') : tr('MB')) + ' · ' + dt(hv.c.short) };
  } else center = { big: num(grand / 2 ** 30), unit: tr('canFreeGB', { u: tr('GB') }) };
  const chartLabel = center.big + ' ' + center.unit;

  const openReview = () => set({ view: 'review', phase: phase === 'done' ? 'review' : phase, filter: 'all', hover: '' });
  const legendRow = (x: (typeof cats)[number], bars = false) => {
    const dim = hover && hover !== x.c.id ? 'dim' : '';
    const enter = () => set({ hover: x.c.id });
    const leave = () => set({ hover: '' });
    if (bars) {
      const pct = ready && !scanning ? Math.max(1, (x.total / maxCat) * 100).toFixed(1) : '0';
      return html`<button class="lrow ${dim}" @click=${openReview} @mouseenter=${enter} @mouseleave=${leave} @focus=${enter} @blur=${leave} style="gap: 12px">
        <span style="width: 92px; flex: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${dt(x.c.short)}</span>
        <span style="flex: 1; min-width: 0; display: flex; align-items: center"><span class="hbar ${x.c.tc}" style="width: ${pct}%"></span></span>
        <span class="num t2" style="width: 58px; text-align: right">${fmt(x.total)}</span></button>`;
    }
    return html`<button class="lrow ${dim}" @click=${openReview} @mouseenter=${enter} @mouseleave=${leave} @focus=${enter} @blur=${leave}>
      <span class="key ${x.c.tc}"></span>
      <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${dt(x.c.short)}</span>
      <span class="num t2">${fmt(x.total)}</span></button>`;
  };
  const legend = (bars = false) => cats.map((x) => legendRow(x, bars));
  const bigNum = html`<div style="padding-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis"><span class="num" style="font-size: 28px; font-weight: 600; letter-spacing: -0.02em">${center.big}</span> <span class="t3" style="font-size: 12px">${center.unit}</span></div>`;

  // drive
  const pf = S.free / drv.total;
  const drive = {
    freeTxt: S.data ? tr('freeOf', { a: fmt(S.free), b: fmt(drv.total) }) : '', junkTxt: S.data ? tr('canGo', { a: fmt(grand) }) : '',
    usedPct: !S.data ? '0' : Math.max(0, ((drv.total - S.free - grand) / drv.total) * 100).toFixed(1), junkPct: ((grand / drv.total) * 100).toFixed(1),
    state: !S.data ? '' : pf < 0.15 ? tr('low') : pf < 0.2 ? tr('tight') : tr('healthy')
  };
  const upDays = Math.floor(S.upMs / 86400000);
  const pendingReboot = !!S.data?.pendingReboot;
  const vd = S.data?.vdisks[0];

  // startup
  const stA = S.stA || st0();
  const stC = S.stC || st0();
  const pend = Object.keys(stC).filter((k) => stC[k] !== stA[k]).length;
  const heavyOn = startupApps().filter((a) => stA[a.id] && a.impact !== 'Low').length;
  const tips: { icon: string; title: string; sub: string; fn: () => void }[] = [];
  if (heavyOn > 0) tips.push({ icon: 'M12 3.5v7.5 M7 6.5a7.5 7.5 0 1 0 10 0', title: tr('tipStartup', { n: heavyOn }), sub: tr('tipStartupSub', { n: boot(stA) - 16 }), fn: () => set({ view: 'startup' }) });
  if (upDays >= 7 || pendingReboot) tips.push({ icon: 'M20 11a8 8 0 1 1-2.3-5.7 M20 4v4h-4', title: tr('tipRestart'), sub: tr('tipRestartSub', { n: upDays }) + (pendingReboot ? tr('tipUpd') : ''), fn: () => toast('tRemind') });
  if (vd && vd.size >= 4 * 2 ** 30 && !S.tasks.some((t) => t.path === vd.path)) tips.push({ icon: 'M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M3 13h18', title: tr('tipWsl'), sub: tr('tipWslSub', { x: fmt(vd.size) }), fn: () => queueDisk(vd) });

  const quickIds = Object.keys(defSel(cleaned));
  const quickSize = sum(quickIds.map((id) => BYID[id].size));
  const scanAge = Math.floor((Date.now() - S.scanT) / 60000);
  const scanInfo = (scanning ? tr('scanningPct', { n: Math.round(S.scanP * 100) }) : scanAge < 1 ? tr('scannedNow') : tr('scannedAgo', { n: scanAge }))
    + ' · ' + tr('placesN', { n: sum(cats.map((x) => x.items.length)) });

  // review
  const counts: Record<string, number> = { all: 0, safe: 0, low: 0, medium: 0, high: 0 };
  cats.forEach((x) => x.items.forEach((it) => { counts.all++; counts[it.risk]++; }));
  const filters = ([['all', tr('fAll')], ['safe', tr('rSafe')], ['low', tr('rLow')], ['medium', tr('rMed')], ['high', tr('rHigh')]] as const)
    .filter((f) => f[0] === 'all' || counts[f[0]] > 0);
  const toggleSel = (ids: string[], on: boolean) => {
    const nx = { ...(S.sel || sel) };
    ids.forEach((id) => { if (on) nx[id] = true; else delete nx[id]; });
    set({ sel: nx });
  };
  const groups = cats.filter((x) => x.items.length).map((x) => {
    const shown = x.items.filter((it) => filter === 'all' || it.risk === filter);
    const nSel = x.items.filter((it) => sel[it.id]).length;
    return { x, shown, nSel, allOn: nSel === x.items.length };
  }).filter((g) => g.shown.length);
  const selIds = Object.keys(sel).filter((id) => sel[id] && !cleaned[id] && BYID[id]);
  const selSize = sum(selIds.map((id) => BYID[id].size));
  const binN = cfg.bin ? selIds.filter((id) => BYID[id].bin).length : 0;
  const adminN = selIds.filter((id) => BYID[id].admin).length + S.tasks.length;
  const risky = selIds.filter((id) => BYID[id].risk === 'medium' || BYID[id].risk === 'high');
  const facts = [tr('fCaches')];
  if (binN) facts.push(tr('fBin', { n: binN }));
  if (adminN) facts.push(tr('fAdmin', { n: adminN }) + (cfg.restore && !cfg.dry ? tr('fRestore') : ''));
  if (cfg.dry) facts.push(tr('fDry'));
  const blocked = risky.length > 0 && !S.ack;

  const setCfg = (k: keyof Cfg, v: number | boolean | string | string[]) => set({ cfg: { ...S.cfg, [k]: v } });
  const tgl = (k: keyof Cfg, label: string, sub: string) => html`
    <div style="display: flex; align-items: center; gap: 12px; min-height: 56px; border-bottom: 1px solid var(--sep)">
      <div style="flex: 1; min-width: 0"><div style="font-size: 13px">${tr(label)}</div><div class="t3" style="font-size: 12px">${tr(sub)}</div></div>
      ${tg(!!cfg[k], tr(label), () => setCfg(k, !cfg[k]))}
    </div>`;
  const seg = (opts: [string, string][], cur: string | number, pick: (v: string) => void, lang = false) => {
    const i = Math.max(0, opts.findIndex(([v]) => String(cur) === v));
    return html`
    <div class="seg slide" data-dir=${segDir(opts.map((o) => o[0]).join('|'), i)} style="--n: ${opts.length}; --i: ${i}"><i class="thumb"></i>${opts.map(([v, label]) => html`<button class=${String(cur) === v ? 'on' : ''} @click=${() => pick(v)} aria-pressed=${String(String(cur) === v)} lang=${lang ? v : nothing}>${label}</button>`)}</div>`;
  };

  const rootCls = 'f-' + S.font + ' th-' + theme + ' pal-' + S.palette + ' seed-' + S.seed + ' cn-' + corners + (S.motion === 'reduced' ? ' reduced' : '') + (cfg.hc ? ' hc' : '') + (cfg.cvd ? ' cvd' : '');
  const logoHref = theme === 'dark' ? '#lgIconDark' : '#lgIcon';
  const logoHrefSmall = theme === 'dark' ? '#lgIconSDark' : '#lgIconS';

  // ----- screens -----
  const home = () => html`
  <div class="view" style="flex: 1; display: flex; flex-direction: column; min-height: 0">
    <div data-tauri-drag-region style="display: flex; align-items: center; gap: 12px; padding: 16px 16px 0">
      <svg width="28" height="28" viewBox="0 0 256 256" aria-hidden="true" style="flex: none; overflow: visible"><use href=${logoHrefSmall}></use></svg>
      <div data-tauri-drag-region style="flex: 1; min-width: 0; font-size: 15px; font-weight: 600; line-height: 1">Sweepr</div>
      <button class="ib" @click=${() => doScan(true)} aria-label=${tr('rescan')} title=${tr('rescan')}>${ic('M20 11a8 8 0 0 0-14.6-4.4 M4.5 3.5v3.6h3.6 M4 13a8 8 0 0 0 14.6 4.4 M19.5 20.5v-3.6h-3.6', scanning ? 'animation: spin .8s linear infinite' : '')}</button>
      <button class="ib" @click=${() => set({ view: 'settings' })} aria-label=${tr('settings')} title=${tr('settings')}>${ic('M12 9.2a2.8 2.8 0 1 0 0 5.6a2.8 2.8 0 1 0 0-5.6z M10.3 3.5h3.4l.5 2.3 1.6.9 2.2-.8 1.7 2.9-1.7 1.6v1.8l1.7 1.6-1.7 2.9-2.2-.8-1.6.9-.5 2.3h-3.4l-.5-2.3-1.6-.9-2.2.8-1.7-2.9 1.7-1.6v-1.8L4.3 8.8 6 5.9l2.2.8 1.6-.9z', 'width: 20px; height: 20px')}</button>
      <button class="ib" @click=${() => IN_TAURI && getCurrentWindow().minimize()} aria-label=${tr('minimize')} title=${tr('minimize')}>${ic('M6 12h12')}</button>
      <button class="ib" @click=${() => (IN_TAURI ? getCurrentWindow().hide() : window.close())} aria-label=${tr('close')} title=${tr('close')}>${ic('M5.5 5.5l13 13 M18.5 5.5l-13 13')}</button>
    </div>
    <div class="scroll" style="flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 16px; padding: 16px">

    ${chart === 'squircle' || chart === 'round' ? html`
    <div style="display: flex; align-items: center; gap: 16px">
      <div style="position: relative; width: 160px; height: 160px; flex: none">
        <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label=${chartLabel} style="display: block">
          <path class="rt" d=${chart === 'round' ? CIRCLE : SQ}></path>
          ${ring.map((r) => svg`<path class="rs ${r.cls}" d=${chart === 'round' ? CIRCLE : SQ} pathLength="100" style="stroke-dasharray: ${r.dash}; stroke-dashoffset: ${r.off}"></path>`)}
        </svg>
        <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 24px">
          <span class="num" style="font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1">${center.big}</span>
          <span class="t3" style="font-size: 12px; line-height: 1.3">${center.unit}</span>
        </div>
      </div>
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0">${legend()}</div>
    </div>` : nothing}

    ${chart === 'waffle' ? html`
    <div style="display: flex; align-items: center; gap: 16px">
      <div class="wf" role="img" aria-label=${chartLabel} style="flex: none">${cells.map((cl) => html`<i class=${cl.cls} style="animation-delay: ${cl.d}ms"></i>`)}</div>
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0">${bigNum}${legend()}</div>
    </div>` : nothing}

    ${chart === 'bars' ? html`<div role="img" aria-label=${chartLabel} style="display: flex; flex-direction: column; gap: 0">${bigNum}${legend(true)}</div>` : nothing}

    <div style="display: flex; flex-direction: column; gap: 8px">
      <button class="btn btn-p num" @click=${() => set({ view: 'review', phase: phase === 'done' ? 'review' : phase })} ?disabled=${grand <= 0 || scanning} style="width: 100%">${scanning ? tr('scanningPct', { n: Math.round(S.scanP * 100) }) : tr('reviewClean')}</button>
      <button class="btn btn-s num" @click=${() => set({ view: 'review', phase: 'review', sel: defSel(cleaned), confirm: true, ack: false })} ?disabled=${quickSize <= 0 || scanning} style="width: 100%">${tr('quickClean', { x: fmt(quickSize) })}</button>
      <div class="t3 num" role="status" style="font-size: 12px; text-align: center">${scanInfo}</div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px">
      <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px">
        <span style="font-size: 13px; font-weight: 600">${tr('disk', { d: drv.letter })}</span>
        <span class="t2" style="font-size: 12px">${drive.state}</span>
      </div>
      <div class="bar" role="img" aria-label=${drive.freeTxt} style="height: 6px"><i style="width: ${drive.usedPct}%; background: var(--text3)"></i><i style="width: ${drive.junkPct}%"></i></div>
      <div class="t2 num" style="font-size: 12px; display: flex; justify-content: space-between; gap: 8px"><span>${drive.freeTxt}</span><span>${drive.junkTxt}</span></div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--sep); border-bottom: 1px solid var(--sep)">
      <div style="padding: 12px 0; display: flex; flex-direction: column; gap: 2px"><span class="t3" style="font-size: 12px">${tr('memory')}</span><span class="num" style="font-size: 15px; font-weight: 600">${num(S.ram)} <span class="t3" style="font-size: 12px; font-weight: 400">${tr('GB')}</span></span></div>
      <div style="padding: 12px 0 12px 12px; border-left: 1px solid var(--sep); display: flex; flex-direction: column; gap: 2px"><span class="t3" style="font-size: 12px">${tr('cpu')}</span><span class="num" style="font-size: 15px; font-weight: 600">${Math.round(S.cpu)} <span class="t3" style="font-size: 12px; font-weight: 400">%</span></span></div>
      <div style="padding: 12px 0 12px 12px; border-left: 1px solid var(--sep); display: flex; flex-direction: column; gap: 2px"><span class="t3" style="font-size: 12px">${tr('uptime')}</span><span class="num" style="font-size: 15px; font-weight: 600">${upDays} <span class="t3" style="font-size: 12px; font-weight: 400">${tr('days')}</span></span></div>
    </div>

    ${tips.length ? html`
    <div style="display: flex; flex-direction: column">
      <span class="cap" style="padding-bottom: 4px">${tr('suggestions')}</span>
      ${tips.map((tp) => html`<button class="prow" @click=${tp.fn}>
        ${ic(tp.icon, '', 'ic t2')}
        <span style="flex: 1; min-width: 0"><span style="display: block; font-size: 13px; font-weight: 500">${tp.title}</span><span class="t2" style="display: block; font-size: 12px">${tp.sub}</span></span>
        ${ic(CHEV_R, 'width: 16px; height: 16px', 'ic t3')}
      </button>`)}
    </div>` : nothing}
    </div>
  </div>`;

  const reviewList = () => html`
  <div style="flex: 1; display: flex; flex-direction: column; min-height: 0">
    <div style="padding: 0 16px 12px">${seg(filters.map((f) => [f[0], f[1]] as [string, string]), filter, (v) => set({ filter: v }))}</div>
    <div class="scroll" style="flex: 1; min-height: 0; padding: 0 16px">
      ${groups.map(({ x, shown, nSel, allOn }) => html`
      <section style="padding-top: 16px">
        <div style="display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--sep)">
          ${cb(allOn ? 'on' : nSel ? 'mixed' : '', dt(x.c.name), allOn, () => toggleSel(x.items.map((it) => it.id), !allOn), true)}
          <span class="key ${x.c.tc}"></span>
          <span class="cap" style="flex: 1; color: var(--text2)">${dt(x.c.name)}</span>
          <span class="num t3" style="font-size: 12px">${fmt(x.selTotal)} / ${fmt(x.total)}</span>
        </div>
        ${shown.map((it) => html`
        <div class="row">
          ${cb(sel[it.id] ? 'on' : '', nm(it), !!sel[it.id], () => toggleSel([it.id], !sel[it.id]), false, 'margin-top: -12px')}
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px">
            <div style="display: flex; justify-content: space-between; gap: 12px"><span style="font-size: 13px; font-weight: 500">${nm(it)}</span><span class="num" style="font-size: 13px; font-weight: 500; white-space: nowrap">${fmt(it.size)}</span></div>
            <div style="display: flex; gap: 12px; flex-wrap: wrap"><span class="risk ${RISK[it.risk][1]}"><i></i>${RISK[it.risk][0]}</span>${it.admin ? html`<span class="risk">${tr('admin')}</span>` : nothing}${it.bin && cfg.bin ? html`<span class="risk">${tr('toBin')}</span>` : nothing}</div>
            ${noteOf(it) ? html`<span class="t2" style="font-size: 12px; line-height: 1.4">${noteOf(it)}</span>` : nothing}
            ${it.lock ? html`<span class="risk r-med" style="white-space: normal; color: var(--text); font-size: 12px"><i></i>${tr('warnRunning', { app: it.lock })}</span>` : nothing}
            <span class="mono" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap" title=${it.display}>${it.display}</span>
          </div>
        </div>`)}
      </section>`)}
      <div style="height: 16px"></div>
    </div>
    <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px 16px; border-top: 1px solid var(--sep)">
      <div style="flex: 1; min-width: 0"><div class="num" style="font-size: 17px; font-weight: 600">${fmt(selSize)}</div><div class="t3 num" style="font-size: 12px">${tr('selected', { a: selIds.length, b: counts.all })}</div></div>
      <button class="btn btn-p" @click=${() => set({ confirm: true, ack: false })} ?disabled=${selIds.length === 0} style="min-width: 120px">${selIds.length ? tr(cfg.dry ? 'previewX' : 'cleanX', { x: fmt(selSize) }) : tr(cfg.dry ? 'preview' : 'clean')}</button>
    </div>
  </div>`;

  const running = (r: Run) => {
    const w = r.items.map((x) => Math.max(0.05, BYID[x.id].size / 2 ** 30));
    let dw = 0;
    r.items.forEach((x, i) => { dw += x.status === 'done' || x.status === 'skipped' ? w[i] : w[i] * x.p; });
    const frac = dw / sum(w);
    const pct = Math.min(100, Math.round(frac * 100));
    const elapsed = (Date.now() - r.startedAt) / 1000;
    const remain = frac > 0.03 ? (elapsed * (1 - frac)) / frac : 0;
    const cur = r.items.find((x) => x.status === 'running');
    const freedNow = sum(r.items.map((x) => x.freed || 0));
    return html`
    <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 8px 16px 16px; gap: 16px">
      <div>
        <div class="num" style="font-size: 44px; font-weight: 600; letter-spacing: -0.03em; line-height: 1">${pct}%</div>
        <div class="t2" role="status" style="font-size: 13px; margin-top: 8px">${r.paused ? tr('paused') : cur ? nm(BYID[cur.id]) : tr('verifying')}</div>
      </div>
      <div class="bar" role="progressbar" aria-valuenow=${pct} aria-valuemin="0" aria-valuemax="100"><i style="width: ${pct}%"></i></div>
      <div class="t3 num" style="font-size: 12px; display: flex; justify-content: space-between; margin-top: -8px"><span>${tr(r.dry ? 'wouldX' : 'freedX', { x: fmt(freedNow) })}</span><span>${r.paused || frac <= 0.03 ? '' : remain > 1.5 ? tr('left', { n: Math.ceil(remain) }) : tr('almost')}</span></div>
      <div class="scroll list" style="flex: 1; min-height: 0">
        ${r.items.map((x) => html`
        <div style="display: flex; align-items: center; gap: 12px; min-height: 40px; border-bottom: 1px solid var(--sep)">
          ${x.status === 'running' ? html`<span class="spin"></span>` : nothing}
          ${x.status === 'done' ? html`<span class="st" style="color: var(--safe)">${ic(CHECK)}</span>` : nothing}
          ${x.status === 'skipped' ? html`<span class="st risk r-med"><i></i></span>` : nothing}
          ${x.status === 'queued' ? html`<span class="st"><span style="width: 5px; height: 5px; background: var(--fill)"></span></span>` : nothing}
          <div style="flex: 1; min-width: 0"><div style="font-size: 13px">${nm(BYID[x.id])}</div>${x.status === 'skipped' || x.status === 'running' ? html`<div class="t3" style="font-size: 12px">${x.status === 'skipped' ? tr(x.reason || '', { app: x.app || '' }) : Math.round(x.p * 100) + '%'}</div>` : nothing}</div>
          <span class="num t2" style="font-size: 13px">${x.status === 'done' ? fmt(x.freed) : fmt(BYID[x.id].size)}</span>
        </div>`)}
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
        <button class="btn btn-s" @click=${() => { if (!S.run) return; const p = !S.run.paused; pauseClean(p); set({ run: { ...S.run, paused: p } }); }}>${r.paused ? tr('resume') : tr('pause')}</button>
        <button class="btn btn-s" @click=${() => cancelClean()}>${tr('cancel')}</button>
      </div>
    </div>`;
  };

  const done = (r: Run) => {
    const skipped = r.items.filter((x) => x.status === 'skipped');
    const locked = skipped.filter((x) => x.reason === 'appRunning');
    const dur = Math.max(1, Math.round(((r.endedAt || Date.now()) - r.startedAt) / 1000));
    const rows = [
      [tr('rCleaned'), tr('aOfB', { a: r.items.filter((x) => x.status === 'done').length, b: r.items.length })],
      [tr('rSkipped'), skipped.length ? skipped.length + ' · ' + tr(skipped[0].reason || '', { app: skipped[0].app || '' }) : tr('none')],
      [tr('recycle'), tr('nItems', { n: r.items.filter((x) => x.status === 'done' && x.recycled).length })],
      [tr('driveC', { d: drv.letter }), tr('freeChange', { a: num(r.freeBefore / 2 ** 30), b: fmt(r.freeAfter || 0) })]
    ];
    return html`
    <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 12px 16px 16px; gap: 16px">
      <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding-top: 12px">
        <span style="width: 52px; height: 52px; display: grid; place-items: center; border-radius: 999px; background: var(--safe); color: #FFFFFF">${ic(CHECK, 'width: 26px; height: 26px; stroke-width: 2.4')}</span>
        <div class="num" style="font-size: 28px; font-weight: 600; letter-spacing: -0.02em">${tr(r.dry ? 'doneWould' : 'doneFreed', { x: fmt(r.dry ? r.freed || 0 : r.measured || 0) })}</div>
        <div class="t2 num" style="font-size: 13px">${tr('doneLine', { a: fmt(r.est), b: fmt(r.measured || 0), n: dur })}</div>
      </div>
      <div class="list">${rows.map(([k, v]) => html`<div style="display: flex; justify-content: space-between; gap: 12px; min-height: 40px; align-items: center; border-bottom: 1px solid var(--sep); font-size: 13px"><span class="t2">${k}</span><span class="num" style="font-weight: 500; text-align: right">${v}</span></div>`)}</div>
      <div style="flex: 1"></div>
      <div style="display: flex; flex-direction: column; gap: 8px">
        ${locked.length ? html`<button class="btn btn-s" @click=${() => startRun(locked.map((x) => x.id))} style="width: 100%">${tr('retryApp', { app: locked[0].app || '' })}</button>` : nothing}
        <button class="btn btn-p" @click=${() => { const real = S.run && !S.run.dry; set({ phase: 'review', view: 'home', run: null }); if (real) doScan(); }} style="width: 100%">${tr('done')}</button>
      </div>
    </div>`;
  };

  const review = () => html`
  <div class="view" style="flex: 1; display: flex; flex-direction: column; min-height: 0">
    ${header(() => set(phase === 'done' ? { view: 'home', phase: 'review', run: null } : { view: 'home' }), phase === 'running' ? tr('hide') : tr('back'),
      phase === 'running' ? tr(run?.dry ? 'previewing' : 'cleaning') : phase === 'done' ? tr('report') : tr('review'),
      phase === 'review' ? html`<button class="btn btn-t" @click=${() => set({ sel: defSel(cleaned) })} style="justify-self: end; font-size: 13px; max-width: 100%; overflow: hidden; text-overflow: ellipsis">${tr('safeOnly')}</button>` : html`<span></span>`)}
    ${phase === 'review' ? reviewList() : nothing}
    ${phase === 'running' && run ? running(run) : nothing}
    ${phase === 'done' && run ? done(run) : nothing}
  </div>`;

  const bNow = boot(stA), bNext = boot(stC);
  const startup = () => html`
  <div class="view" style="flex: 1; display: flex; flex-direction: column; min-height: 0">
    ${header(() => set({ view: 'home' }), tr('back'), tr('startup'))}
    <div style="padding: 4px 16px 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px">
      <div><div class="t3" style="font-size: 12px">${tr('bootNow')}</div><div class="num" style="font-size: 28px; font-weight: 600">${tr('sec', { n: bNow })}</div><div class="bar" style="margin-top: 8px"><i style="width: ${((bNow / 40) * 100).toFixed(1)}%; background: var(--text3)"></i></div></div>
      <div><div class="t3" style="font-size: 12px">${tr('afterApply')}</div><div class="num" style="font-size: 28px; font-weight: 600; color: var(--accent-text)">${tr('sec', { n: bNext })}</div><div class="bar" style="margin-top: 8px"><i style="width: ${((bNext / 40) * 100).toFixed(1)}%"></i></div></div>
    </div>
    <div class="scroll list" style="flex: 1; min-height: 0; margin: 0 16px">
      ${startupApps().map((a) => html`
      <div style="display: flex; align-items: center; gap: 12px; min-height: 52px; border-bottom: 1px solid var(--sep)">
        <div style="flex: 1; min-width: 0"><div style="font-size: 13px; font-weight: 500">${dt(a.name)}</div><div style="display: flex; gap: 12px"><span class="t3" style="font-size: 12px">${tr(a.impact === 'High' ? 'iHigh' : a.impact === 'Medium' ? 'iMed' : 'iLow')}</span>${a.admin ? html`<span class="t3" style="font-size: 12px">${tr('admin')}</span>` : nothing}${stC[a.id] !== stA[a.id] ? html`<span class="t2" style="font-size: 12px; color: var(--accent-text)">${tr('changed')}</span>` : nothing}</div></div>
        ${tg(!!stC[a.id], dt(a.name), () => set({ stC: { ...stC, [a.id]: !stC[a.id] } }))}
      </div>`)}
    </div>
    <div style="display: flex; gap: 8px; padding: 12px 16px 16px; border-top: 1px solid var(--sep)">
      <button class="btn btn-s" @click=${pend ? () => set({ stC: { ...stA } }) : undoStartup} ?disabled=${(pend === 0 && !S.canUndo) || S.stBusy} style="flex: 1">${pend || !S.canUndo ? tr('discard') : tr('undo')}</button>
      <button class="btn btn-p" @click=${applyStartup} ?disabled=${pend === 0 || S.stBusy} style="flex: 2">${pend ? tr('applyN', { n: pend }) : tr('noChanges')}</button>
    </div>
  </div>`;

  const settings = () => html`
  <div class="view" style="flex: 1; display: flex; flex-direction: column; min-height: 0">
    ${header(() => set({ view: 'home' }), tr('back'), tr('settings'))}
    <div class="scroll" style="flex: 1; min-height: 0; padding: 8px 16px 24px; display: flex; flex-direction: column; gap: 32px">
      <div style="display: flex; flex-direction: column; gap: 16px">
        <span class="cap" style="margin-bottom: -6px">${tr('look')}</span>
        <div class="fld"><span class="fl">${tr('language')}</span>${seg(LANGS as [string, string][], S.lang, (v) => set({ lang: v }), true)}</div>
        <div class="fld"><span class="fl">${tr('font')}</span>${seg(FONTS, S.font, (v) => set({ font: v }))}</div>
        <div class="fld"><span class="fl">${tr('theme')}</span>${seg([['dark', tr('dark')], ['light', tr('light')]], theme, (v) => set({ theme: v }))}</div>
        <div class="fld"><span class="fl">${tr('accent')}</span>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; padding: 2px">
            ${SEEDS.map((x) => html`<button class="acc-sw seed-${x}" @click=${() => set({ seed: x })} aria-label=${tr(x)} aria-pressed=${String(S.seed === x)} title=${tr(x)} style="width: 32px; height: 32px; padding: 0; border: 0; border-radius: var(--r-ctl); cursor: pointer; box-shadow: ${S.seed === x ? '0 0 0 2px var(--bg), 0 0 0 4px var(--text)' : 'none'}"></button>`)}
          </div></div>
        <div class="fld"><span class="fl">${tr('palette')}</span>
          <div class="list">
            ${[['bright', 'bright'], ['pastel', 'pastel'], ['mono', 'bw']].map(([p, k]) => html`
            <button class="prow pal-${p}" @click=${() => set({ palette: p })} aria-pressed=${String(S.palette === p)}>
              <span style="display: flex; gap: 2px">${[1, 2, 3, 4, 5, 6].map((i) => html`<i class="key tc${i}" style="width: 14px; height: 14px"></i>`)}</span>
              <span style="flex: 1; font-size: 13px; color: var(--text)">${tr(k)}</span>
              ${S.palette === p ? ic(CHECK, 'color: var(--accent-text); stroke-width: 2.2') : nothing}
            </button>`)}
          </div></div>
        <div class="fld"><span class="fl">${tr('chart')}</span>${seg([['squircle', tr('chSquircle')], ['round', tr('chRound')], ['bars', tr('chBars')], ['waffle', tr('chWaffle')]], chart, (v) => { set({ chart: v, ready: false }); setTimeout(() => set({ ready: true }), 60); })}</div>
      </div>
      <div style="display: flex; flex-direction: column">
        <span class="cap" style="padding-bottom: 8px">${tr('cleaningRules')}</span>
        <div class="list">
          <div style="display: flex; align-items: center; gap: 12px; min-height: 56px; border-bottom: ${cfg.weekly ? '0' : '1px solid var(--sep)'}">
            <div style="flex: 1; min-width: 0"><div style="font-size: 13px">${tr('weekly')}</div><div class="t3" style="font-size: 12px">${dayName(cfg.day, 'long')} ${cfg.time} · ${tr('safeOnlyItems')}</div></div>
            ${tg(cfg.weekly, tr('weekly'), () => setCfg('weekly', !cfg.weekly))}
          </div>
          ${cfg.weekly ? html`
          <div style="display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid var(--sep)">
            ${seg(DAYS.map((d) => [d, dayName(d, 'short')] as [string, string]), cfg.day, (v) => setCfg('day', v))}
            <label style="display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px"><span class="t2">${tr('time')}</span>
              <input type="time" class="tm" .value=${cfg.time} @change=${(e: Event) => { const v = (e.target as HTMLInputElement).value; if (/^\d\d:\d\d$/.test(v)) setCfg('time', v); }}></label>
          </div>` : nothing}
          ${tgl('bin', 'binOpt', 'binOptSub')}
          <button class="prow" @click=${() => set({ adv: !S.adv })} aria-expanded=${String(S.adv)}>
            <span style="flex: 1; min-width: 0"><span style="display: block; font-size: 13px; font-weight: 500">${tr('advanced')}</span><span class="t3" style="display: block; font-size: 12px">${tr('advSub')}</span></span>
            ${ic(CHEV_R, 'width: 16px; height: 16px; transition: transform .2s; ' + (S.adv ? 'transform: rotate(90deg)' : ''), 'ic t3')}
          </button>
        </div>
        ${S.adv ? html`
        <div class="view" style="display: flex; flex-direction: column; gap: 16px; padding-top: 16px">
          <div class="fld"><span class="fl">${tr('corners')}</span>${seg([['mixed', tr('cnMixed')], ['round', tr('cnRound')], ['sharp', tr('cnSharp')]], corners, (v) => set({ corners: v }))}</div>
          <div class="fld"><span class="fl">${tr('motion')}</span>${seg([['full', tr('smooth')], ['reduced', tr('reduced')]], S.motion, (v) => set({ motion: v }))}</div>
          <div class="fld"><span class="fl">${tr('tempOlder')}</span>${seg([['1', tr('d1')], ['3', tr('d3')], ['7', tr('d7')], ['30', tr('d30')]], cfg.age, (v) => setCfg('age', Number(v)))}</div>
          <div class="list">
            ${tgl('restore', 'restore', 'restoreSub')}
            ${tgl('dry', 'dry', 'drySub')}
            ${tgl('hc', 'hc', 'hcSub')}
            ${tgl('cvd', 'cvd', 'cvdSub')}
          </div>
          <div class="fld"><span class="cap">${tr('excluded')}</span><span class="t3" style="font-size: 12px; margin-top: -4px">${tr('excludedSub')}</span>
            <div class="list">${cfg.excludes.map((p) => html`
              <div style="display: flex; align-items: center; gap: 8px; min-height: 40px; border-bottom: 1px solid var(--sep)">
                <span class="mono" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text2)" title=${p}>${p}</span>
                <button class="ib" style="width: 28px; height: 28px" @click=${() => setCfg('excludes', cfg.excludes.filter((x) => x !== p))} aria-label=${tr('remove') + ' ' + p} title=${tr('remove')}>${ic('M5.5 5.5l13 13 M18.5 5.5l-13 13', 'width: 14px; height: 14px')}</button>
              </div>`)}</div>
            <button class="btn btn-s" style="min-height: 36px; font-size: 13px" @click=${async () => { const d = await pickFolder(); if (d && !cfg.excludes.includes(d)) setCfg('excludes', [...cfg.excludes, d]); }}>${tr('addFolder')}</button>
          </div>
          <div class="fld"><span class="cap">${tr('never')}</span><span class="t2" style="font-size: 13px; line-height: 1.55">${tr('neverList')}</span></div>
        </div>` : nothing}
      </div>
      <div style="display: flex; align-items: center; gap: 12px; padding-top: 16px; border-top: 1px solid var(--sep)">
        <svg width="44" height="44" viewBox="0 0 256 256" aria-hidden="true" style="flex: none; overflow: visible"><use href=${logoHref}></use></svg>
        <div><div style="font-size: 15px; font-weight: 600">Sweepr</div><div class="t3" style="font-size: 12px">${tr('version')}</div></div>
      </div>
    </div>
  </div>`;

  const confirmSheet = () => html`
  <div class="fade" @click=${(e: Event) => { if (e.target === e.currentTarget) set({ confirm: false }); }} style="position: absolute; inset: 0; z-index: 20; background: var(--dim); display: flex; flex-direction: column; justify-content: flex-end">
    <div class="sheet" role="dialog" aria-modal="true" aria-label=${tr(cfg.dry ? 'confPreview' : 'confClean', { x: fmt(selSize) })} style="background: var(--card); border-radius: var(--r-sheet) var(--r-sheet) 0 0; padding: 16px 16px 16px; display: flex; flex-direction: column; gap: 16px">
      <div><div class="num" style="font-size: 17px; font-weight: 600">${tr(cfg.dry ? 'confPreview' : 'confClean', { x: fmt(selSize) })}</div><div class="t2" style="font-size: 13px; margin-top: 2px">${tr('measured')}</div></div>
      <div class="list">${facts.map((f) => html`<div style="display: flex; gap: 12px; align-items: center; min-height: 36px; border-bottom: 1px solid var(--sep); font-size: 13px"><span class="key tcN" style="width: 4px; height: 4px"></span>${f}</div>`)}</div>
      ${risky.length ? html`
      <div style="display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; border-left: 3px solid var(--med); background: var(--fill2)">
        ${risky.map((id) => html`<div style="font-size: 13px; line-height: 1.4"><b style="font-weight: 600">${nm(BYID[id])}</b><span class="t2"> — ${dt(BYID[id].consequence || '')}</span></div>`)}
        <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0 0 12px">
          ${cb(S.ack ? 'on' : '', tr('understand'), S.ack, () => set({ ack: !S.ack }))}
          <span style="font-size: 13px">${tr('understand')}</span>
        </div>
      </div>` : nothing}
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">
        <button class="btn btn-s" @click=${() => set({ confirm: false })}>${tr('cancel')}</button>
        <button class="btn btn-p" @click=${() => startRun(selIds)} ?disabled=${blocked}>${tr(cfg.dry ? 'previewX' : 'cleanX', { x: fmt(selSize) })}</button>
      </div>
    </div>
  </div>`;

  return html`
  <div class="sw ${rootCls}" lang=${S.lang}>
    <svg width="0" height="0" aria-hidden="true" style="position: absolute">${LOGO_DEFS}</svg>
    <div class="win">
      ${S.view === 'home' ? home() : nothing}
      ${S.view === 'review' ? review() : nothing}
      ${S.view === 'startup' ? startup() : nothing}
      ${S.view === 'settings' ? settings() : nothing}
      ${S.confirm ? confirmSheet() : nothing}
      ${S.toast ? html`<div class="fade" role="status" style="position: absolute; left: 16px; right: 16px; bottom: 16px; z-index: 30; display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--text); color: var(--bg); border-radius: var(--r-ctl); font-size: 13px; font-weight: 500">${ic(CHECK, 'width: 16px; height: 16px; stroke-width: 2.2')}${tr(S.toast)}</div>` : nothing}
    </div>
  </div>`;
}

const root = document.getElementById('app')!;
function draw() {
  render(view(), root);
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.confirm) set({ confirm: false }); });
if ('__TAURI_INTERNALS__' in window) document.documentElement.classList.add('tauri');
await loadSettings();
draw();

// Tray menu actions. Quick clean opens the confirm sheet; nothing is deleted without it.
onTray((a) => {
  if (a === 'scan') { set({ view: 'home' }); doScan(true); }
  if (a === 'settings') set({ view: 'settings' });
  if (a === 'quick' && !S.scanning && S.phase !== 'running') set({ view: 'review', phase: 'review', sel: defSel(S.cleaned), confirm: true, ack: false });
});

// Dev-only screenshot states: ?demo=confirm|running|done, ?adv=1
await doScan();
const demo = q.get('demo');
if (q.get('adv')) set({ adv: true });
if (q.get('weekly')) set({ cfg: { ...S.cfg, weekly: true, excludes: ['D:\\Projects\\keep-this', 'C:\\Users\\Me\\Videos'] } });
if (q.get('scroll')) requestAnimationFrame(() => document.querySelectorAll('.scroll').forEach((e) => (e.scrollTop = Number(q.get('scroll')))));
if (demo === 'confirm') set({ view: 'review', sel: { ...defSel({}), owui: true }, confirm: true });
if (demo === 'running') startRun(Object.keys(defSel({})));
if (demo === 'done') await startRun(Object.keys(defSel({})));
