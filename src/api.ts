// Backend calls. Outside Tauri (plain browser, screenshots) the mock scan from the design is used.
import { invoke, Channel } from '@tauri-apps/api/core';
import { mockScan } from './mock';

export type Risk = 'safe' | 'low' | 'medium' | 'high';
export type Impact = 'High' | 'Medium' | 'Low';

export interface Target {
  id: string;
  cat: string;
  name: string;
  nameKey?: string;
  app?: string;
  display: string;
  size: number;
  files: number;
  risk: Risk;
  admin: boolean;
  bin: boolean;
  note?: string;
  noteKey?: string;
  days?: number;
  consequence?: string;
  /** App that locks this target; set only while it runs. */
  lock?: string;
  cmd?: string;
}

export interface StartupApp {
  id: string;
  name: string;
  impact: Impact;
  enabled: boolean;
  admin: boolean;
  command: string;
}

export interface ScanResult {
  scannedAt: number;
  drive: { letter: string; total: number; free: number };
  targets: Target[];
  uptimeMs: number;
  pendingReboot: boolean;
  vdisks: { name: string; path: string; size: number }[];
  startup: StartupApp[];
  /** A startup apply can be undone from the journal. */
  undoAvailable?: boolean;
}

export interface Live {
  ramUsed: number;
  ramTotal: number;
  cpu: number;
  uptimeMs: number;
}

export const IN_TAURI = '__TAURI_INTERNALS__' in window;

export async function scan(minAgeDays: number, excludes: string[], onProgress: (pct: number) => void): Promise<ScanResult> {
  if (!IN_TAURI) {
    for (let p = 0; p <= 100; p += 4) {
      onProgress(p);
      await new Promise((r) => setTimeout(r, 40));
    }
    return mockScan();
  }
  const ch = new Channel<number>();
  ch.onmessage = onProgress;
  return invoke<ScanResult>('scan', { minAgeDays, excludes, onProgress: ch });
}

export interface CleanItem {
  id: string;
  status: 'queued' | 'running' | 'done' | 'skipped';
  p: number;
  freed: number;
  reason?: string;
  app?: string;
  recycled: boolean;
  kept: number;
}

export interface CleanResult {
  freeBefore: number;
  freeAfter: number;
  items: CleanItem[];
  log: string;
}

export interface CleanOpts {
  dry: boolean;
  recycle: boolean;
  minAgeDays: number;
  excludes: string[];
}

export async function clean(ids: string[], o: CleanOpts, onItem: (it: CleanItem) => void, targets: Record<string, Target>, freeBefore: number): Promise<CleanResult> {
  if (!IN_TAURI) return mockClean(ids, o, onItem, targets, freeBefore);
  const ch = new Channel<CleanItem>();
  ch.onmessage = onItem;
  return invoke<CleanResult>('clean', { ids, dry: o.dry, recycle: o.recycle, minAgeDays: o.minAgeDays, excludes: o.excludes, onItem: ch });
}

export const pauseClean = (paused: boolean) => (IN_TAURI ? invoke('clean_pause', { paused }) : ((mock.paused = paused), Promise.resolve()));
export const cancelClean = () => (IN_TAURI ? invoke('clean_cancel') : ((mock.cancel = true), Promise.resolve()));

// Browser-only stand-in with the design's pacing.
const mock = { paused: false, cancel: false };
async function mockClean(ids: string[], o: CleanOpts, onItem: (it: CleanItem) => void, targets: Record<string, Target>, freeBefore: number): Promise<CleanResult> {
  Object.assign(mock, { paused: false, cancel: false });
  const tick = () => new Promise((r) => setTimeout(r, 100));
  const items: CleanItem[] = [];
  for (const id of ids) {
    const t = targets[id];
    const it: CleanItem = { id, status: 'running', p: 0, freed: 0, recycled: false, kept: 0 };
    if (mock.cancel) Object.assign(it, { status: 'skipped', reason: 'cancelled' });
    else if (t.lock) Object.assign(it, { status: 'skipped', reason: 'appRunning', app: t.lock });
    else {
      onItem({ ...it });
      while (it.p < 1 && !mock.cancel) {
        await tick();
        if (mock.paused) continue;
        it.p = Math.min(1, it.p + 0.3 / (1 + (t.size / 2 ** 30) * 0.6));
        onItem({ ...it });
      }
      if (mock.cancel) Object.assign(it, { status: 'skipped', reason: 'cancelled' });
      else Object.assign(it, { status: 'done', freed: t.size * (0.955 + Math.random() * 0.045), recycled: t.bin && o.recycle });
    }
    onItem({ ...it });
    items.push(it);
  }
  const freed = o.dry ? 0 : items.reduce((a, x) => a + (x.recycled ? 0 : x.freed), 0);
  return { freeBefore, freeAfter: freeBefore + freed, items, log: '' };
}

/** Queues a virtual disk (from the last scan) for compaction in the next admin batch. Returns the task id. */
export const queueCompact = (path: string): Promise<string> => (IN_TAURI ? invoke<string>("queue_compact", { path }) : Promise.resolve("task-wsl-0"));

export interface Applied {
  ok: string[];
  failed: string[];
  reason?: string;
  undoAvailable: boolean;
}
let mockStartup = mockScan().startup;
export function startupApply(changes: { id: string; enabled: boolean }[]): Promise<Applied> {
  if (IN_TAURI) return invoke<Applied>("startup_apply", { changes });
  mockStartup = mockStartup.map((a) => ({ ...a, enabled: changes.find((c) => c.id === a.id)?.enabled ?? a.enabled }));
  return Promise.resolve({ ok: changes.map((c) => c.id), failed: [], undoAvailable: true });
}
export function startupUndo(): Promise<Applied> {
  if (IN_TAURI) return invoke<Applied>("startup_undo");
  mockStartup = mockScan().startup;
  return Promise.resolve({ ok: [], failed: [], undoAvailable: false });
}
export const startupList = (): Promise<StartupApp[]> => (IN_TAURI ? invoke<StartupApp[]>("startup_list") : Promise.resolve(mockStartup));

// ---------- settings (%APPDATA%\Sweepr\settings.json), weekly task, tray ----------
export const settingsLoad = (): Promise<Record<string, unknown> | null> => (IN_TAURI ? invoke('settings_load') : Promise.resolve(null));
export const settingsSave = (settings: Record<string, unknown>) => (IN_TAURI ? invoke('settings_save', { settings }) : Promise.resolve());
export const setWeekly = (on: boolean, day: string, time: string) => (IN_TAURI ? invoke('set_weekly', { on, day, time }) : Promise.resolve());
/** Native folder picker; null when cancelled or outside Tauri. */
export async function pickFolder(): Promise<string | null> {
  if (!IN_TAURI) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const dir = await open({ directory: true, multiple: false });
  return typeof dir === 'string' ? dir : null;
}
export async function onTray(fn: (action: string) => void) {
  if (!IN_TAURI) return;
  const { listen } = await import('@tauri-apps/api/event');
  await listen<string>('tray', (e) => fn(e.payload));
}

let mockRam = 18.4 * 2 ** 30;
let mockCpu = 14;
export async function liveStats(): Promise<Live> {
  if (IN_TAURI) return invoke<Live>('live_stats');
  mockRam = Math.min(24 * 2 ** 30, Math.max(14 * 2 ** 30, mockRam + (Math.random() - 0.5) * 0.6 * 2 ** 30));
  mockCpu = Math.min(48, Math.max(4, mockCpu + (Math.random() - 0.5) * 10));
  return { ramUsed: mockRam, ramTotal: 32 * 2 ** 30, cpu: mockCpu, uptimeMs: (9 * 24 + 3) * 3600000 };
}
