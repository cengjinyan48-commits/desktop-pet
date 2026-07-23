// Settings panel — load & save preferences

(function () {
  'use strict';

  const { ipcRenderer } = require('electron');

  const petNameEl    = document.getElementById('pet-name');
  const calNameEl    = document.getElementById('calendar-name');
  const checkinHrEl  = document.getElementById('checkin-hour');
  const checkinMinEl = document.getElementById('checkin-minute');
  const autoLaunchEl = document.getElementById('auto-launch');
  const aiKeyEl      = document.getElementById('ai-api-key');
  const aiKeyHintEl  = document.getElementById('ai-key-hint');
  const aiModelEl    = document.getElementById('ai-model');
  const saveBtn      = document.getElementById('btn-save');
  const cancelBtn    = document.getElementById('btn-cancel');
  const statusEl     = document.getElementById('status');

  let originalSettings = {};

  // ── Load ─────────────────────────────────────────────

  async function load() {
    try {
      const s = await ipcRenderer.invoke('settings:get-all');
      originalSettings = s;

      petNameEl.value    = s.pet_name    || '小橘';
      calNameEl.value    = s.calendar    || '个人';
      checkinHrEl.value  = s.checkin_hour  ?? 9;
      checkinMinEl.value = s.checkin_minute ?? 0;
      autoLaunchEl.checked = s.auto_launch !== 'false'; // default true

      // AI settings — key never comes back, only whether one is stored
      aiModelEl.value = s.ai_model || 'claude-opus-4-8';
      if (s.ai_has_key) {
        aiKeyHintEl.textContent = '✅ 已配置（填入新 Key 可替换）';
        aiKeyEl.placeholder = '••••••••（留空则不修改）';
      }
    } catch (e) {
      showStatus('加载设置失败', true);
      console.error(e);
    }
  }

  // ── Save ─────────────────────────────────────────────

  async function save() {
    const settings = {
      pet_name:        petNameEl.value.trim()    || '小橘',
      calendar:        calNameEl.value.trim()    || '个人',
      checkin_hour:    parseInt(checkinHrEl.value)  || 9,
      checkin_minute:  parseInt(checkinMinEl.value) || 0,
      auto_launch:     autoLaunchEl.checked ? 'true' : 'false'
    };

    // Validate
    if (settings.checkin_hour < 0 || settings.checkin_hour > 23) {
      showStatus('小时必须在 0-23 之间', true); return;
    }
    if (settings.checkin_minute < 0 || settings.checkin_minute > 59) {
      showStatus('分钟必须在 0-59 之间', true); return;
    }

    try {
      await ipcRenderer.invoke('settings:save-all', settings);

      // AI: key goes through its own channel and is never stored in plain settings
      const newKey = aiKeyEl.value.trim();
      if (newKey) {
        await ipcRenderer.invoke('ai:save-key', newKey);
        aiKeyEl.value = '';
        aiKeyHintEl.textContent = '✅ 已配置';
      }
      await ipcRenderer.invoke('ai:save-model', aiModelEl.value);

      originalSettings = settings;
      showStatus('✅ 设置已保存');
      // Auto-close after brief delay
      setTimeout(() => { ipcRenderer.invoke('settings:close'); }, 800);
    } catch (e) {
      showStatus('保存失败: ' + e.message, true);
    }
  }

  function showStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (isError ? ' error' : '');
    if (!isError) {
      setTimeout(() => { statusEl.textContent = ''; }, 2000);
    }
  }

  // ── Events ──────────────────────────────────────────

  saveBtn.addEventListener('click', save);
  cancelBtn.addEventListener('click', () => {
    ipcRenderer.invoke('settings:close');
  });

  // Keyboard: Cmd+Enter to save, Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ipcRenderer.invoke('settings:close');
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
  });

  load();
})();
