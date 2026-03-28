import { app, BrowserWindow, Tray, screen, ipcMain, nativeImage, Menu } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { discoverAgents } from '../services/agent-tracker.js';
import type { AgentInfo } from '../core/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const NOTCH_PID = join(process.env.HOME ?? '/tmp', '.adhd-dev', 'notch.pid');
function writePid() { try { writeFileSync(NOTCH_PID, String(process.pid)); } catch {} }
function removePid() { try { unlinkSync(NOTCH_PID); } catch {} }

function assetsDir(): string { return join(__dirname, '..', '..', 'assets', 'crayfish'); }
function rendererHtml(): string {
  const p = join(__dirname, 'renderer', 'index.html');
  return existsSync(p) ? p : join(__dirname, '..', '..', 'src', 'notch', 'renderer', 'index.html');
}

function loadSprites(): Record<string, string> {
  const dir = assetsDir();
  const data: Record<string, string> = {};
  for (const lvl of ['baby', 'juvenile', 'adult', 'warrior', 'king'])
    for (const st of ['idle', 'working', 'complete', 'sleeping']) {
      const f = join(dir, `${lvl}_${st}.png`);
      if (existsSync(f)) data[`${lvl}_${st}`] = `data:image/png;base64,${readFileSync(f).toString('base64')}`;
    }
  return data;
}

function makeTrayIcon(agents: AgentInfo[]): Electron.NativeImage {
  const best = agents.length ? agents.reduce((a, b) => b.level > a.level ? b : a, agents[0]) : null;
  const lvl = best ? ['','baby','juvenile','adult','warrior','king'][best.level] ?? 'baby' : 'baby';
  const st = best?.state === 'working' ? 'working' : 'idle';
  const f = join(assetsDir(), `${lvl}_${st}.png`);
  if (existsSync(f)) return nativeImage.createFromPath(f).resize({ width: 18, height: 18 });
  return nativeImage.createEmpty();
}

const PANEL_W = 480, PANEL_H = 520;
let tray: Tray | null = null;
let panel: BrowserWindow | null = null;
let poll: ReturnType<typeof setInterval> | null = null;
let sprites: Record<string, string> = {};
let latestAgents: AgentInfo[] = [];
let lastShowAt = 0;   // debounce blur

function togglePanel() {
  if (!tray || !panel) return;
  if (panel.isVisible()) { panel.hide(); return; }

  const tb = tray.getBounds();
  const { workArea } = screen.getPrimaryDisplay();
  const x = Math.max(workArea.x, Math.min(
    Math.round(tb.x + tb.width / 2 - PANEL_W / 2),
    workArea.x + workArea.width - PANEL_W
  ));
  const y = tb.y + tb.height + 4;

  panel.setPosition(x, y);
  panel.show();
  panel.focus();
  lastShowAt = Date.now();
  sendData();
}

let spritesSent = false;

function sendData() {
  if (!panel || panel.isDestroyed()) return;
  try {
    latestAgents = discoverAgents();
    // Send sprites only once, then just agents
    if (!spritesSent) {
      panel.webContents.send('update', { agents: latestAgents, sprites });
      spritesSent = true;
    } else {
      panel.webContents.send('update', { agents: latestAgents });
    }
    if (tray) {
      tray.setImage(makeTrayIcon(latestAgents));
      const n = latestAgents.length, a = latestAgents.filter(x => x.state === 'working').length;
      tray.setToolTip(n ? `ADHD-Dev — ${n} sessions, ${a} active` : 'ADHD-Dev');
    }
  } catch {}
}

function shutdown() {
  if (poll) clearInterval(poll);
  removePid();
  if (panel) { panel.destroy(); panel = null; }
  if (tray) { tray.destroy(); tray = null; }
  app.quit();
}

ipcMain.on('quit', () => shutdown());
ipcMain.on('hide', () => panel?.hide());
app.on('second-instance', () => togglePanel());
app.dock?.hide();

app.whenReady().then(() => {
  writePid();
  sprites = loadSprites();

  // ── Tray ──
  tray = new Tray(makeTrayIcon([]));
  tray.setToolTip('ADHD-Dev — Crawfish Park');

  // KEY FIX: do NOT use setContextMenu — it hijacks left-click on macOS
  // Instead: left-click → toggle panel, right-click → popup menu manually
  tray.on('click', () => togglePanel());
  tray.on('right-click', () => {
    const menu = Menu.buildFromTemplate([
      { label: 'Open Crawfish Park', click: () => togglePanel() },
      { type: 'separator' },
      { label: 'Quit ADHD-Dev', click: () => shutdown() },
    ]);
    tray?.popUpContextMenu(menu);
  });

  // ── Panel ──
  panel = new BrowserWindow({
    width: PANEL_W, height: PANEL_H,
    show: false, frame: false, transparent: false,
    alwaysOnTop: true, skipTaskbar: true, resizable: false,
    hasShadow: true, fullscreenable: false,
    backgroundColor: '#14161e',
    roundedCorners: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  panel.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  panel.loadFile(rendererHtml());

  // KEY FIX: debounce blur — ignore blur within 500ms of show (prevents instant hide)
  panel.on('blur', () => {
    if (Date.now() - lastShowAt > 500) panel?.hide();
  });
  panel.on('closed', () => { panel = null; });

  // Send data after page loads — try both events for reliability
  const startPolling = () => {
    if (poll) return; // already started
    spritesSent = false;
    sendData();
    poll = setInterval(sendData, 2000);
  };
  panel.webContents.on('did-finish-load', startPolling);
  // Fallback: start after 2s regardless
  setTimeout(startPolling, 2000);
});

app.on('will-quit', () => removePid());
app.on('window-all-closed', (e: Event) => { e.preventDefault(); });
process.on('SIGTERM', () => shutdown());
process.on('SIGINT', () => shutdown());
