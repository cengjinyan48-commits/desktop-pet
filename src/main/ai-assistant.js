// AI Assistant — Claude API integration
//
// The pet's "brain": multi-turn chat with tool use, so the cat can
// actually read and manage the user's tasks, not just talk.
//
// - API key: stored encrypted via Electron safeStorage (macOS Keychain)
// - History: in-memory only, capped, reset on app restart or ai:clear
// - Tools:   add_task / get_tasks / complete_task → SQLite via database.js

const { safeStorage } = require('electron');
const windows = require('./window-manager');

let db = null;
let client = null;      // Anthropic client, rebuilt when the key changes
let clientKey = null;
let history = [];       // [{role, content}] Claude message history

const DEFAULT_MODEL = 'claude-opus-4-8';
const MAX_HISTORY = 24;      // messages kept (~12 round trips)
const MAX_TOOL_ROUNDS = 6;   // safety cap on the tool-use loop

// Models that support adaptive thinking (Haiku 4.5 does not)
const ADAPTIVE_MODELS = /^claude-(opus-4-[678]|sonnet-5|fable-5)/;

const TOOLS = [
  {
    name: 'add_task',
    description: '为用户添加一个待办任务。用户说"提醒我""帮我记""要做""安排"等时调用。日期请先根据今天的日期推算成 YYYY-MM-DD 再传入。',
    input_schema: {
      type: 'object',
      properties: {
        content:        { type: 'string', description: '任务内容，简洁的一句话' },
        date:           { type: 'string', description: '任务日期 YYYY-MM-DD，省略则为今天' },
        time_period:    { type: 'string', enum: ['morning', 'afternoon', 'evening'], description: '时段' },
        suggested_time: { type: 'string', description: '具体时间 HH:MM，如 14:30' },
        priority:       { type: 'string', enum: ['high', 'medium', 'low'], description: '优先级，默认 medium' }
      },
      required: ['content']
    }
  },
  {
    name: 'get_tasks',
    description: '查询某天的任务列表。用户问"我今天/明天有什么任务""还有什么没做"时调用。返回的任务带 id，可用于 complete_task。',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: '日期 YYYY-MM-DD，省略则为今天' }
      }
    }
  },
  {
    name: 'complete_task',
    description: '把任务标记为已完成。不知道任务 id 时先调用 get_tasks 查询。',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '任务 id（来自 get_tasks）' }
      },
      required: ['id']
    }
  }
];

// ── Init / key management ──────────────────────────────

function init(database) {
  db = database;
}

// Key stored with a prefix marker: "enc:<base64>" (safeStorage) or "raw:<key>"
function saveKey(rawKey) {
  const key = String(rawKey || '').trim();
  if (!key) return;
  let stored;
  if (safeStorage.isEncryptionAvailable()) {
    stored = 'enc:' + safeStorage.encryptString(key).toString('base64');
  } else {
    stored = 'raw:' + key;
  }
  db.setSetting('anthropic_api_key_enc', stored);
  client = null;  // force rebuild with new key
  clientKey = null;
}

function getKey() {
  if (!db) return '';
  const stored = db.getSetting('anthropic_api_key_enc') || '';
  if (!stored) return '';
  try {
    if (stored.startsWith('enc:')) {
      return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64')).trim();
    }
    if (stored.startsWith('raw:')) {
      return stored.slice(4).trim();
    }
    return stored.trim();  // legacy unprefixed value
  } catch (e) {
    console.error('AI key decrypt failed:', e.message);
    return '';
  }
}

function getModel() {
  return (db && db.getSetting('ai_model')) || DEFAULT_MODEL;
}

function getClient() {
  const key = getKey();
  if (!key) return null;
  if (client && clientKey === key) return client;
  const { Anthropic } = require('@anthropic-ai/sdk');
  client = new Anthropic({ apiKey: key, timeout: 90 * 1000, maxRetries: 1 });
  clientKey = key;
  return client;
}

// ── System prompt (persona + live context) ────────────

function buildSystemPrompt() {
  const petName = (db && db.getPetState().pet_name) || '鱼烧';
  const today = db.todayStr();
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date().getDay()];
  let context = `今天是 ${today}（星期${weekday}）。`;

  try {
    const scheduler = require('./scheduler');
    const weather = scheduler.getWeather && scheduler.getWeather();
    if (weather) context += `\n当前天气：${weather}`;
  } catch (e) { /* weather optional */ }

  try {
    const tasks = db.getTasks(today);
    if (tasks.length) {
      const lines = tasks.map(t =>
        `- [${t.status === 'done' ? '已完成' : '待办'}] #${t.id} ${t.content}` +
        (t.suggested_time ? ` @${t.suggested_time}` : ''));
      context += `\n用户今天的任务：\n${lines.join('\n')}`;
    } else {
      context += '\n用户今天还没有任务。';
    }
    const stats = db.getStats();
    context += `\n本周任务完成率 ${stats.week.rate}%，已连续打卡 ${stats.streak} 天。`;
  } catch (e) { /* stats optional */ }

  return `你是「${petName}」，一只住在用户 macOS 桌面上的像素橘猫，也是用户的私人助理。

性格：温暖、机灵、偶尔有点小傲娇，用自然的中文聊天，偶尔带一个合适的 emoji，不要堆砌。

职责：
- 陪用户聊天、回答问题、给建议
- 用工具帮用户管理待办：添加用 add_task，查询用 get_tasks，完成用 complete_task
- 用户提到"提醒我""帮我记""要做"等，主动用 add_task 记下并简短确认
- 涉及"明天""下周三"等相对日期时，根据今天的日期推算出 YYYY-MM-DD 再传给工具

回复要求：聊天窗口很小，回复保持简短（一般 1~3 句话），列表最多 5 条。不要用 Markdown 标题、代码块或长篇大论。

${context}`;
}

// ── Tool execution ─────────────────────────────────────

function runTool(name, input) {
  switch (name) {
    case 'add_task': {
      const task = db.addTask({
        content: input.content,
        date: input.date || db.todayStr(),
        time_period: input.time_period || null,
        suggested_time: input.suggested_time || null,
        priority: input.priority || 'medium',
        source: 'ai_chat'
      });
      notifyTasksChanged();
      return JSON.stringify({ ok: true, id: task.id, date: task.date });
    }
    case 'get_tasks': {
      const date = input.date || db.todayStr();
      const tasks = db.getTasks(date).map(t => ({
        id: t.id, content: t.content, status: t.status,
        time_period: t.time_period, suggested_time: t.suggested_time,
        priority: t.priority
      }));
      return JSON.stringify({ date, tasks });
    }
    case 'complete_task': {
      db.updateTask(input.id, { status: 'done' });
      notifyTasksChanged();
      return JSON.stringify({ ok: true, id: input.id });
    }
    default:
      return JSON.stringify({ error: 'unknown tool: ' + name });
  }
}

function notifyTasksChanged() {
  const tpw = windows.getTaskPanelWindow();
  if (tpw && !tpw.isDestroyed()) tpw.webContents.send('tasks:refreshed');
  const pw = windows.getPetWindow();
  if (pw && !pw.isDestroyed()) pw.webContents.send('pet:happy');
}

// ── History maintenance ────────────────────────────────

function trimHistory() {
  while (history.length > MAX_HISTORY) history.shift();
  // History must start with a plain-text user turn — a leading tool_result
  // or assistant turn would be rejected by the API
  while (history.length &&
         !(history[0].role === 'user' && typeof history[0].content === 'string')) {
    history.shift();
  }
}

function clearHistory() {
  history = [];
  return true;
}

// ── Chat (manual tool-use loop) ────────────────────────

async function chat(userText) {
  const anthropic = getClient();
  if (!anthropic) {
    return { ok: false, error: 'no_key', message: '还没有配置 API Key，去「偏好设置」里填一下吧 🔑' };
  }

  history.push({ role: 'user', content: userText });
  trimHistory();

  const model = getModel();
  const params = {
    model,
    max_tokens: 2048,
    system: buildSystemPrompt(),
    tools: TOOLS,
    messages: history
  };
  if (ADAPTIVE_MODELS.test(model)) {
    params.thinking = { type: 'adaptive' };
  }

  try {
    let response = await anthropic.messages.create(params);
    let rounds = 0;
    const toolsUsed = [];

    while (response.stop_reason === 'tool_use' && rounds < MAX_TOOL_ROUNDS) {
      rounds++;
      // Full content (incl. thinking blocks) must be echoed back
      history.push({ role: 'assistant', content: response.content });

      const results = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        toolsUsed.push(block.name);
        let result, isError = false;
        try {
          result = runTool(block.name, block.input);
        } catch (err) {
          result = 'Error: ' + err.message;
          isError = true;
        }
        results.push({ type: 'tool_result', tool_use_id: block.id, content: result, is_error: isError });
      }
      history.push({ role: 'user', content: results });

      response = await anthropic.messages.create({ ...params, messages: history });
    }

    history.push({ role: 'assistant', content: response.content });
    trimHistory();

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();
    return { ok: true, message: text || '喵？我好像走神了，再说一遍？', toolsUsed };
  } catch (err) {
    // Drop the just-added user turn so a retry doesn't duplicate it
    const last = history[history.length - 1];
    if (last && last.role === 'user' && typeof last.content === 'string') {
      history.pop();
    }
    return { ok: false, error: err.name || 'api_error', message: friendlyError(err) };
  }
}

function friendlyError(err) {
  const { Anthropic } = require('@anthropic-ai/sdk');
  if (err instanceof Anthropic.AuthenticationError) return 'API Key 无效，去「偏好设置」检查一下吧 🔑';
  if (err instanceof Anthropic.PermissionDeniedError) return '这个 API Key 没有权限用这个模型 🚫';
  if (err instanceof Anthropic.RateLimitError) return '请求太频繁啦，喝口水休息一下再聊 ☕';
  if (err instanceof Anthropic.APIConnectionError) return '网络不太通畅，检查一下网络连接 📡';
  if (err instanceof Anthropic.APIError) return `API 出错了（${err.status}）：${err.message}`;
  console.error('AI chat error:', err);
  return '出了点小状况：' + (err.message || '未知错误');
}

// ── Status ─────────────────────────────────────────────

function status() {
  return {
    hasKey: !!getKey(),
    model: getModel(),
    historyLength: history.length
  };
}

module.exports = { init, chat, status, clearHistory, saveKey, getModel, DEFAULT_MODEL };
