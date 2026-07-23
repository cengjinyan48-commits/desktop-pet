// AI Chat window — talk to the pet, backed by Claude API (main process)

(function () {
  'use strict';

  const { ipcRenderer } = require('electron');

  const messagesEl = document.getElementById('chat-messages');
  const inputEl    = document.getElementById('chat-input');
  const sendBtn    = document.getElementById('chat-send');
  const clearBtn   = document.getElementById('chat-clear');
  const closeBtn   = document.getElementById('chat-close');
  const titleEl    = document.getElementById('chat-title');
  const modelEl    = document.getElementById('chat-model');
  const welcomeEl  = document.getElementById('welcome-msg');

  let sending = false;

  // ── Init: pet name / model / key check ──────────────

  async function init() {
    try {
      const [settings, status] = await Promise.all([
        ipcRenderer.invoke('settings:get-all'),
        ipcRenderer.invoke('ai:status')
      ]);
      const name = settings.pet_name || '鱼烧';
      titleEl.textContent = `🐱 ${name}`;
      modelEl.textContent = status.model || '';
      if (!status.hasKey) {
        welcomeEl.textContent = '还没有配置 API Key，先去「偏好设置 → AI 助理」填一下，我才能开口说话哦 🔑';
      } else {
        welcomeEl.textContent = `喵～我是${name}，有什么想聊的？我还能帮你记任务、查任务哦 📝`;
      }
    } catch (e) {
      console.error('chat init failed:', e);
    }
    inputEl.focus();
  }

  // ── Message rendering (textContent only, no innerHTML) ──

  function addMessage(role, text, toolsUsed) {
    const msg = document.createElement('div');
    msg.className = 'msg ' + role;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    msg.appendChild(bubble);

    if (toolsUsed && toolsUsed.length) {
      const badge = document.createElement('div');
      badge.className = 'msg-tools';
      const labels = { add_task: '📝 已记任务', get_tasks: '🔍 查了任务', complete_task: '✅ 完成任务' };
      badge.textContent = [...new Set(toolsUsed)].map(t => labels[t] || t).join(' · ');
      bubble.appendChild(badge);
    }

    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
  }

  function addTyping() {
    const msg = document.createElement('div');
    msg.className = 'msg assistant typing';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      bubble.appendChild(dot);
    }
    msg.appendChild(bubble);
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
  }

  // ── Send ─────────────────────────────────────────────

  async function send() {
    const text = inputEl.value.trim();
    if (!text || sending) return;

    sending = true;
    sendBtn.disabled = true;
    inputEl.value = '';
    autoGrow();

    addMessage('user', text);
    const typing = addTyping();

    try {
      const res = await ipcRenderer.invoke('ai:chat', text);
      typing.remove();
      if (res.ok) {
        addMessage('assistant', res.message, res.toolsUsed);
      } else {
        addMessage('error', res.message || '出错了，再试一次？');
      }
    } catch (err) {
      typing.remove();
      addMessage('error', '出错了：' + (err.message || '未知错误'));
    } finally {
      sending = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  // ── Input behaviors ──────────────────────────────────

  function autoGrow() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 96) + 'px';
  }

  inputEl.addEventListener('input', autoGrow);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  sendBtn.addEventListener('click', send);

  clearBtn.addEventListener('click', async () => {
    await ipcRenderer.invoke('ai:clear');
    messagesEl.innerHTML = '';
    const msg = addMessage('assistant', '对话已清空，我们重新开始吧 ✨');
    msg.querySelector('.msg-bubble').id = 'welcome-msg';
  });

  closeBtn.addEventListener('click', () => {
    ipcRenderer.invoke('chat:hide');
  });

  // Esc closes the window
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ipcRenderer.invoke('chat:hide');
  });

  init();
})();
