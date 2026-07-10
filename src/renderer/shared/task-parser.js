// Task Parser — Natural language → structured task list (v2: +date extraction)
//
// Input:  "7月10日下午四点提醒我开会，明天上午写代码"
// Output: [
//   { content:"提醒我开会", time_period:"afternoon", suggested_time:"16:00", date:"2026-07-10" },
//   { content:"写代码",     time_period:"morning",   suggested_time:null,    date:"2026-07-11" }
// ]

const TIME_PERIOD_PATTERNS = {
  morning:   /上午|早上|早晨|am\b|AM\b|今早|morning|🌅|☀️|清晨|早间/,
  afternoon: /中午|下午|pm\b|PM\b|午后|afternoon|正午|晌午|🌤️|🌥️/,
  evening:   /晚上|傍晚|夜间|今晚|夜里|evening|night|🌙|🌃|🌆|入夜|天黑/
};

const TIME_PATTERN = /(上午|下午|晚上|中午)?\s*(\d{1,2})[点:：](\d{2})?分?/;

const DELIMITER = /[,，。\n\r；;、和还有另外以及顺便]+/;

// Date patterns (matched in order of specificity)
const DATE_PATTERNS = [
  // 7月10日 / 7月10号 / 7/10
  { re: /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/,  build: (m, now) => {
    const mon = parseInt(m[1], 10), day = parseInt(m[2], 10);
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
    return `${now.getFullYear()}-${pad(mon)}-${pad(day)}`;
  }},
  // 明天 / 后天 / 大后天
  { re: /明天/,   build: (m, now) => offsetDate(now, 1) },
  { re: /后天/,   build: (m, now) => offsetDate(now, 2) },
  { re: /大后天/, build: (m, now) => offsetDate(now, 3) },
  // 下周一 / 下周二 ...
  { re: /下周\s*([一二三四五六日天])/, build: (m, now) => {
    const map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0 };
    const target = map[m[1]];
    if (target === undefined) return null;
    const d = new Date(now);
    const currentDay = d.getDay(); // 0=Sun
    const daysUntilNext = (target - currentDay + 7) % 7;
    d.setDate(d.getDate() + daysUntilNext + 7); // next week = +7 extra
    return fmtDate(d);
  }},
  // 本周一 / 周二 ... (this week)
  { re: /本周?\s*([一二三四五六日天])/, build: (m, now) => {
    const map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0 };
    const target = map[m[1]];
    if (target === undefined) return null;
    const d = new Date(now);
    const currentDay = d.getDay();
    const daysUntil = (target - currentDay + 7) % 7;
    d.setDate(d.getDate() + daysUntil);
    return fmtDate(d);
  }},
  // 10号 / 10日 (this month, only if day > today implies this month)
  { re: /(\d{1,2})\s*[日号]/, build: (m, now) => {
    const day = parseInt(m[1], 10);
    if (day < 1 || day > 31) return null;
    // If the day is before today, assume next month
    const d = new Date(now);
    if (day < now.getDate()) {
      d.setMonth(d.getMonth() + 1);
    }
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(day)}`;
  }},
];

// ── Helpers ─────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, '0'); }

function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function offsetDate(now, days) {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return fmtDate(d);
}

function todayStr() {
  return fmtDate(new Date());
}

// ── Parse ───────────────────────────────────────────────

function parse(text) {
  if (!text || !text.trim()) return [];

  const now = new Date();
  let defaultDate = todayStr();

  // Check if the entire input starts with a date (applies to all segments)
  const leadingDate = extractDate(text, now);
  if (leadingDate) {
    defaultDate = leadingDate.date;
    text = leadingDate.remaining.trim();
    // Remove leading colon/separator
    text = text.replace(/^[：:，,\s]+/, '');
  }

  const segments = text.split(DELIMITER).filter(s => s.trim());

  return segments.map(segment => {
    let content = segment.trim();
    let timePeriod = null;
    let suggestedTime = null;
    let taskDate = defaultDate;

    // 0. Detect per-segment date
    const segDate = extractDate(content, now);
    if (segDate) {
      taskDate = segDate.date;
      content = segDate.remaining.trim();
    }

    // 1. Detect explicit time like "下午四点" or "4点" or "16:00"
    const timeMatch = content.match(TIME_PATTERN);
    if (timeMatch) {
      let hour = parseInt(timeMatch[2], 10);
      const minute = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const periodHint = timeMatch[1];

      // Adjust hour for 12-hour PM times
      if (periodHint && /下午|晚上|中午/.test(periodHint)) {
        if (hour !== 12) hour += 12;
      } else if (periodHint && /上午/.test(periodHint) && hour === 12) {
        hour = 0;
      }

      suggestedTime = `${pad(hour)}:${pad(minute)}`;

      // Remove the time expression from content
      content = content.replace(timeMatch[0], '').trim();

      // Infer time period from hour
      if (hour >= 6 && hour < 12) timePeriod = 'morning';
      else if (hour >= 12 && hour < 18) timePeriod = 'afternoon';
      else timePeriod = 'evening';
    }

    // 2. Detect time period keywords (if not already set)
    if (!timePeriod) {
      for (const [period, pattern] of Object.entries(TIME_PERIOD_PATTERNS)) {
        if (pattern.test(content)) {
          timePeriod = period;
          content = content.replace(pattern, '').trim();
          break;
        }
      }
    }

    // 3. Clean up
    content = content.replace(/^[，,。\s]+/, '').replace(/[，,。\s]+$/, '');

    // 4. Fallback content
    if (!content) {
      content = segment.trim();
      for (const pattern of Object.values(TIME_PERIOD_PATTERNS)) {
        content = content.replace(pattern, '').trim();
      }
      // Also strip date patterns from fallback
      for (const dp of DATE_PATTERNS) {
        content = content.replace(dp.re, '').trim();
      }
    }

    // 5. Detect recurrence pattern
    const recurrence = detectRecurrence(content);
    if (recurrence) {
      content = content.replace(recurrence.pattern, '').trim();
      // Clean up after removing recurrence pattern
      content = content.replace(/^[，,。\s]+/, '').replace(/[，,。\s]+$/, '');
    }

    return {
      content: content || segment.trim(),
      time_period: timePeriod,
      suggested_time: suggestedTime,
      date: taskDate,
      recurrence: recurrence ? recurrence.type : null,
      recurrence_day: recurrence ? recurrence.day : null
    };
  }).filter(t => t.content.length > 0);
}

// ── Recurrence Detection ────────────────────────────────

const RECUR_PATTERNS = [
  // 每周一 / 每周二 ...
  { re: /每[周週]\s*([一二三四五六日天])/, build: (m) => {
    const map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0 };
    return { type: 'weekly', day: map[m[1]], pattern: m[0] };
  }},
  // 每天
  { re: /每天/, build: () => ({ type: 'daily', day: null, pattern: '每天' }) },
  // 每月(\d+)号
  { re: /每月\s*(\d{1,2})\s*[日号]/, build: (m) => {
    return { type: 'monthly', day: parseInt(m[1], 10), pattern: m[0] };
  }},
  // 工作日
  { re: /[每]?[工工]作日/, build: () => ({ type: 'weekday', day: null, pattern: '工作日' }) },
];

function detectRecurrence(content) {
  for (const rp of RECUR_PATTERNS) {
    const match = content.match(rp.re);
    if (match) return rp.build(match);
  }
  return null;
}

// ── Date Extraction ─────────────────────────────────────

function extractDate(text, now) {
  for (const dp of DATE_PATTERNS) {
    const match = text.match(dp.re);
    if (match) {
      const date = dp.build(match, now);
      if (date) {
        const remaining = text.replace(match[0], '');
        return { date, remaining };
      }
    }
  }
  return null;
}

// ── Export ─────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parse };
}
