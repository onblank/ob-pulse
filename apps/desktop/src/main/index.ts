import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MonitorService } from '@obpulse/application';
import type { RuntimeId, RuntimePort } from '@obpulse/contracts';
import { RUNTIME_IDS } from '@obpulse/contracts';
import { NodeHostMetrics } from '@obpulse/host-metrics';
import { OllamaRuntime } from '@obpulse/runtime-ollama';
import { LMStudioRuntime } from '@obpulse/runtime-lmstudio';
const here = path.dirname(fileURLToPath(import.meta.url));
const ollama = new OllamaRuntime();
const providers: RuntimePort[] = [ollama, new LMStudioRuntime()];
const service = new MonitorService(
  new Map(providers.map((provider) => [provider.id, provider])),
  new NodeHostMetrics(),
);
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let allowExit = false;
let alwaysOnTop = false;
function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => character.charCodeAt(0) <= 0x1f);
}
function validModel(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 240 ||
    containsControlCharacter(value)
  )
    throw new Error('Invalid model identifier');
  return value;
}
function validRuntime(value: unknown): RuntimeId {
  if (typeof value !== 'string' || !RUNTIME_IDS.includes(value as RuntimeId))
    throw new Error('Unsupported runtime');
  return value as RuntimeId;
}
function registerIPC() {
  ipcMain.handle('pulse:snapshot', () => service.snapshot());
  ipcMain.handle('pulse:runtimes', () => service.runtimes());
  ipcMain.handle('pulse:select-runtime', (_event, id: unknown) =>
    service.useRuntime(validRuntime(id)),
  );
  ipcMain.handle('pulse:start', () => service.start());
  ipcMain.handle('pulse:stop', () => service.stop());
  ipcMain.handle('pulse:load', (_event, id: unknown) => service.load(validModel(id)));
  ipcMain.handle('pulse:unload', (_event, id: unknown) => service.unload(validModel(id)));
  ipcMain.handle('pulse:benchmark', (_event, id: unknown) => service.benchmark(validModel(id)));
  ipcMain.handle('pulse:toggle-top', () => {
    alwaysOnTop = !alwaysOnTop;
    mainWindow?.setAlwaysOnTop(alwaysOnTop);
    refreshMenu();
    return alwaysOnTop;
  });
  ipcMain.handle('pulse:is-on-top', () => alwaysOnTop);
  ipcMain.handle('pulse:hide', () => mainWindow?.hide());
}
function show() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}
function refreshMenu() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open OB-Pulse', click: show },
      {
        label: 'Always on top',
        type: 'checkbox',
        checked: alwaysOnTop,
        click: () => {
          alwaysOnTop = !alwaysOnTop;
          mainWindow?.setAlwaysOnTop(alwaysOnTop);
          refreshMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          allowExit = true;
          app.quit();
        },
      },
    ]),
  );
}
function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  mainWindow = new BrowserWindow({
    width: 420,
    height: 605,
    minWidth: 375,
    minHeight: 485,
    x: Math.max(workArea.x, workArea.x + workArea.width - 445),
    y: workArea.y + 40,
    backgroundColor: '#182332',
    show: false,
    autoHideMenuBar: true,
    title: 'OB-Pulse · Local AI Monitor',
    webPreferences: {
      preload: path.resolve(here, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('close', (event) => {
    if (!allowExit) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  // No remote runtime is ever loaded into the browser; Vite URL is dev-only and loopback.
  if (process.env.OBPULSE_DEV_URL) void mainWindow.loadURL(process.env.OBPULSE_DEV_URL);
  else void mainWindow.loadFile(path.resolve(here, '../renderer/index.html'));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
}
app
  .whenReady()
  .then(() => {
    registerIPC();
    createWindow();
    const trayIcon = nativeImage.createFromPath(path.resolve(here, '../../assets/tray.png'));
    tray = new Tray(trayIcon);
    tray.setToolTip('OB-Pulse — Local AI Monitor');
    tray.on('click', show);
    refreshMenu();
  })
  .catch((error) => {
    console.error('OB-Pulse initialization failed', error);
    app.quit();
  });
app.on('before-quit', () => {
  allowExit = true;
  ollama.stopManagedImmediately();
});
app.on('activate', () => {
  if (mainWindow) show();
  else createWindow();
});
app.on('window-all-closed', () => {
  /* Remain in tray. */
});
