// Mock scan from the design (one real PC). Used outside Tauri: browser preview and screenshots.
import type { ScanResult, Target, StartupApp } from './api';

const G = (gb: number) => Math.round(gb * 2 ** 30);
type T = Partial<Target> & Pick<Target, 'id' | 'name' | 'display' | 'size' | 'risk'>;
const t = (cat: string, x: T): Target => ({ cat, files: 1, admin: false, bin: false, ...x });

const TARGETS: Target[] = [
  t('dev', { id: 'yarn', name: 'Yarn v1 cache', display: 'yarn cache clean', size: G(7.2), risk: 'low', note: 'Packages re-download on the next install' }),
  t('dev', { id: 'gocache', name: 'Go build cache', display: 'go clean -cache', size: G(4.8), risk: 'safe' }),
  t('dev', { id: 'npm', name: 'npm cache', display: 'npm cache clean --force', size: G(1.2), risk: 'low' }),
  t('gpu', { id: 'nvdx', name: 'NVIDIA shader cache', display: '%LOCALAPPDATA%\\NVIDIA\\DXCache', size: G(10.9), risk: 'safe', note: 'First launch of each game may stutter briefly' }),
  t('gpu', { id: 'steamweb', name: 'Steam web cache', display: '%LOCALAPPDATA%\\Steam\\htmlcache', size: G(0.7), risk: 'safe', lock: 'Steam' }),
  t('gpu', { id: 'd3d', name: 'DirectX shader cache', display: '%LOCALAPPDATA%\\D3DSCache', size: G(0.3), risk: 'safe' }),
  t('gpu', { id: 'amd', name: 'AMD DX cache', display: '%LOCALAPPDATA%\\AMD\\DxCache', size: G(0.03), risk: 'safe' }),
  t('left', { id: 'owui', name: 'Open WebUI leftovers', nameKey: 'appLeftovers', app: 'Open WebUI', display: '%APPDATA%\\open-webui', size: G(2.3), risk: 'medium', bin: true, noteKey: 'untouched', days: 94, consequence: 'settings and chat history go to the Recycle Bin' }),
  t('left', { id: 'inst', name: 'Old installers', display: 'Downloads\\*.exe, *.msi, *.iso', size: G(0.82), risk: 'medium', bin: true, note: 'Older than 30 days', consequence: 'installers you might reuse go to the Recycle Bin' }),
  t('sys', { id: 'wu', name: 'Windows Update cache', display: 'Windows\\SoftwareDistribution\\Download', size: G(1.12), risk: 'low', admin: true }),
  t('sys', { id: 'thumb', name: 'Thumbnail cache', display: 'Explorer\\thumbcache_*.db', size: G(0.42), risk: 'safe' }),
  t('sys', { id: 'temp', name: 'Temporary files', display: '%TEMP%', size: G(0.31), risk: 'safe', note: 'Open files and folders changed in the last 24 h are kept' }),
  t('sys', { id: 'wer', name: 'Error reports', display: 'ProgramData\\Microsoft\\Windows\\WER', size: G(0.12), risk: 'safe', admin: true }),
  t('sys', { id: 'dumps', name: 'App crash dumps', display: '%LOCALAPPDATA%\\CrashDumps', size: G(0.04), risk: 'safe' }),
  t('apps', { id: 'tg', name: 'Telegram media cache', display: 'Telegram Desktop\\tdata\\user_data', size: G(0.9), risk: 'low', note: 'Media re-downloads when you open old chats' }),
  t('apps', { id: 'discord', name: 'Discord cache', display: '%APPDATA%\\discord\\Cache', size: G(0.46), risk: 'safe' }),
  t('apps', { id: 'vsc', name: 'VS Code old extensions', display: '.vscode\\extensions', size: G(0.31), risk: 'safe' }),
  t('web', { id: 'zen', name: 'Zen browser cache', display: 'zen\\Profiles\\*\\cache2', size: G(0.88), risk: 'safe' }),
  t('web', { id: 'edge', name: 'Edge cache', display: 'Edge\\User Data\\Default\\Cache', size: G(0.54), risk: 'safe' }),
  t('web', { id: 'cookies', name: 'Cookies & history', display: 'Zen, Edge', size: G(0.06), risk: 'medium', note: 'Passwords and bookmarks are never touched', consequence: 'you will be signed out of most websites' })
];

const app = (id: string, name: string, impact: StartupApp['impact']): StartupApp => ({ id, name, impact, enabled: true, admin: false, command: '' });
const STARTUP: StartupApp[] = [
  app('steam', 'Steam', 'High'), app('epic', 'Epic Games Launcher', 'High'), app('docker', 'Docker Desktop', 'High'),
  app('edge', 'Microsoft Edge auto-launch', 'Medium'), app('roblox', 'Roblox Player', 'Medium'), app('discord', 'Discord', 'Medium'),
  app('clip', 'Clipdiary', 'Low'), app('disko', 'Disk-O', 'Low'), app('tgram', 'Telegram', 'Low')
];

export function mockScan(): ScanResult {
  return {
    scannedAt: Date.now() - 120000,
    drive: { letter: 'C', total: G(475.9), free: G(75.4) },
    targets: TARGETS,
    uptimeMs: (9 * 24 + 3) * 3600000,
    pendingReboot: true,
    vdisks: [],
    startup: STARTUP
  };
}
