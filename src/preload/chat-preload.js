// Preload for the AI Chat window — contextBridge only

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  aiChat: (text)     => ipcRenderer.invoke('ai:chat', text),
  aiStatus: ()       => ipcRenderer.invoke('ai:status'),
  aiClear: ()        => ipcRenderer.invoke('ai:clear'),
  hideChat: ()       => ipcRenderer.invoke('chat:hide'),
  getAllSettings: () => ipcRenderer.invoke('settings:get-all')
});
