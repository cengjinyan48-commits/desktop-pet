// Task Parser v3 — NLP → structured task list (+ priority detection)

const TIME_PERIOD_PATTERNS = {
  morning:   /上午|早上|早晨|am\b|AM\b|今早|morning|🌅|☀️|清晨|早间/,
  afternoon: /中午|下午|pm\b|PM\b|午后|afternoon|正午|晌午|🌤️|🌥️/,
  evening:   /晚上|傍晚|夜间|今晚|夜里|evening|night|🌙|🌃|🌆|入夜|天黑/
};

const TIME_PATTERN = /(上午|下午|晚上|中午)?\s*(\d{1,2})[点:：](\d{2})?分?/;
const DELIMITER = /[,，。\n\r；;、和还有另外以及顺便]+/;

const DATE_PATTERNS = [
  { re: /(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/, build: (m, now) => {
    const mon = parseInt(m[1], 10), day = parseInt(m[2], 10);
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
    return `${now.getFullYear()}-${pad(mon)}-${pad(day)}`;
  }},
  { re: /明天/,   build: (m, now) => offsetDate(now, 1) },
  { re: /后天/,   build: (m, now) => offsetDate(now, 2) },
  { re: /大后天/, build: (m, now) => offsetDate(now, 3) },
  { re: /下周\s*([一二三四五六日天])/, build: (m, now) => {
    const map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0 };
    const target = map[m[1]];
    if (target === undefined) return null;
    const d = new Date(now);
    d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7) + 7);
    return fmtDate(d);
  }},
  { re: /本周?\s*([一二三四五六日天])/, build: (m, now) => {
    const map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0 };
    const target = map[m[1]];
    if (target === undefined) return null;
    const d = new Date(now);
    d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7));
    return fmtDate(d);
  }},
  { re: /(\d{1,2})\s*[日号]/, build: (m, now) => {
    const day = parseInt(m[1], 10);
    if (day < 1 || day > 31) return null;
    const d = new Date(now);
    if (day < now.getDate()) d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(day)}`;
  }},
];

const RECUR_PATTERNS = [
  { re: /每[周週]\s*([一二三四五六日天])/, build: (m) => {
    const map = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0 };
    return { type: 'weekly', day: map[m[1]], pattern: m[0] };
  }},
  { re: /每天/, build: () => ({ type: 'daily', day: null, pattern: '每天' }) },
  { re: /每月\s*(\d{1,2})\s*[日号]/, build: (m) => ({ type: 'monthly', day: parseInt(m[1], 10), pattern: m[0] }) },
  { re: /[每]?[工工]作日/, build: () => ({ type: 'weekday', day: null, pattern: '工作日' }) },
];

// ── Helpers
function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function offsetDate(now, days) { const d = new Date(now); d.setDate(d.getDate() + days); return fmtDate(d); }

// ── Parse
function parse(text) {
  if (!text || !text.trim()) return [];
  const now = new Date();
  let defaultDate = fmtDate(now);

  const leadingDate = extractDate(text, now);
  if (leadingDate) {
    defaultDate = leadingDate.date;
    text = leadingDate.remaining.trim().replace(/^[：:，,\s]+/, '');
  }

  const segments = text.split(DELIMITER).filter(s => s.trim());

  return segments.map(segment => {
    let content = segment.trim();
    let timePeriod = null, suggestedTime = null, taskDate = defaultDate;

    const segDate = extractDate(content, now);
    if (segDate) { taskDate = segDate.date; content = segDate.remaining.trim(); }

    const timeMatch = content.match(TIME_PATTERN);
    if (timeMatch) {
      let hour = parseInt(timeMatch[2], 10);
      const minute = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const periodHint = timeMatch[1];
      if (periodHint && /下午|晚上|中午/.test(periodHint)) { if (hour !== 12) hour += 12; }
      else if (periodHint && /上午/.test(periodHint) && hour === 12) hour = 0;
      suggestedTime = `${pad(hour)}:${pad(minute)}`;
      content = content.replace(timeMatch[0], '').trim();
      if (hour >= 6 && hour < 12) timePeriod = 'morning';
      else if (hour >= 12 && hour < 18) timePeriod = 'afternoon';
      else timePeriod = 'evening';
    }

    if (!timePeriod) {
      for (const [period, pattern] of Object.entries(TIME_PERIOD_PATTERNS)) {
        if (pattern.test(content)) { timePeriod = period; content = content.replace(pattern, '').trim(); break; }
      }
    }

    content = content.replace(/^[，,。\s]+/, '').replace(/[，,。\s]+$/, '');

    if (!content) {
      content = segment.trim();
      for (const pattern of Object.values(TIME_PERIOD_PATTERNS)) content = content.replace(pattern, '').trim();
      for (const dp of DATE_PATTERNS) content = content.replace(dp.re, '').trim();
    }

    const recurrence = detectRecurrence(content);
    if (recurrence) {
      content = content.replace(recurrence.pattern, '').trim();
      content = content.replace(/^[，,。\s]+/, '').replace(/[，,。\s]+$/, '');
    }

    let priority = 'medium';
    if (/!!|❗|🔥|重要|紧急|urgent|优先/.test(content)) {
      priority = 'high';
      content = content.replace(/!!|❗|🔥|重要|紧急|urgent|优先/g, '').trim();
    } else if (/不急|low|🟢|有空/.test(content)) {
      priority = 'low';
      content = content.replace(/不急|low|🟢|有空/g, '').trim();
    }
    content = content.replace(/^[，,。\s]+/, '').replace(/[，,。\s]+$/, '');

    return {
      content: content || segment.trim(),
      time_period: timePeriod,
      suggested_time: suggestedTime,
      date: taskDate,
      recurrence: recurrence ? recurrence.type : null,
      recurrence_day: recurrence ? recurrence.day : null,
      priority,
      is_focus: priority === 'high' ? 1 : 0
    };
  }).filter(t => t.content.length > 0);
}

function detectRecurrence(content) {
  for (const rp of RECUR_PATTERNS) { const m = content.match(rp.re); if (m) return rp.build(m); }
  return null;
}

function extractDate(text, now) {
  for (const dp of DATE_PATTERNS) { const m = text.match(dp.re); if (m) { const d = dp.build(m, now); if (d) return { date: d, remaining: text.replace(m[0], '') }; } }
  return null;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { parse };
