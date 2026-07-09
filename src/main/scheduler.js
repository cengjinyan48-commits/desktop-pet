// Scheduler — 9AM check-in + task reminders + evening summary

const schedule = require('node-schedule');
const { Notification } = require('electron');
const { execFile } = require('child_process');
const windows = require('./window-manager');
const config = require('./config');

let db = null;
let checkinJob = null;
let reminderInterval = null;
let summaryJob = null;
let waterJob = null;
let weatherCache = null;

// ── Start / Stop ────────────────────────────────────────

function start(database) {
  db = database;

  // 1. Daily 9AM check-in
  checkinJob = schedule.scheduleJob(
    { hour: config.CHECKIN_HOUR, minute: config.CHECKIN_MINUTE, second: 0, tz: config.CHECKIN_TZ },
    fireCheckin
  );

  // 2. Task time reminders — every 5 minutes
  reminderInterval = setInterval(checkTaskReminders, 5 * 60 * 1000);
  checkTaskReminders(); // run once on startup too

  // 3. Evening summary — 21:00
  summaryJob = schedule.scheduleJob(
    { hour: 21, minute: 0, second: 0, tz: config.CHECKIN_TZ },
    fireEveningSummary
  );

  // 4. Water/break reminders — hourly 9:00-18:00
  waterJob = schedule.scheduleJob({ minute: 0, tz: config.CHECKIN_TZ }, () => {
    const h = new Date().getHours();
    if (h >= 9 && h <= 18) fireWaterReminder();
  });

  // Fetch weather on startup
  fetchWeather();

  // Startup catch-up for morning check-in
  setTimeout(() => {
    const now = new Date();
    const checkinTime = new Date();
    checkinTime.setHours(config.CHECKIN_HOUR, config.CHECKIN_MINUTE, 0, 0);
    if (now > checkinTime) {
      const lastDate = db.getLastCheckinDate();
      if (lastDate !== db.todayStr()) fireCheckin();
    }
  }, 5000);

  console.log(`⏰ Scheduler ready: checkin@${config.CHECKIN_HOUR}:00 | reminders@5min | water@hourly | summary@21:00`);
}

function stop() {
  if (checkinJob) { checkinJob.cancel(); checkinJob = null; }
  if (reminderInterval) { clearInterval(reminderInterval); reminderInterval = null; }
  if (summaryJob) { summaryJob.cancel(); summaryJob = null; }
  if (waterJob) { waterJob.cancel(); waterJob = null; }
}

// ── 1. Morning Check-in ─────────────────────────────────

function fireCheckin() {
  if (db) {
    if (db.getLastCheckinDate() === db.todayStr()) return;
  }
  const weather = getWeather();
  sendToPet('checkin:trigger', { weather });
  console.log('⏰ Morning check-in fired!');
}

// ── 2. Task Time Reminders ──────────────────────────────

function checkTaskReminders() {
  if (!db) return;
  const today = db.todayStr();
  const tasks = db.getTasks(today);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const task of tasks) {
    if (task.status !== 'pending') continue;
    if (!task.suggested_time) continue;

    const [h, m] = task.suggested_time.split(':').map(Number);
    const taskMinutes = h * 60 + m;

    // Fire notification 10 minutes before
    const diff = taskMinutes - currentMinutes;
    if (diff > 0 && diff <= 10) {
      // Avoid duplicate notifications by checking a flag
      const remindedKey = `reminded_${task.id}_${today}`;
      if (db.getSetting(remindedKey)) continue;

      new Notification({
        title: '⏰ 任务提醒',
        body: `"${task.content}" 还有 ${diff} 分钟`,
        silent: false,
      }).show();

      db.setSetting(remindedKey, '1');
    }
  }
}

// ── 3. Evening Summary ──────────────────────────────────

function fireEveningSummary() {
  if (!db) return;
  const today = db.todayStr();
  const tasks = db.getTasks(today);
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;

  if (total === 0) return;

  const msg = done === total
    ? `太棒了！今天 ${total} 个任务全部完成 🎉`
    : done > 0
      ? `今天完成了 ${done}/${total} 个任务，还有 ${total - done} 个未完成，加油！💪`
      : `今天 ${total} 个任务还没开始呢… 😿`;

  new Notification({
    title: '🌙 今日总结',
    body: msg,
    silent: false,
  }).show();

  // Also show on pet if visible
  sendToPet('summary:show', { total, done, msg });
}

// ── 4. Water / Break Reminders ─────────────────────────

const WATER_MSGS = [
  '💧 该喝水啦！起来接杯水吧',
  '🚶 起来走一走，活动活动筋骨',
  '👀 看看窗外，眼睛休息一下',
  '💪 做几个伸展运动吧',
  '☕ 要不要来杯咖啡/茶？',
];

function fireWaterReminder() {
  const msg = WATER_MSGS[Math.floor(Math.random() * WATER_MSGS.length)];
  new Notification({ title: '鱼烧提醒你', body: msg, silent: true }).show();
  sendToPet('water:remind', { msg });
}

// ── 5. Weather ─────────────────────────────────────────

function fetchWeather() {
  // Use wttr.in (free, no API key) — fetch in Chinese for Shenzhen
  const url = 'https://wttr.in/Shenzhen?format=%C+%t+%h&lang=zh';
  const { exec } = require('child_process');
  exec(`curl -s --max-time 5 "${url}"`, (err, stdout) => {
    if (err || !stdout) {
      weatherCache = '天气数据获取中…';
      return;
    }
    weatherCache = stdout.trim();
  });
}

function getWeather() {
  return weatherCache || '天气数据获取中…';
}

// Update weather every 3 hours
setInterval(fetchWeather, 3 * 60 * 60 * 1000);

// ── Helpers ─────────────────────────────────────────────

function sendToPet(channel, data) {
  const pw = windows.getPetWindow();
  if (pw && !pw.isDestroyed()) {
    if (!pw.isVisible()) pw.show();
    pw.webContents.send(channel, data);
  } else {
    windows.createPetWindow();
    setTimeout(() => {
      const pw2 = windows.getPetWindow();
      if (pw2) pw2.webContents.send(channel, data);
    }, 2000);
  }
}

function triggerNow() { fireCheckin(); }

module.exports = { start, stop, triggerNow, getWeather };
