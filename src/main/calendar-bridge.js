// Calendar Bridge — macOS Calendar integration via AppleScript
//
// Uses osascript (child_process) to read/write/delete Calendar events.
// All functions return Promises.

const { execFile } = require('child_process');
const config = require('./config');

const OSA_PATH = '/usr/bin/osascript';

// ── Helpers ─────────────────────────────────────────────

function runAppleScript(script) {
  return new Promise((resolve, reject) => {
    execFile(OSA_PATH, ['-e', script], { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        // Permission errors are common
        if (stderr && stderr.includes('not authorised')) {
          reject(new Error('CALENDAR_PERMISSION_DENIED: 请在 系统设置 > 隐私与安全性 > 日历 中授权'));
        } else if (stderr) {
          reject(new Error(stderr.trim()));
        } else {
          reject(err);
        }
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function escapeAppleScript(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

// ── Read Events ──────────────────────────────────────────

async function getTodaysEvents(calendarName) {
  const cal = escapeAppleScript(calendarName || config.DEFAULT_CALENDAR);

  const script = `
tell application "Calendar"
  set todayStart to current date
  set time of todayStart to 0
  set todayEnd to todayStart + 1 * days
  set output to ""
  repeat with cal in calendars
    if name of cal is "${cal}" then
      set evs to every event of cal whose start date >= todayStart and start date < todayEnd
      repeat with ev in evs
        try
          set evUid to uid of ev
        on error
          set evUid to "NO-UID"
        end try
        try
          set evDesc to description of ev
        on error
          set evDesc to ""
        end try
        set output to output & evUid & "|||" & (summary of ev) & "|||" & (start date of ev as «class isot») & "|||" & (end date of ev as «class isot») & "|||" & evDesc & "¶"
      end repeat
    end if
  end repeat
  if output is "" then return "NO_EVENTS"
  return output
end tell
`;

  const stdout = await runAppleScript(script);

  if (!stdout || stdout === 'NO_EVENTS') return [];

  // Parse: uid|||summary|||start|||end|||desc
  return stdout.split('\n').filter(line => line.trim()).map(line => {
    const parts = line.split('|||');
    return {
      uid:         parts[0] || '',
      summary:     parts[1] || '',
      start_date:  formatISO(parts[2] || ''),
      end_date:    formatISO(parts[3] || ''),
      description: parts[4] || '',
      calendar:    calendarName || config.DEFAULT_CALENDAR
    };
  });
}

// ── Create Event ─────────────────────────────────────────

async function createEvent({ summary, startDate, endDate, calendarName, description }) {
  const cal = escapeAppleScript(calendarName || config.DEFAULT_CALENDAR);
  const sum = escapeAppleScript(summary);
  const desc = escapeAppleScript(description || '');
  const start = escapeAppleScript(startDate);
  const end = escapeAppleScript(endDate || startDate);

  const script = `
tell application "Calendar"
  tell calendar "${cal}"
    set newEvent to make new event with properties {summary:"${sum}", start date:date "${start}", end date:date "${end}", description:"${desc}"}
    return uid of newEvent
  end tell
end tell
`;

  const stdout = await runAppleScript(script);
  return stdout.trim();
}

// ── Delete Event ─────────────────────────────────────────

async function deleteEvent(uid, calendarName) {
  const cal = escapeAppleScript(calendarName || config.DEFAULT_CALENDAR);

  const script = `
tell application "Calendar"
  tell calendar "${cal}"
    try
      delete (first event whose uid = "${uid}")
      return "OK"
    on error errMsg
      return "ERROR: " & errMsg
    end try
  end tell
end tell
`;

  const stdout = await runAppleScript(script);
  return stdout.trim().startsWith('OK');
}

// ── List Calendars ───────────────────────────────────────

async function listCalendars() {
  const script = `
tell application "Calendar"
  set output to ""
  repeat with cal in calendars
    set output to output & (name of cal) & "|||" & (writable of cal as string) & "¶"
  end repeat
  return output
end tell
`;

  const stdout = await runAppleScript(script);
  if (!stdout) return [];

  return stdout.split('\n').filter(line => line.trim()).map(line => {
    const [name, writable] = line.split('|||');
    return { name, writable: writable === 'true' };
  });
}

// ── Format helpers ───────────────────────────────────────

function formatISO(dateStr) {
  if (!dateStr) return '';
  // AppleScript returns something like "2026-07-09T15:00:00"
  // Normalize to YYYY-MM-DD HH:MM:SS
  return dateStr.replace('T', ' ').substring(0, 19);
}

function computeEventTime(task) {
  // Use task's date if available, otherwise today
  let yyyy, mm, dd;
  if (task.date && /^\d{4}-\d{2}-\d{2}$/.test(task.date)) {
    [yyyy, mm, dd] = task.date.split('-');
  } else {
    const today = new Date();
    yyyy = String(today.getFullYear());
    mm = String(today.getMonth() + 1).padStart(2, '0');
    dd = String(today.getDate()).padStart(2, '0');
  }

  let hour = 9;
  let minute = 0;

  if (task.suggested_time) {
    const [h, m] = task.suggested_time.split(':').map(Number);
    hour = h;
    minute = m || 0;
  } else if (task.time_period) {
    const defaults = config.TIME_PERIOD_DEFAULTS[task.time_period];
    if (defaults) hour = defaults.startHour;
  }

  const startHour = String(hour).padStart(2, '0');
  const endHour = String((hour + 1) % 24).padStart(2, '0');

  return {
    startDate: `${yyyy}-${mm}-${dd} ${startHour}:${String(minute).padStart(2, '0')}:00`,
    endDate:   `${yyyy}-${mm}-${dd} ${endHour}:${String(minute).padStart(2, '0')}:00`
  };
}

// ── Export ───────────────────────────────────────────────

module.exports = {
  getTodaysEvents,
  createEvent,
  deleteEvent,
  listCalendars,
  computeEventTime
};
