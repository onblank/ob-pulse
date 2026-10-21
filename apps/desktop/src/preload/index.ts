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
};
contextBridge.exposeInMainWorld('obpulse', Object.freeze(api));
