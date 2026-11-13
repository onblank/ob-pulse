import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  clipboard,
  ipcMain,
  nativeImage,
  safeStorage,
  screen,
} from 'electron';
import type { Rectangle } from 'electron';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HISTORY_SAMPLE_INTERVAL_MS, MonitorService } from '@obpulse/application';
import type {
  RuntimeId,
  RuntimeCredentialStatus,
  RuntimePort,
  RuntimePreferences,
  WidgetPreferences,
} from '@obpulse/contracts';
import { RUNTIME_IDS } from '@obpulse/contracts';
import { NodeHostMetrics } from '@obpulse/host-metrics';
import { LoopbackInstrumentationBridge } from '@obpulse/instrumentation-http';
import { NodeProcessMetrics } from '@obpulse/process-metrics';
import { LlamaCppRuntime } from '@obpulse/runtime-llamacpp';
import { MlxLmRuntime } from '@obpulse/runtime-mlxlm';
import { OllamaRuntime } from '@obpulse/runtime-ollama';
import { LMStudioRuntime } from '@obpulse/runtime-lmstudio';
import { EncryptedCredentialStore, validApiToken, type SecretCipher } from './credentials.js';
import {
  DEFAULT_WIDGET_PREFERENCES,
  calculateWidgetPosition,
  loadRuntimePreferences,
  loadWidgetPreferences,
  saveRuntimePreferences,
  saveWidgetPreferences,
} from './preferences.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const ollama = new OllamaRuntime();
const lmstudio = new LMStudioRuntime();
const llamacpp = new LlamaCppRuntime();
const mlxlm = new MlxLmRuntime();
const providers: RuntimePort[] = [ollama, lmstudio, llamacpp, mlxlm];
const service = new MonitorService(
  new Map(providers.map((provider) => [provider.id, provider])),
  new NodeHostMetrics(),
  new NodeProcessMetrics(),
);
const instrumentationBridge = new LoopbackInstrumentationBridge((event) =>
  service.ingestInstrumentation(event),
);
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let allowExit = false;
let alwaysOnTop = false;
let windowMode: 'compact' | 'expanded' = 'compact';
let widgetPreferences: WidgetPreferences = DEFAULT_WIDGET_PREFERENCES;
let widgetPreferencesPath: string | null = null;
let runtimePreferences: RuntimePreferences = { enabledRuntimeIds: [...RUNTIME_IDS] };
let runtimePreferencesPath: string | null = null;
let lmStudioCredentialStore: EncryptedCredentialStore | null = null;
let lmStudioCredentialError: string | null = null;
let sampler: NodeJS.Timeout | null = null;
let sampleInFlight = false;
let quitCleanupStarted = false;
let quitCleanupComplete = false;
const WINDOW_SIZES = {
  compact: { width: 360, height: 430, minWidth: 340, minHeight: 400 },
  expanded: { width: 900, height: 680, minWidth: 720, minHeight: 560 },
} as const;
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
function validWindowMode(value: unknown): 'compact' | 'expanded' {
  if (value !== 'compact' && value !== 'expanded') throw new Error('Unsupported window mode');
  return value;
}
function validEnabled(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Enabled state must be boolean');
  return value;
}
function validInstrumentationValue(value: unknown): 'endpoint' | 'token' {
  if (value !== 'endpoint' && value !== 'token')
    throw new Error('Unsupported instrumentation value');
  return value;
}
const secretCipher: SecretCipher = {
  available: async () => {
    if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
    if (process.platform !== 'linux') return true;
    const backend = safeStorage.getSelectedStorageBackend();
    return backend !== 'basic_text' && backend !== 'unknown';
  },
  encrypt: (value) => safeStorage.encryptStringAsync(value),
  decrypt: (value) => safeStorage.decryptStringAsync(value),
};
async function lmStudioCredentialStatus(): Promise<RuntimeCredentialStatus> {
  let secureStorageAvailable = false;
  let storedCredentialPresent = false;
  try {
    [secureStorageAvailable, storedCredentialPresent] = await Promise.all([
      lmStudioCredentialStore?.available() ?? false,
      lmStudioCredentialStore?.exists() ?? false,
    ]);
  } catch {
    lmStudioCredentialError = 'OS-protected credential storage could not be initialized';
  }
  return {
    runtimeId: 'lmstudio',
    secureStorageAvailable,
    configured: lmstudio.hasApiToken(),
    storedCredentialPresent,
    error: lmStudioCredentialError,
  };
}
function applyWindowMode(mode: 'compact' | 'expanded'): void {
  if (!mainWindow) return;
  windowMode = mode;
  const dimensions = WINDOW_SIZES[mode];
  mainWindow.setResizable(mode === 'expanded');
  mainWindow.setMinimumSize(dimensions.minWidth, dimensions.minHeight);
  mainWindow.setSize(dimensions.width, dimensions.height, true);
  mainWindow.setSkipTaskbar(mode === 'compact');
  positionWindow();
  mainWindow.webContents.send('pulse:window-mode-changed', mode);
}
function positionWindow(trayBounds?: Rectangle): void {
  if (!mainWindow) return;
  const size = mainWindow.getSize();
  const width = size[0] ?? WINDOW_SIZES[windowMode].width;
  const height = size[1] ?? WINDOW_SIZES[windowMode].height;
  const effectiveTrayBounds =
    widgetPreferences.position === 'tray' ? (trayBounds ?? tray?.getBounds()) : undefined;
  const display = effectiveTrayBounds
    ? screen.getDisplayNearestPoint({ x: effectiveTrayBounds.x, y: effectiveTrayBounds.y })
    : screen.getDisplayMatching(mainWindow.getBounds());
  const next = calculateWidgetPosition(
    widgetPreferences.position,
    { width, height },
    display.workArea,
    effectiveTrayBounds,
  );
  try {
    mainWindow.setPosition(next.x, next.y, false);
  } catch (error) {
    console.warn('OB-Pulse could not position the widget on this display server', error);
  }
}
function applyWidgetPreferences(): void {
  if (!mainWindow) return;
  try {
    mainWindow.setOpacity(widgetPreferences.opacity);
  } catch (error) {
    console.warn('OB-Pulse could not apply widget opacity on this display server', error);
  }
  positionWindow();
}
async function captureHistory(): Promise<void> {
  if (sampleInFlight) return;
  sampleInFlight = true;
  try {
    await service.captureHistory();
  } catch (error) {
    console.warn('OB-Pulse history sample failed', error);
  } finally {
    sampleInFlight = false;
  }
}
function startSampler(): void {
  if (sampler) return;
  void captureHistory();
  sampler = setInterval(() => void captureHistory(), HISTORY_SAMPLE_INTERVAL_MS);
}
function registerIPC() {
  ipcMain.handle('pulse:snapshot', () => service.snapshot());
  ipcMain.handle('pulse:history', () => service.history());
  ipcMain.handle('pulse:runtimes', () => service.runtimes());
  ipcMain.handle('pulse:runtime-catalog', () => service.runtimeCatalog());
  ipcMain.handle('pulse:runtime-preferences', () => runtimePreferences);
  ipcMain.handle('pulse:set-runtime-preferences', async (_event, value: unknown) => {
    if (!runtimePreferencesPath) throw new Error('Runtime preferences are not ready');
    const saved = await saveRuntimePreferences(runtimePreferencesPath, value);
    service.setEnabledRuntimes(saved.enabledRuntimeIds);
    runtimePreferences = saved;
    return runtimePreferences;
  });
  ipcMain.handle('pulse:lmstudio-credential-status', () => lmStudioCredentialStatus());
  ipcMain.handle('pulse:set-lmstudio-api-token', async (_event, value: unknown) => {
    if (!lmStudioCredentialStore) throw new Error('Credential storage is not ready');
    const token = validApiToken(value);
    await lmStudioCredentialStore.save(token);
    lmstudio.setApiToken(token);
    lmStudioCredentialError = null;
    return lmStudioCredentialStatus();
  });
  ipcMain.handle('pulse:clear-lmstudio-api-token', async () => {
    if (!lmStudioCredentialStore) throw new Error('Credential storage is not ready');
    await lmStudioCredentialStore.clear();
    lmstudio.setApiToken(null);
    lmStudioCredentialError = null;
    return lmStudioCredentialStatus();
  });
  ipcMain.handle('pulse:select-runtime', (_event, id: unknown) =>
    service.useRuntime(validRuntime(id)),
  );
  ipcMain.handle('pulse:start', (_event, id: unknown) => service.start(validRuntime(id)));
  ipcMain.handle('pulse:stop', (_event, id: unknown) => service.stop(validRuntime(id)));
  ipcMain.handle('pulse:take-control', (_event, id: unknown) =>
    service.takeControl(validRuntime(id)),
  );
  ipcMain.handle('pulse:release-control', (_event, id: unknown) =>
    service.releaseControl(validRuntime(id)),
  );
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
  ipcMain.handle('pulse:window-mode', (_event, mode: unknown) => {
    applyWindowMode(validWindowMode(mode));
    return windowMode;
  });
  ipcMain.handle('pulse:get-window-mode', () => windowMode);
  ipcMain.handle('pulse:widget-preferences', () => widgetPreferences);
  ipcMain.handle('pulse:set-widget-preferences', async (_event, value: unknown) => {
    if (!widgetPreferencesPath) throw new Error('Widget preferences are not ready');
    widgetPreferences = await saveWidgetPreferences(widgetPreferencesPath, value);
    applyWidgetPreferences();
    return widgetPreferences;
  });
  ipcMain.handle('pulse:instrumentation-status', () => instrumentationBridge.status());
  ipcMain.handle('pulse:instrumentation-sessions', () => {
    if (!instrumentationBridge.status().enabled) service.clearInstrumentation();
    return service.instrumentationSnapshot();
  });
  ipcMain.handle('pulse:set-instrumentation-enabled', async (_event, enabled: unknown) => {
    if (validEnabled(enabled)) return instrumentationBridge.enable();
    const status = await instrumentationBridge.disable();
    service.clearInstrumentation();
    return status;
  });
  ipcMain.handle('pulse:copy-instrumentation-value', (_event, requestedValue: unknown) => {
    const value = validInstrumentationValue(requestedValue);
    const status = instrumentationBridge.status();
    const text = value === 'endpoint' ? status.endpoint : status.authToken;
    if (!status.enabled || !text) throw new Error('Instrumentation bridge is disabled');
    clipboard.writeText(text);
  });
}
function show(trayBounds?: Rectangle) {
  if (!mainWindow) return;
  positionWindow(trayBounds);
  mainWindow.show();
  mainWindow.focus();
}
function toggleWindow(trayBounds?: Rectangle): void {
  if (!mainWindow) return;
  if (mainWindow.isVisible() && mainWindow.isFocused()) mainWindow.hide();
  else show(trayBounds);
}
function refreshMenu() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open OB-Pulse', click: () => show() },
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
      {
        label: 'Settings…',
        click: () => {
          applyWindowMode('expanded');
          show();
          mainWindow?.webContents.send('pulse:open-settings');
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
async function runPackageSmoke(): Promise<void> {
  const argument = process.argv.find((value) => value.startsWith('--obpulse-package-smoke='));
  if (!argument) return;
  const mode = argument.slice('--obpulse-package-smoke='.length);
  const markerPath = path.join(app.getPath('userData'), 'native-package-upgrade-smoke.json');
  const fail = (message: string) => {
    console.error(`[native-package-smoke] ${message}`);
    process.exitCode = 1;
    app.quit();
  };
  try {
    if (!['baseline', 'upgrade', 'launch'].includes(mode))
      throw new Error(`Unsupported smoke mode: ${mode}`);
    const expectedRuntimeIds = [...RUNTIME_IDS].sort();
    service.setEnabledRuntimes(RUNTIME_IDS);
    const catalogIds = service
      .runtimeCatalog()
      .map((runtime) => runtime.id)
      .sort();
    if (JSON.stringify(catalogIds) !== JSON.stringify(expectedRuntimeIds))
      throw new Error(`Runtime discovery mismatch: ${catalogIds.join(', ')}`);
    if (!mainWindow || !tray || tray.isDestroyed())
      throw new Error('Window or system tray did not initialize');

    const rendererReady = async () =>
      mainWindow?.webContents.executeJavaScript(
        "Boolean(document.querySelector('#root')?.childElementCount) && typeof window.obpulse === 'object'",
      );
    const startedAt = Date.now();
    while (!(await rendererReady())) {
      if (Date.now() - startedAt > 30_000) throw new Error('Renderer did not become ready');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    // Resolve a full snapshot with no required remote service. Adapters only probe their
    // configured loopback endpoints; this guards against startup depending on network access.
    const snapshot = await service.snapshot();
    if (snapshot.runtimes.length !== expectedRuntimeIds.length)
      throw new Error(`Expected four runtime observations, received ${snapshot.runtimes.length}`);

    mainWindow.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible())
      throw new Error('Closing the widget did not leave the app hidden in its tray');
    if (!tray || tray.isDestroyed()) throw new Error('System tray did not survive window close');

    if (mode === 'baseline') {
      await writeFile(
        markerPath,
        JSON.stringify({ version: 1, createdAt: new Date().toISOString() }),
        {
          flag: 'wx',
        },
      );
    } else if (mode === 'upgrade') {
      const marker = JSON.parse(await readFile(markerPath, 'utf8')) as { version?: unknown };
      if (marker.version !== 1) throw new Error('User data marker did not survive app upgrade');
      await unlink(markerPath);
    }
    console.log(`[native-package-smoke] ${mode} passed`);
    app.quit();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
function createWindow() {
  const dimensions = WINDOW_SIZES.compact;
  mainWindow = new BrowserWindow({
    width: dimensions.width,
    height: dimensions.height,
    minWidth: dimensions.minWidth,
    minHeight: dimensions.minHeight,
    backgroundColor: '#182332',
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
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
  mainWindow.once('ready-to-show', () => show());
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
  applyWidgetPreferences();
}
app
  .whenReady()
  .then(async () => {
    widgetPreferencesPath = path.join(app.getPath('userData'), 'widget-preferences.json');
    runtimePreferencesPath = path.join(app.getPath('userData'), 'runtime-preferences.json');
    lmStudioCredentialStore = new EncryptedCredentialStore(
      path.join(app.getPath('userData'), 'lmstudio-api-token.enc.json'),
      secretCipher,
    );
    widgetPreferences = await loadWidgetPreferences(widgetPreferencesPath);
    runtimePreferences = await loadRuntimePreferences(runtimePreferencesPath);
    try {
      lmstudio.setApiToken(await lmStudioCredentialStore.load());
    } catch {
      lmStudioCredentialError = 'Stored LM Studio credential could not be loaded';
      lmstudio.setApiToken(null);
    }
    service.setEnabledRuntimes(runtimePreferences.enabledRuntimeIds);
    registerIPC();
    createWindow();
    if (process.platform === 'darwin') app.dock?.hide();
    const trayIcon = nativeImage.createFromPath(path.resolve(here, '../../assets/tray.png'));
    tray = new Tray(trayIcon);
    tray.setToolTip('OB-Pulse — Local AI Monitor');
    tray.on('click', (_event, bounds) => toggleWindow(bounds));
    refreshMenu();
    startSampler();
    void runPackageSmoke();
  })
  .catch((error) => {
    console.error('OB-Pulse initialization failed', error);
    app.quit();
  });
app.on('before-quit', (event) => {
  allowExit = true;
  if (quitCleanupComplete) return;
  event.preventDefault();
  if (quitCleanupStarted) return;
  quitCleanupStarted = true;
  if (sampler) clearInterval(sampler);
  sampler = null;
  instrumentationBridge.close();
  void service
    .shutdownOwnedOnQuit()
    .catch((error) => console.error('OB-Pulse owned runtime cleanup failed', error))
    .finally(() => {
      quitCleanupComplete = true;
      app.quit();
    });
});
app.on('activate', () => {
  if (mainWindow) show();
  else createWindow();
});
app.on('window-all-closed', () => {
  /* Remain in tray. */
});
