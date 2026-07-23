// Window factory — creates and manages BrowserWindows

const path = require('path');
const { BrowserWindow, screen } = require('electron');
const config = require('./config');

let petWindow = null;
let taskPanelWindow = null;

// ── Pet Window ──────────────────────────────────────────────

function createPetWindow(savedX, savedY) {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.show();
    return petWindow;
  }

  const preloadPath = path.join(__dirname, '..', 'preload', 'pet-preload.js');

  petWindow = new BrowserWindow({
    width: config.PET_WINDOW_WIDTH,
    height: config.PET_WINDOW_HEIGHT,
    x: savedX || 200,
    y: savedY || 200,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    type: 'panel',                    // macOS: floats above normal windows
    backgroundColor: '#00000000',     // fully transparent
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  petWindow.loadFile(path.join(__dirname, '..', 'renderer', 'pet', 'index.html'));

  // Default: click-through so the pet doesn't block other windows.
  // The cursor-poll module will toggle this off when the user hovers near the pet.
  petWindow.setIgnoreMouseEvents(true, { forward: true });

  // Don't close — just hide (macOS convention for tray apps)
  petWindow.on('close', (e) => {
    if (!appIsQuitting) {
      e.preventDefault();
      petWindow.hide();
    }
  });

  return petWindow;
}

function getPetWindow() {
  return petWindow;
}

function getPetBounds() {
  if (!petWindow || petWindow.isDestroyed()) return null;
  return petWindow.getBounds();
}

function setPetIgnoreMouse(ignore) {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.setIgnoreMouseEvents(ignore, { forward: true });
}

function movePetWindow(deltaX, deltaY) {
  if (!petWindow || petWindow.isDestroyed()) return;
  const [x, y] = petWindow.getPosition();
  petWindow.setPosition(x + deltaX, y + deltaY);
}

function getPetPosition() {
  if (!petWindow || petWindow.isDestroyed()) return { x: 0, y: 0 };
  const [x, y] = petWindow.getPosition();
  return { x, y };
}

function setPetPosition(x, y) {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.setPosition(Math.round(x), Math.round(y));
}

// ── Task Panel Window ───────────────────────────────────────

function createTaskPanelWindow() {
  if (taskPanelWindow && !taskPanelWindow.isDestroyed()) {
    taskPanelWindow.show();
    taskPanelWindow.focus();
    return taskPanelWindow;
  }

  const preloadPath = path.join(__dirname, '..', 'preload', 'task-panel-preload.js');
  const { width: sw } = screen.getPrimaryDisplay().workAreaSize;

  taskPanelWindow = new BrowserWindow({
    width: config.TASK_PANEL_WIDTH,
    height: config.TASK_PANEL_HEIGHT,
    x: sw - config.TASK_PANEL_WIDTH,   // docked to right edge
    y: 60,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: true,
    resizable: true,
    skipTaskbar: true,
    vibrancy: 'hud',                    // macOS frosted glass
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  taskPanelWindow.loadFile(path.join(__dirname, '..', 'renderer', 'task-panel', 'index.html'));

  taskPanelWindow.on('close', (e) => {
    if (!appIsQuitting) {
      e.preventDefault();
      taskPanelWindow.hide();
    }
  });

  return taskPanelWindow;
}

function getTaskPanelWindow() {
  return taskPanelWindow;
}

function toggleTaskPanel() {
  if (!taskPanelWindow || taskPanelWindow.isDestroyed()) {
    createTaskPanelWindow();
    return;
  }
  if (taskPanelWindow.isVisible()) {
    taskPanelWindow.hide();
  } else {
    taskPanelWindow.show();
    taskPanelWindow.focus();
  }
}

function showTaskPanel() {
  const win = createTaskPanelWindow();
  win.show();
  win.focus();
}

function hideTaskPanel() {
  if (taskPanelWindow && !taskPanelWindow.isDestroyed()) {
    taskPanelWindow.hide();
  }
}

// ── Settings Window ───────────────────────────────────────

let settingsWindow = null;

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 380, height: 640,
    resizable: false,
    frame: true,
    titleBarStyle: 'default',
    title: '偏好设置',
    backgroundColor: '#1e1c1a',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'index.html'));
  settingsWindow.setMenuBarVisibility(false);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

function closeSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
}

// ── Stats Window ───────────────────────────────────────────

let statsWindow = null;

function createStatsWindow() {
  if (statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.show();
    statsWindow.focus();
    return statsWindow;
  }

  statsWindow = new BrowserWindow({
    width: 360, height: 440,
    resizable: false, frame: true,
    titleBarStyle: 'default', title: '统计面板',
    backgroundColor: '#1e1c1a',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'stats-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  statsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'stats', 'index.html'));
  statsWindow.setMenuBarVisibility(false);

  statsWindow.on('closed', () => { statsWindow = null; });
  return statsWindow;
}

function closeStatsWindow() {
  if (statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.close();
  }
}

// ── AI Chat Window ─────────────────────────────────────────

let chatWindow = null;

function createChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.show();
    chatWindow.focus();
    return chatWindow;
  }

  // Open next to the pet if possible
  const petBounds = getPetBounds();
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  let x = petBounds ? petBounds.x - 340 : Math.round(sw / 2 - 170);
  let y = petBounds ? petBounds.y - 100 : Math.round(sh / 2 - 240);
  x = Math.max(10, Math.min(x, sw - 350));
  y = Math.max(30, Math.min(y, sh - 500));

  chatWindow = new BrowserWindow({
    width: 340, height: 480,
    minWidth: 300, minHeight: 360,
    x, y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: true,
    resizable: true,
    skipTaskbar: true,
    vibrancy: 'hud',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'chat-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  chatWindow.loadFile(path.join(__dirname, '..', 'renderer', 'chat', 'index.html'));

  chatWindow.on('close', (e) => {
    if (!appIsQuitting) {
      e.preventDefault();
      chatWindow.hide();
    }
  });

  return chatWindow;
}

function toggleChatWindow() {
  if (!chatWindow || chatWindow.isDestroyed()) {
    createChatWindow();
    return;
  }
  if (chatWindow.isVisible()) {
    chatWindow.hide();
  } else {
    chatWindow.show();
    chatWindow.focus();
  }
}

function hideChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) chatWindow.hide();
}

// ── Shared state ────────────────────────────────────────────

let appIsQuitting = false;

function setAppIsQuitting(val) {
  appIsQuitting = val;
}

module.exports = {
  createPetWindow,
  getPetWindow,
  getPetBounds,
  setPetIgnoreMouse,
  movePetWindow,
  getPetPosition,
  setPetPosition,
  createTaskPanelWindow,
  getTaskPanelWindow,
  toggleTaskPanel,
  showTaskPanel,
  hideTaskPanel,
  createSettingsWindow,
  closeSettingsWindow,
  createStatsWindow,
  closeStatsWindow,
  createChatWindow,
  toggleChatWindow,
  hideChatWindow,
  setAppIsQuitting
};
