// Database — SQLite persistence via better-sqlite3
//
// Schema:
//   tasks        — user tasks + calendar-synced events
//   settings     — key-value preferences
//   pet_state    — singleton row: position, mood, check-in date
//   calendar_cache — cached macOS Calendar events

const path = require('path');
const { app } = require('electron');

let db = null;

// ── Init ───────────────────────────────────────────────

function init() {
  const dbPath = path.join(app.getPath('userData'), 'desktop-pet.db');
  const Database = require('better-sqlite3');

  db = new Database(dbPath);

  // Performance & safety
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createSchema();
  runMigrations();
  seedDefaultData();

  console.log('🗄️  Database ready:', dbPath);
  return db;
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      content         TEXT    NOT NULL,
      time_period     TEXT,
      suggested_time  TEXT,
      status          TEXT    NOT NULL DEFAULT 'pending',
      calendar_uid    TEXT,
      calendar_name   TEXT,
      source          TEXT    NOT NULL DEFAULT 'manual',
      date            TEXT    NOT NULL,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
    CREATE INDEX IF NOT EXISTS idx_tasks_calendar_uid ON tasks(calendar_uid);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pet_state (
      id                  INTEGER PRIMARY KEY CHECK (id = 1),
      pos_x               INTEGER NOT NULL DEFAULT 500,
      pos_y               INTEGER NOT NULL DEFAULT 400,
      mood                TEXT    NOT NULL DEFAULT 'idle',
      current_animation   TEXT    NOT NULL DEFAULT 'idle',
      last_checkin_date   TEXT,
      pet_name            TEXT    NOT NULL DEFAULT '小橘',
      pet_type            TEXT    NOT NULL DEFAULT 'orange-tabby',
      updated_at          TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS calendar_cache (
      uid         TEXT PRIMARY KEY,
      summary     TEXT    NOT NULL,
      start_date  TEXT    NOT NULL,
      end_date    TEXT    NOT NULL,
      calendar    TEXT    NOT NULL,
      raw_json    TEXT,
      synced_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);
}

function runMigrations() {
  // Add columns that may not exist in older DB versions
  const migrations = [
    "ALTER TABLE tasks ADD COLUMN recurrence TEXT",
    "ALTER TABLE tasks ADD COLUMN recurrence_day INTEGER",
    "ALTER TABLE tasks ADD COLUMN next_date TEXT",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (e) { /* column already exists, ok */ }
  }
}

function seedDefaultData() {
  // Ensure pet_state has exactly one row
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM pet_state').get();
  if (row.cnt === 0) {
    db.prepare('INSERT INTO pet_state (id) VALUES (1)').run();
  }
}

// ── Pet State ──────────────────────────────────────────

function getPetState() {
  const stmt = db.prepare('SELECT * FROM pet_state WHERE id = 1');
  return stmt.get();
}

function savePetState(fields) {
  const allowed = ['pos_x', 'pos_y', 'mood', 'current_animation', 'last_checkin_date', 'pet_name'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`);
      vals.push(fields[key]);
    }
  }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now','localtime')");
  db.prepare(`UPDATE pet_state SET ${sets.join(', ')} WHERE id = 1`).run(...vals);
}

// ── Tasks ──────────────────────────────────────────────

function getTasks(date) {
  return db.prepare(
    'SELECT * FROM tasks WHERE date = ? ORDER BY sort_order, id'
  ).all(date);
}

function getMonthTaskDates(yearMonth) {
  // yearMonth: "2026-07"
  const rows = db.prepare(
    'SELECT DISTINCT date FROM tasks WHERE date LIKE ? ORDER BY date'
  ).all(yearMonth + '%');
  return rows.map(r => r.date);
}

function addTask(task) {
  const stmt = db.prepare(`
    INSERT INTO tasks (content, time_period, suggested_time, source, date, sort_order, recurrence, recurrence_day)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    task.content,
    task.time_period || null,
    task.suggested_time || null,
    task.source || 'manual',
    task.date || todayStr(),
    task.sort_order || 0,
    task.recurrence || null,
    task.recurrence_day || null
  );
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
}

function updateTask(id, fields) {
  const allowed = ['content', 'time_period', 'suggested_time', 'status', 'calendar_uid', 'calendar_name', 'sort_order'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`);
      vals.push(fields[key]);
    }
  }
  if (sets.length === 0) return false;
  sets.push("updated_at = datetime('now','localtime')");
  vals.push(id);
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return true;
}

function deleteTask(id) {
  return db.prepare('DELETE FROM tasks WHERE id = ?').run(id).changes > 0;
}

function getTaskByCalendarUid(uid) {
  return db.prepare('SELECT * FROM tasks WHERE calendar_uid = ?').get(uid);
}

// ── Settings ───────────────────────────────────────────

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

// ── Calendar Cache ─────────────────────────────────────

function upsertCalendarEvent(event) {
  db.prepare(`
    INSERT INTO calendar_cache (uid, summary, start_date, end_date, calendar, raw_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET
      summary = excluded.summary,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      calendar = excluded.calendar,
      raw_json = excluded.raw_json,
      synced_at = datetime('now','localtime')
  `).run(event.uid, event.summary, event.start_date, event.end_date, event.calendar, event.raw_json || null);
}

function clearCalendarCache() {
  db.prepare('DELETE FROM calendar_cache').run();
}

function getCalendarCache(date) {
  if (date) {
    return db.prepare(
      "SELECT * FROM calendar_cache WHERE date(start_date) = ? ORDER BY start_date"
    ).all(date);
  }
  return db.prepare('SELECT * FROM calendar_cache ORDER BY start_date').all();
}

// ── Check-in ───────────────────────────────────────────

function getLastCheckinDate() {
  const row = db.prepare('SELECT last_checkin_date FROM pet_state WHERE id = 1').get();
  return row ? row.last_checkin_date : null;
}

function setLastCheckinDate(dateStr) {
  db.prepare(
    "UPDATE pet_state SET last_checkin_date = ?, updated_at = datetime('now','localtime') WHERE id = 1"
  ).run(dateStr);
}

// ── Stats ─────────────────────────────────────────────

function getStats() {
  const today = todayStr();
  const weekAgo = weekAgoStr();

  // Today's tasks
  const todayTasks = getTasks(today);
  const todayTotal = todayTasks.length;
  const todayDone  = todayTasks.filter(t => t.status === 'done').length;

  // This week
  const weekTasks = db.prepare(
    "SELECT * FROM tasks WHERE date >= ? AND date <= ?"
  ).all(weekAgo, today);
  const weekTotal = weekTasks.length;
  const weekDone  = weekTasks.filter(t => t.status === 'done').length;

  // Streak: consecutive days (going backward from yesterday) with at least 1 completed task
  let streak = 0;
  const d = new Date();
  d.setDate(d.getDate() - 1); // start from yesterday
  while (true) {
    const ds = fmtDateObj(d);
    const tasks = db.prepare(
      "SELECT COUNT(*) as cnt FROM tasks WHERE date = ? AND status = 'done'"
    ).get(ds);
    if (tasks && tasks.cnt > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  // If today also has completed tasks, include today
  if (todayDone > 0) streak++;

  // Busiest period
  const periods = { morning: 0, afternoon: 0, evening: 0 };
  for (const t of todayTasks) {
    if (t.time_period && periods[t.time_period] !== undefined) {
      periods[t.time_period]++;
    }
  }
  let busiestPeriod = '无';
  let maxCount = 0;
  for (const [p, c] of Object.entries(periods)) {
    if (c > maxCount) { maxCount = c; busiestPeriod = p; }
  }
  const periodLabels = { morning: '上午 ☀️', afternoon: '下午 🌤️', evening: '晚上 🌙' };

  // All-time
  const allTime = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done FROM tasks").get();

  // Week period breakdown
  const weekPeriods = { morning: 0, afternoon: 0, evening: 0 };
  for (const t of weekTasks) {
    if (t.time_period && weekPeriods[t.time_period] !== undefined) {
      weekPeriods[t.time_period]++;
    }
  }

  return {
    today: { total: todayTotal, done: todayDone, rate: todayTotal > 0 ? Math.round(todayDone/todayTotal*100) : 0 },
    week:  { total: weekTotal,  done: weekDone,  rate: weekTotal  > 0 ? Math.round(weekDone/weekTotal*100)   : 0 },
    streak,
    periods: {
      morning: periods.morning, afternoon: periods.afternoon, evening: periods.evening
    },
    weekPeriods: {
      morning: weekPeriods.morning, afternoon: weekPeriods.afternoon, evening: weekPeriods.evening
    },
    busiest: periodLabels[busiestPeriod] || '无',
    allTime: { total: allTime.total || 0, done: allTime.done || 0 }
  };
}

function weekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return fmtDateObj(d);
}

function fmtDateObj(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Utility ────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

// ── Export ─────────────────────────────────────────────

module.exports = {
  init,
  close,
  getPetState,
  savePetState,
  getTasks,
  getMonthTaskDates,
  addTask,
  updateTask,
  deleteTask,
  getTaskByCalendarUid,
  getSetting,
  setSetting,
  upsertCalendarEvent,
  clearCalendarCache,
  getCalendarCache,
  getLastCheckinDate,
  setLastCheckinDate,
  getStats,
  todayStr
};
