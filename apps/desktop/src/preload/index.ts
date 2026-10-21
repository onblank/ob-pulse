import { contextBridge, ipcRenderer } from 'electron';
const api = {
  snapshot: () => ipcRenderer.invoke('pulse:snapshot'),
  history: () => ipcRenderer.invoke('pulse:history'),
  runtimes: () => ipcRenderer.invoke('pulse:runtimes'),
  selectRuntime: (id: string) => ipcRenderer.invoke('pulse:select-runtime', id),
  start: () => ipcRenderer.invoke('pulse:start'),
  stop: () => ipcRenderer.invoke('pulse:stop'),
  load: (modelId: string) => ipcRenderer.invoke('pulse:load', modelId),
  unload: (modelId: string) => ipcRenderer.invoke('pulse:unload', modelId),
  benchmark: (modelId: string) => ipcRenderer.invoke('pulse:benchmark', modelId),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('pulse:toggle-top'),
  isAlwaysOnTop: () => ipcRenderer.invoke('pulse:is-on-top'),
  hide: () => ipcRenderer.invoke('pulse:hide'),
  setWindowMode: (mode: 'compact' | 'expanded') => ipcRenderer.invoke('pulse:window-mode', mode),
  getWindowMode: () => ipcRenderer.invoke('pulse:get-window-mode'),
  instrumentationStatus: () => ipcRenderer.invoke('pulse:instrumentation-status'),
  instrumentationSessions: () => ipcRenderer.invoke('pulse:instrumentation-sessions'),
  setInstrumentationEnabled: (enabled: boolean) =>
    ipcRenderer.invoke('pulse:set-instrumentation-enabled', enabled),
  copyInstrumentationValue: (value: 'endpoint' | 'token') =>
    ipcRenderer.invoke('pulse:copy-instrumentation-value', value),
};
contextBridge.exposeInMainWorld('obpulse', Object.freeze(api));
