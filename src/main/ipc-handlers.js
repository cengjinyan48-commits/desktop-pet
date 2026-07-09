// IPC Handlers — All main-process IPC channel registrations

const { ipcMain, app } = require('electron');
const windows = require('./window-manager');
const cursorPoll = require('./cursor-poll');
const calendarBridge = require('./calendar-bridge');

let db = null;

function register(database) {
  db = database;

  // ── Pet Window ───────────────────────────────────────

  ipcMain.handle('pet:set-ignore-mouse', (_e, ignore) => {
    windows.setPetIgnoreMouse(ignore);
  });

  ipcMain.handle('pet:lock-interaction', () => {
    cursorPoll.lockInteraction();
  });

  ipcMain.handle('pet:unlock-interaction', () => {
    cursorPoll.unlockInteraction();
  });

  // ── Window Movement ──────────────────────────────────

  ipcMain.handle('pet:start-drag', (_e, pos) => {
    cursorPoll.setDragging(true);
    windows.setPetIgnoreMouse(false);
  });

  ipcMain.handle('pet:move-window', (_e, delta) => {
    windows.movePetWindow(delta.dx, delta.dy);
  });

  ipcMain.handle('pet:end-drag', () => {
    cursorPoll.setDragging(false);
    // Save position to DB
    if (db) {
      const pos = windows.getPetPosition();
      db.savePetState({ pos_x: pos.x, pos_y: pos.y });
    }
  });

  // ── Pet State ────────────────────────────────────────

  ipcMain.handle('pet:get-state', () => {
    const pos = windows.getPetPosition();
    if (db) {
      const state = db.getPetState();
      return { ...state, pos_x: pos.x, pos_y: pos.y };
    }
    return { pos_x: pos.x, pos_y: pos.y, pet_name: '小橘' };
  });

  ipcMain.handle('pet:save-state', (_e, state) => {
    const pos = windows.getPetPosition();
    if (db) {
      if (state.mood) state.mood = String(state.mood);
      db.savePetState({ pos_x: pos.x, pos_y: pos.y, ...state });
    }
  });

  // ── Tasks ────────────────────────────────────────────

  ipcMain.handle('tasks:get-all', async (_e, date) => {
    if (!db) return [];
    return db.getTasks(date || db.todayStr());
  });

  ipcMain.handle('tasks:add', async (_e, task) => {
    if (!db) return null;
    task.date = task.date || db.todayStr();
    return db.addTask(task);
  });

  ipcMain.handle('tasks:update', async (_e, id, fields) => {
    if (!db) return false;
    const result = db.updateTask(id, fields);

    // Auto-create next occurrence for recurring tasks when marked done
    if (fields.status === 'done') {
      const tasks = db.getTasks(db.todayStr());
      const task = tasks.find(t => t.id === id);
      if (task && task.recurrence) {
        createNextRecurrence(task);
      }
    }
    return result;
  });

  ipcMain.handle('tasks:delete', async (_e, id) => {
    if (!db) return false;
    return db.deleteTask(id);
  });

  ipcMain.handle('tasks:month-summary', async (_e, yearMonth) => {
    if (!db) return [];
    return db.getMonthTaskDates(yearMonth);
  });

  ipcMain.handle('tasks:parse', async (_e, text) => {
    const path = require('path');
    const parser = require(path.join(__dirname, '..', 'renderer', 'shared', 'task-parser.js'));
    const tasks = parser.parse(text);
    // Use parsed date if present, otherwise today
    return tasks.map(t => ({
      ...t,
      date: t.date || db.todayStr()
    }));
  });

  // ── Check-in ─────────────────────────────────────────

  ipcMain.handle('checkin:status', () => {
    if (!db) return { checkedIn: false };
    const last = db.getLastCheckinDate();
    const today = db.todayStr();
    return { checkedIn: last === today, lastDate: last };
  });

  ipcMain.handle('checkin:complete', () => {
    if (db) db.setLastCheckinDate(db.todayStr());
    return true;
  });

  // ── Panel ────────────────────────────────────────────

  ipcMain.handle('panel:show', () => { windows.showTaskPanel(); });
  ipcMain.handle('panel:hide', () => { windows.hideTaskPanel(); });

  // ── Settings ────────────────────────────────────────

  ipcMain.handle('settings:get-all', async () => {
    if (!db) return {};
    return {
      pet_name:        db.getSetting('pet_name')       || '小橘',
      calendar:        db.getSetting('calendar')       || '个人',
      checkin_hour:    db.getSetting('checkin_hour')   || '9',
      checkin_minute:  db.getSetting('checkin_minute') || '0',
      auto_launch:     db.getSetting('auto_launch')    || 'true'
    };
  });

  ipcMain.handle('settings:save-all', async (_e, settings) => {
    if (!db) return false;
    for (const [key, value] of Object.entries(settings)) {
      db.setSetting(key, String(value));
    }
    // Apply auto-launch immediately
    if (settings.auto_launch !== undefined) {
      app.setLoginItemSettings({ openAtLogin: settings.auto_launch === 'true' });
    }
    // Update pet name in DB
    if (settings.pet_name) {
      db.savePetState({ pet_name: settings.pet_name });
    }
    return true;
  });

  ipcMain.handle('settings:close', () => {
    windows.closeSettingsWindow();
  });

  ipcMain.handle('settings:open', () => {
    windows.createSettingsWindow();
  });

  // ── Stats ───────────────────────────────────────────

  ipcMain.handle('stats:get', () => {
    if (!db) return {};
    return db.getStats();
  });

  ipcMain.handle('stats:open', () => {
    windows.createStatsWindow();
  });

  ipcMain.handle('stats:close', () => {
    windows.closeStatsWindow();
  });

  // ── Weather ─────────────────────────────────────────

  ipcMain.handle('weather:get', () => {
    const scheduler = require('./scheduler');
    return scheduler.getWeather ? scheduler.getWeather() : '天气不可用';
  });

  // ── Shortcuts ──────────────────────────────────────

  ipcMain.handle('shortcuts:run', async (_e, shortcutName) => {
    const { exec } = require('child_process');
    // Just open Siri directly — that's what the user wants
    exec('open -a Siri', (err) => {
      if (err) console.error('Siri activate error:', err.message);
    });
    return { output: 'Siri 已唤醒 🎤\n你也可以直接说「嘿 Siri」或按 Fn+空格' };
  });

  // ── Quick Notes ─────────────────────────────────────

  ipcMain.handle('notes:save', (_e, text) => {
    if (!db) return false;
    const today = db.todayStr();
    db.setSetting('quick_note_' + today, text);
    return true;
  });

  ipcMain.handle('notes:get', () => {
    if (!db) return '';
    return db.getSetting('quick_note_' + db.todayStr()) || '';
  });

  ipcMain.handle('panel:refresh', () => {
    const tpw = windows.getTaskPanelWindow();
    if (tpw && !tpw.isDestroyed()) {
      tpw.webContents.send('tasks:refreshed');
    }
  });

  ipcMain.handle('pet:show', () => { windows.createPetWindow(); });
  ipcMain.handle('pet:hide', () => {
    const pw = windows.getPetWindow();
    if (pw) pw.hide();
  });

  ipcMain.handle('pet:trigger-happy', () => {
    const pw = windows.getPetWindow();
    if (pw) pw.webContents.send('pet:happy');
  });

  // ── Calendar ────────────────────────────────────────

  ipcMain.handle('calendar:sync', async () => {
    try {
      const events = await calendarBridge.getTodaysEvents();
      if (!events || events.length === 0) return [];

      const merged = [];
      for (const evt of events) {
        // Check if we already have a task linked to this event
        const existing = db.getTaskByCalendarUid(evt.uid);
        if (!existing) {
          // Create a new task from calendar event
          const task = {
            content: evt.summary,
            time_period: null,
            suggested_time: evt.start_date ? evt.start_date.substring(11, 16) : null,
            source: 'calendar_sync',
            date: evt.start_date ? evt.start_date.substring(0, 10) : db.todayStr(),
            calendar_uid: evt.uid,
            calendar_name: evt.calendar
          };
          const added = db.addTask(task);
          merged.push(added);
        } else {
          merged.push(existing);
        }
        // Cache the calendar event
        db.upsertCalendarEvent({
          ...evt,
          raw_json: JSON.stringify(evt)
        });
      }
      return merged;
    } catch (err) {
      console.error('Calendar sync error:', err.message);
      throw err;
    }
  });

  ipcMain.handle('calendar:add-event', async (_e, task) => {
    try {
      const times = calendarBridge.computeEventTime(task);
      const uid = await calendarBridge.createEvent({
        summary: task.content,
        startDate: times.startDate,
        endDate: times.endDate,
        description: 'Created by Desktop Pet 🐱'
      });
      if (uid) {
        db.updateTask(task.id, { calendar_uid: uid });
      }
      return uid;
    } catch (err) {
      console.error('Calendar add event error:', err.message);
      throw err;
    }
  });

  ipcMain.handle('calendar:delete-event', async (_e, uid) => {
    try {
      return await calendarBridge.deleteEvent(uid);
    } catch (err) {
      console.error('Calendar delete event error:', err.message);
      throw err;
    }
  });

  // ── App ──────────────────────────────────────────────

  ipcMain.handle('app:quit', () => {
    windows.setAppIsQuitting(true);
    app.quit();
  });

  console.log('🔌 IPC handlers registered');
}

function createNextRecurrence(task) {
  if (!db) return;
  const nextDate = computeNextDate(task.recurrence, task.recurrence_day, task.date);
  if (!nextDate) return;

  // Don't duplicate if already exists
  const existing = db.getTasks(nextDate);
  const duplicate = existing.find(t =>
    t.content === task.content &&
    t.recurrence === task.recurrence &&
    t.recurrence_day === task.recurrence_day
  );
  if (duplicate) return;

  db.addTask({
    content: task.content,
    time_period: task.time_period,
    suggested_time: task.suggested_time,
    source: 'recurring',
    date: nextDate,
    recurrence: task.recurrence,
    recurrence_day: task.recurrence_day
  });
  console.log(`🔄 Created next ${task.recurrence} task: ${task.content} on ${nextDate}`);
}

function computeNextDate(recurrence, day, fromDate) {
  const d = fromDate ? new Date(fromDate + 'T00:00:00') : new Date();
  switch (recurrence) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly': {
      const targetDay = day !== null ? day : d.getDay();
      d.setDate(d.getDate() + 7);
      // Adjust to target weekday
      const diff = targetDay - d.getDay();
      d.setDate(d.getDate() + (diff < 0 ? diff + 7 : diff) - 7);
      d.setDate(d.getDate() + 7);
      break;
    }
    case 'monthly': {
      const targetDay = day || d.getDate();
      d.setMonth(d.getMonth() + 1);
      d.setDate(Math.min(targetDay, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      break;
    }
    case 'weekday':
      d.setDate(d.getDate() + 1);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
      break;
    default:
      return null;
  }
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

module.exports = { register };
