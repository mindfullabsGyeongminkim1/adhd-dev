import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  onUpdate: (cb: (d: any) => void) => ipcRenderer.on('update', (_e, d) => cb(d)),
  quit: () => ipcRenderer.send('quit'),
  hide: () => ipcRenderer.send('hide'),
});
