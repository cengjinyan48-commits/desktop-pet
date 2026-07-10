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

  // 2. Task + Meeting reminders — every 3 minutes
  reminderInterval = setInterval(() => {
    checkTaskReminders();
    checkMeetingReminders();
  }, 3 * 60 * 1000);
  checkTaskReminders();
  checkMeetingReminders();

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

  // Fetch weather on startup (non-blocking)
  fetchWeather();

  // Startup catch-up for morning check-in (delay to let weather arrive)
  setTimeout(() => {
    const now = new Date();
    const checkinTime = new Date();
    checkinTime.setHours(config.CHECKIN_HOUR, config.CHECKIN_MINUTE, 0, 0);
    if (now > checkinTime) {
      const lastDate = db.getLastCheckinDate();
      if (lastDate !== db.todayStr()) {
        // Retry weather fetch before check-in (in case first one failed)
        if (!weatherCache) fetchWeather();
        // Give weather a moment, then fire check-in
        setTimeout(() => fireCheckin(), 1500);
      }
    }
  }, 3000);

  console.log(`⏰ Scheduler ready: checkin@${config.CHECKIN_HOUR}:00 | reminders@3min | water@hourly | summary@21:00`);
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

// ── 3.5 Meeting Reminders ──────────────────────────────

function checkMeetingReminders() {
  if (!db) return;
  const today = db.todayStr();
  const events = db.getCalendarCache(today);
  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();

  for (const evt of events) {
    const m = (evt.start_date || '').match(/(\d{2}):(\d{2})/);
    if (!m) continue;
    const diff = (parseInt(m[1]) * 60 + parseInt(m[2])) - curMin;
    if (diff > 0 && diff <= 5) {
      const key = 'meeting_reminded_' + evt.uid + '_' + today;
      if (db.getSetting(key)) continue;
      new (require('electron').Notification)({
        title: '📅 会议提醒',
        body: '"' + evt.summary + '" 还有 ' + diff + ' 分钟开始',
        silent: false
      }).show();
      db.setSetting(key, '1');
    }
  }
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
  const url = 'https://wttr.in/Shenzhen?format=j1';
  const { exec } = require('child_process');
  exec(`curl -s --max-time 5 "${url}"`, (err, stdout) => {
    if (err || !stdout || stdout.trim().length < 10) {
      const cached = db ? db.getSetting('last_weather') : null;
      weatherCache = cached || null;
      return;
    }
    try {
      const data = JSON.parse(stdout);
      const c = data.current_condition[0];
      const code = parseInt(c.weatherCode);
      const label = weatherEmoji(code);
      const temp = c.temp_C + '°C';
      const hum  = c.humidity + '%';
      const feels = c.FeelsLikeC;
      weatherCache = label + '  ' + temp + '  💧' + hum + '  🌡️体感' + feels + '°C';
      if (db) db.setSetting('last_weather', weatherCache);
    } catch (e) {
      weatherCache = null;
    }
  });
}

function weatherEmoji(code) {
  if (code === 113) return '☀️ 晴';
  if (code === 116) return '🌤️ 多云';
  if ([119,122].includes(code)) return '☁️ 阴';
  if ([143,248,260].includes(code)) return '🌫️ 雾';
  if ([176,263,266,293,296,299,302,305,308,311,314,353].includes(code)) return '🌧️ 雨';
  if ([179,182,185,227,230,281,284,317,320,323,326,329,332,335,338,350,362,365,368,371,374,377].includes(code)) return '🌨️ 雪';
  if ([200,386,389,392,395].includes(code)) return '⛈️ 雷暴';
  return '';
}

function getWeather() {
  return weatherCache || null;
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
