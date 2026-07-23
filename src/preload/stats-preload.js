// Preload for the Stats window — contextBridge only

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getStats: ()   => ipcRenderer.invoke('stats:get'),
  closeStats: () => ipcRenderer.invoke('stats:close')
});
