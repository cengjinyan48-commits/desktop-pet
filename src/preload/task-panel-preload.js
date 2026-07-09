// Preload script for the Task Panel window
// Panel uses direct require('electron') via nodeIntegration, so this is minimal.

const { ipcRenderer } = require('electron');

// Provide API via window (contextIsolation: false)
window.electronAPI = {
  getTasks:           (date)  => ipcRenderer.invoke('tasks:get-all', date),
  addTask:            (task)  => ipcRenderer.invoke('tasks:add', task),
  updateTask:         (id, f) => ipcRenderer.invoke('tasks:update', id, f),
  deleteTask:         (id)    => ipcRenderer.invoke('tasks:delete', id),
  parseTasks:         (text)  => ipcRenderer.invoke('tasks:parse', text),
  monthSummary:       (ym)    => ipcRenderer.invoke('tasks:month-summary', ym),

  syncCalendar:       ()      => ipcRenderer.invoke('calendar:sync'),
  addCalendarEvent:   (task)  => ipcRenderer.invoke('calendar:add-event', task),
  deleteCalendarEvent:(uid)   => ipcRenderer.invoke('calendar:delete-event', uid),

  showPanel:          ()      => ipcRenderer.invoke('panel:show'),
  hidePanel:          ()      => ipcRenderer.invoke('panel:hide'),
  triggerPetHappy:    ()      => ipcRenderer.invoke('pet:trigger-happy'),
  quit:               ()      => ipcRenderer.invoke('app:quit'),

  onTasksRefreshed:   (cb) => { ipcRenderer.on('tasks:refreshed', (_e, ...args) => cb(...args)); },
  removeAllListeners: (ch) => { ipcRenderer.removeAllListeners(ch); }
};
