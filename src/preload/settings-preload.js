// Preload for the Settings window — contextBridge only

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAllSettings: ()         => ipcRenderer.invoke('settings:get-all'),
  saveAllSettings: (s)       => ipcRenderer.invoke('settings:save-all', s),
  closeSettings: ()          => ipcRenderer.invoke('settings:close'),
  aiSaveKey: (key)           => ipcRenderer.invoke('ai:save-key', key),
  aiSaveModel: (model)       => ipcRenderer.invoke('ai:save-model', model)
});
