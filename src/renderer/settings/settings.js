// Settings panel — load & save preferences

(function () {
  'use strict';


  const petNameEl    = document.getElementById('pet-name');
  const calNameEl    = document.getElementById('calendar-name');
  const checkinHrEl  = document.getElementById('checkin-hour');
  const checkinMinEl = document.getElementById('checkin-minute');
  const autoLaunchEl = document.getElementById('auto-launch');
  const aiSourceEl     = document.getElementById('ai-source');
  const aiSourceHintEl = document.getElementById('ai-source-hint');
  const aiKeyFieldEl   = document.getElementById('ai-key-field');
  const aiModelFieldEl = document.getElementById('ai-model-field');
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
      const s = await window.electronAPI.getAllSettings();
      originalSettings = s;

      petNameEl.value    = s.pet_name    || '小橘';
      calNameEl.value    = s.calendar    || '个人';
      checkinHrEl.value  = s.checkin_hour  ?? 9;
      checkinMinEl.value = s.checkin_minute ?? 0;
      autoLaunchEl.checked = s.auto_launch !== 'false'; // default true

      // AI settings — key never comes back, only whether one is stored
      aiSourceEl.value = s.ai_source || 'cc-switch';
      aiModelEl.value = s.ai_model || 'claude-opus-4-8';
      if (s.ai_has_key) {
        aiKeyHintEl.textContent = '✅ 已配置（填入新 Key 可替换）';
        aiKeyEl.placeholder = '••••••••（留空则不修改）';
      }
      updateSourceUI(s);
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
      await window.electronAPI.saveAllSettings(settings);

      // AI: key goes through its own channel and is never stored in plain settings
      await window.electronAPI.aiSetSource(aiSourceEl.value);
      const newKey = aiKeyEl.value.trim();
      if (newKey) {
        await window.electronAPI.aiSaveKey(newKey);
        aiKeyEl.value = '';
        aiKeyHintEl.textContent = '✅ 已配置';
      }
      await window.electronAPI.aiSaveModel(aiModelEl.value);

      originalSettings = settings;
      showStatus('✅ 设置已保存');
      // Auto-close after brief delay
      setTimeout(() => { window.electronAPI.closeSettings(); }, 800);
    } catch (e) {
      showStatus('保存失败: ' + e.message, true);
    }
  }

  // 根据来源显隐 Key/模型字段：跟随 CC Switch 时两者都不需要
  function updateSourceUI(s) {
    const isCC = aiSourceEl.value === 'cc-switch';
    aiKeyFieldEl.style.display = isCC ? 'none' : '';
    aiModelFieldEl.style.display = isCC ? 'none' : '';
    if (isCC) {
      if (s && s.ai_cc_available) {
        aiSourceHintEl.textContent = '✅ 已连接 CC Switch' + (s.ai_cc_model ? `（模型: ${s.ai_cc_model}）` : '');
      } else {
        aiSourceHintEl.textContent = '⚠️ 未找到 CC Switch 配置，将回落到自己的 Key';
      }
    } else {
      aiSourceHintEl.textContent = '使用下方自己的 API Key 和模型';
    }
  }

  aiSourceEl.addEventListener('change', () => updateSourceUI(originalSettings));

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
    window.electronAPI.closeSettings();
  });

  // Keyboard: Cmd+Enter to save, Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.electronAPI.closeSettings();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
  });

  load();
})();
