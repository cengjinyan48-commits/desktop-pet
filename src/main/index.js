// Desktop Pet — Application Entry Point

const { app, globalShortcut } = require('electron');
const windows = require('./window-manager');

let database = null;
let cursorPoll = null;
let scheduler = null;

// ── App Lifecycle ───────────────────────────────────────────

app.whenReady().then(async () => {
  // 1. Database (must init first — other modules depend on it)
  database = require('./database');
  database.init();

  // 2. Restore saved pet position
  const petState = database.getPetState();

  // 3. IPC Handlers (pass database reference)
  const ipcHandlers = require('./ipc-handlers');
  ipcHandlers.register(database);

  // 4. Create pet window (at saved position)
  windows.createPetWindow(petState.pos_x, petState.pos_y);

  // 5. Task panel — created on demand (right-click menu or tray)

  // 6. System tray
  const tray = require('./tray');
  tray.create();

  // 7. Cursor polling for click-through toggle
  cursorPoll = require('./cursor-poll');
  cursorPoll.start();

  // 8. Morning check-in scheduler
  scheduler = require('./scheduler');
  scheduler.start(database);

  // 9. Auto-launch on login (respect saved preference)
  const autoLaunch = database.getSetting('auto_launch');
  app.setLoginItemSettings({ openAtLogin: autoLaunch !== 'false' });

  // 10. Global shortcut: Cmd+Shift+Y → quick task input
  globalShortcut.register('Command+Shift+Y', () => {
    const pw = windows.getPetWindow();
    if (pw && !pw.isDestroyed()) {
      if (!pw.isVisible()) pw.show();
      pw.webContents.send('shortcut:quick-input');
    } else {
      windows.createPetWindow();
      setTimeout(() => {
        const pw2 = windows.getPetWindow();
        if (pw2) pw2.webContents.send('shortcut:quick-input');
      }, 1000);
    }
  });

  // 11. Global shortcut: Cmd+Shift+Space → AI chat window
  globalShortcut.register('Command+Shift+Space', () => {
    windows.toggleChatWindow();
  });

  console.log('🐱 Desktop Pet is running! (Cmd+Shift+Y to summon, Cmd+Shift+Space to chat)');
});

// macOS: keep app alive when all windows are closed (tray app)
app.on('window-all-closed', () => {
  // Don't quit — we're a tray app
});

app.on('activate', () => {
  // Restore pet at saved position when dock icon clicked
  if (database) {
    const state = database.getPetState();
    windows.createPetWindow(state.pos_x, state.pos_y);
  } else {
    windows.createPetWindow();
  }
});

app.on('before-quit', () => {
  windows.setAppIsQuitting(true);

  // Save pet state before exit
  if (database) {
    const pos = windows.getPetPosition();
    database.savePetState({ pos_x: pos.x, pos_y: pos.y });
    database.close();
  }

  // Clean up
  if (cursorPoll) cursorPoll.stop();
  if (scheduler) scheduler.stop();
  globalShortcut.unregisterAll();

  console.log('🐱 Desktop Pet is going to sleep. Goodbye!');
});
