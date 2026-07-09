// Preload script for the Pet window
// With nodeIntegration enabled, we use direct require + window assignment

const { ipcRenderer } = require('electron');

// Expose API on window
window.electronAPI = {
  // ── Pet State ──────────────────────────────────
  getPetState:       ()      => ipcRenderer.invoke('pet:get-state'),
  savePetState:      (state) => ipcRenderer.invoke('pet:save-state', state),

  // ── Interaction ────────────────────────────────
  setIgnoreMouse:    (val)   => ipcRenderer.invoke('pet:set-ignore-mouse', val),
  lockInteraction:   ()      => ipcRenderer.invoke('pet:lock-interaction'),
  unlockInteraction: ()      => ipcRenderer.invoke('pet:unlock-interaction'),

  // ── Window movement ────────────────────────────
  startDrag:         (pos)   => ipcRenderer.invoke('pet:start-drag', pos),
  moveWindow:        (delta) => ipcRenderer.invoke('pet:move-window', delta),
  endDrag:           ()      => ipcRenderer.invoke('pet:end-drag'),

  // ── Tasks ──────────────────────────────────────
  getTasks:          (date)  => ipcRenderer.invoke('tasks:get-all', date),
  addTask:           (task)  => ipcRenderer.invoke('tasks:add', task),
  updateTask:        (id, f) => ipcRenderer.invoke('tasks:update', id, f),
  deleteTask:        (id)    => ipcRenderer.invoke('tasks:delete', id),
  parseTasks:        (text)  => ipcRenderer.invoke('tasks:parse', text),

  // ── Calendar ───────────────────────────────────
  syncCalendar:      ()      => ipcRenderer.invoke('calendar:sync'),
  addCalendarEvent:  (task)  => ipcRenderer.invoke('calendar:add-event', task),
  deleteCalendarEvent:(uid)  => ipcRenderer.invoke('calendar:delete-event', uid),

  // ── Check-in ───────────────────────────────────
  checkinStatus:     ()      => ipcRenderer.invoke('checkin:status'),
  completeCheckin:   ()      => ipcRenderer.invoke('checkin:complete'),

  // ── Notes ──────────────────────────────────────
  saveNote:          (text)  => ipcRenderer.invoke('notes:save', text),
  getNote:           ()      => ipcRenderer.invoke('notes:get'),

  // ── Shortcuts ───────────────────────────────────
  runShortcut:       (name)  => ipcRenderer.invoke('shortcuts:run', name),

  // ── Weather ─────────────────────────────────────
  getWeather:        ()      => ipcRenderer.invoke('weather:get'),

  // ── Panel ──────────────────────────────────────
  showPanel:         ()      => ipcRenderer.invoke('panel:show'),
  hidePanel:         ()      => ipcRenderer.invoke('panel:hide'),
  showStats:         ()      => ipcRenderer.invoke('stats:open'),
  refreshPanel:      ()      => ipcRenderer.invoke('panel:refresh'),
  hidePet:           ()      => ipcRenderer.invoke('pet:hide'),

  // ── App ────────────────────────────────────────
  quit:              ()      => ipcRenderer.invoke('app:quit'),

  // ── Main→Renderer events ───────────────────────
  onCheckin:         (cb)    => ipcRenderer.on('checkin:trigger', (_e, ...args) => cb(...args)),
  onCursorEnter:     (cb)    => ipcRenderer.on('cursor:enter', (_e, ...args) => cb(...args)),
  onCursorLeave:     (cb)    => ipcRenderer.on('cursor:leave', (_e, ...args) => cb(...args)),
  onPetHappy:        (cb)    => ipcRenderer.on('pet:happy', (_e, ...args) => cb(...args)),
  onSummaryShow:     (cb)    => ipcRenderer.on('summary:show', (_e, ...args) => cb(...args)),
  onShortcutQuickInput:(cb)  => ipcRenderer.on('shortcut:quick-input', (_e, ...args) => cb(...args)),
  onWaterRemind:     (cb)    => ipcRenderer.on('water:remind', (_e, ...args) => cb(...args)),
  removeAllListeners:(ch)    => ipcRenderer.removeAllListeners(ch)
};
