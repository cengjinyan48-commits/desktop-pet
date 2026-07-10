// Desktop Pet — Renderer Main Controller (v3 — bugfixes + time-based greeting)

(function () {
  'use strict';

  const SpriteGenerator = require('./sprite-generator.js');
  const CanvasRenderer   = require('./canvas-renderer.js');
  const AnimationSystem  = require('./animation-system.js');
  const DragHandler      = require('./drag-handler.js');

  // ── DOM refs ────────────────────────────────────────
  const canvas     = document.getElementById('pet-canvas');
  const loading    = document.getElementById('loading');
  const bubble     = document.getElementById('speech-bubble');
  const bubbleText = document.getElementById('bubble-text');
  const bubbleIn   = document.getElementById('bubble-input');
  const taskInput  = document.getElementById('task-input');
  const submitBtn  = document.getElementById('submit-tasks');
  const cancelBtn  = document.getElementById('cancel-input');
  const ctxMenu    = document.getElementById('ctx-menu');

  // ── State ───────────────────────────────────────────
  let isInteractive  = false;
  let lastFrameTime  = performance.now();
  let interactionLockTimer = null;
  let renderErrorCount = 0;

  // ── Init ─────────────────────────────────────────────

  function init() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    CanvasRenderer.init(canvas);

    AnimationSystem.init();
    AnimationSystem.onStateChange(onAnimStateChange);

    // Load saved mood + skin from DB
    if (window.electronAPI) {
      window.electronAPI.getPetState().then(state => {
        if (state && state.mood) {
          AnimationSystem.setMood(parseInt(state.mood) || 50);
        }
        if (state && state.pet_type && state.pet_type !== 'orange') {
          SpriteGenerator.setSkin(state.pet_type);
          AnimationSystem.init(); // reload sprites with saved skin
        }
      }).catch(() => {});
    }

    DragHandler.init(canvas);
    DragHandler.onDragStart(() => AnimationSystem.onDragStart());
    DragHandler.onDragEnd(() => {
      AnimationSystem.onDragEnd();
      if (window.electronAPI) window.electronAPI.savePetState({});
    });

    wireIPC();
    wireContextMenu();

    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);

    loading.classList.add('done');
    console.log('🐱 Orange tabby is ready!');
  }

  // ── Canvas resize (preserve context) ──────────────────

  window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    // Re-acquire context after resize to prevent stale context issues
    CanvasRenderer.ctx = canvas.getContext('2d');
    CanvasRenderer.canvas = canvas;
    if (CanvasRenderer.ctx) {
      CanvasRenderer.ctx.imageSmoothingEnabled = false;
    }
  });

  // ── IPC Wiring ──────────────────────────────────────

  function wireIPC() {
    if (!window.electronAPI) return;

    window.electronAPI.onCursorEnter(() => { isInteractive = true; });
    window.electronAPI.onCursorLeave(() => {
      isInteractive = false;
      clearInteractionLock();
    });
    window.electronAPI.onCheckin((data) => {
      let msg = getGreeting();
      if (data && data.weather && data.weather.length > 2) {
        msg += '\n' + data.weather;
      }
      showSpeechBubble(msg);
    });
    window.electronAPI.onPetHappy(() => {
      AnimationSystem.onTaskCompleted();
      saveMood();
    });
    window.electronAPI.onSummaryShow((data) => {
      showSpeechBubble(data.msg);
      setTimeout(hideSpeechBubble, 5000);
    });
    window.electronAPI.onShortcutQuickInput(() => {
      showSpeechBubble(getGreeting());
      setTimeout(showTaskInput, 300);
    });
    window.electronAPI.onWaterRemind((data) => {
      if (data && data.msg) {
        showSpeechBubble(data.msg);
        setTimeout(hideSpeechBubble, 4000);
      }
    });
  }

  // ── Time-based Greeting ──────────────────────────────

  function getGreeting() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11.5)       return '上午好！今天有什么计划？ ☀️';
    if (h >= 11.5 && h < 14)      return '中午好！今天有什么计划？ 🌤️';
    if (h >= 14 && h < 18)        return '下午好！今天有什么计划？ 🌥️';
    return '晚上好！今天有什么计划？ 🌙';
  }

  // ── Right-Click Context Menu ──────────────────────────

  function wireContextMenu() {
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY);
    });
    document.addEventListener('click', (e) => {
      if (!ctxMenu.contains(e.target)) ctxMenu.classList.add('hidden');
    });
  }

  function showContextMenu(x, y) {
    const mw = 175, mh = 260;
    let mx = Math.min(x, window.innerWidth - mw - 4);
    let my = Math.min(y, window.innerHeight - mh - 4);
    mx = Math.max(4, mx); my = Math.max(4, my);

    ctxMenu.style.left = mx + 'px';
    ctxMenu.style.top  = my + 'px';
    ctxMenu.classList.remove('hidden');

    document.getElementById('ctx-show-panel').onclick = () => {
      ctxMenu.classList.add('hidden');
      if (window.electronAPI) window.electronAPI.showPanel();
    };
    document.getElementById('ctx-show-stats').onclick = () => {
      ctxMenu.classList.add('hidden');
      if (window.electronAPI) window.electronAPI.showStats();
    };
    document.getElementById('ctx-trigger-checkin').onclick = () => {
      ctxMenu.classList.add('hidden');
      showSpeechBubble(getGreeting());
    };
    // Skin switching
    document.getElementById('ctx-skin-orange').onclick = () => {
      ctxMenu.classList.add('hidden');
      switchSkin('orange');
    };
    document.getElementById('ctx-skin-white').onclick = () => {
      ctxMenu.classList.add('hidden');
      switchSkin('white');
    };
    document.getElementById('ctx-skin-black').onclick = () => {
      ctxMenu.classList.add('hidden');
      switchSkin('black');
    };
    document.getElementById('ctx-skin-rabbit').onclick = () => {
      ctxMenu.classList.add('hidden');
      switchSkin('rabbit');
    };
    document.getElementById('ctx-hide-pet').onclick = () => {
      ctxMenu.classList.add('hidden');
      if (window.electronAPI) window.electronAPI.hidePet();
    };
    document.getElementById('ctx-feed-pet').onclick = () => {
      ctxMenu.classList.add('hidden');
      feedPet();
    };
    document.getElementById('ctx-quick-note').onclick = () => {
      ctxMenu.classList.add('hidden');
      openQuickNote();
    };
    document.getElementById('ctx-siri').onclick = () => {
      ctxMenu.classList.add('hidden');
      activateSiri();
    };
    document.getElementById('ctx-start-pomodoro').onclick = () => {
      ctxMenu.classList.add('hidden');
      startPomodoro();
    };
    document.getElementById('ctx-quit').onclick = () => {
      ctxMenu.classList.add('hidden');
      if (window.electronAPI) window.electronAPI.quit();
    };
  }

  // ── Pomodoro Timer ──────────────────────────────────

  const pomoTimer   = document.getElementById('pomodoro-timer');
  const pomoTime    = document.getElementById('pomo-time');
  const pomoLabel   = document.getElementById('pomo-label');
  const pomoCancel  = document.getElementById('pomo-cancel');
  const pomoCircle  = pomoTimer.querySelector('.pomo-circle');
  let pomoInterval  = null;
  let pomoSeconds   = 0;
  let pomoIsBreak   = false;

  function startPomodoro(focusMin = 25) {
    stopPomodoro();
    pomoSeconds = focusMin * 60;
    pomoIsBreak = false;
    pomoLabel.textContent = '专注';
    pomoCircle.classList.remove('break');
    updatePomoDisplay();
    pomoTimer.classList.remove('hidden');
    lockInteractionFor(pomoSeconds * 1000 + 60000);

    pomoInterval = setInterval(() => {
      pomoSeconds--;
      updatePomoDisplay();
      if (pomoSeconds <= 0) {
        clearInterval(pomoInterval);
        pomoInterval = null;
        onPomodoroDone();
      }
    }, 1000);
  }

  function updatePomoDisplay() {
    const m = Math.floor(pomoSeconds / 60);
    const s = pomoSeconds % 60;
    pomoTime.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function onPomodoroDone() {
    if (!pomoIsBreak) {
      // Focus done → start break
      showSpeechBubble('专注时间到！休息 5 分钟吧 ☕');
      pomoSeconds = 5 * 60;
      pomoIsBreak = true;
      pomoLabel.textContent = '休息';
      pomoCircle.classList.add('break');
      updatePomoDisplay();
      pomoInterval = setInterval(() => {
        pomoSeconds--;
        updatePomoDisplay();
        if (pomoSeconds <= 0) {
          clearInterval(pomoInterval);
          pomoInterval = null;
          onPomodoroDone();
        }
      }, 1000);
    } else {
      // Break done
      stopPomodoro();
      showSpeechBubble('休息结束！要继续下一个番茄钟吗？🍅');
      setTimeout(hideSpeechBubble, 3000);
    }
  }

  function stopPomodoro() {
    if (pomoInterval) { clearInterval(pomoInterval); pomoInterval = null; }
    pomoTimer.classList.add('hidden');
    if (window.electronAPI) window.electronAPI.unlockInteraction();
  }

  pomoCancel.addEventListener('click', (e) => {
    e.stopPropagation();
    stopPomodoro();
  });

  // ── Interaction Lock Safety ──────────────────────────

  function lockInteractionFor(ms = 60000) {
    if (window.electronAPI) window.electronAPI.lockInteraction();
    clearInteractionLock();
    interactionLockTimer = setTimeout(() => {
      if (window.electronAPI) window.electronAPI.unlockInteraction();
    }, ms);
  }

  function clearInteractionLock() {
    if (interactionLockTimer) {
      clearTimeout(interactionLockTimer);
      interactionLockTimer = null;
    }
  }

  // ── Main Render Loop (robust: wrapped in try-catch) ──

  function gameLoop(timestamp) {
    const deltaMs = Math.min(timestamp - lastFrameTime, 100);
    lastFrameTime = timestamp;

    try {
      AnimationSystem.update(deltaMs);
    } catch (e) { /* keep going */ }

    try {
      CanvasRenderer.clear();
    } catch (e) { /* keep going */ }

    // Subtle canvas glow when interactive
    if (isInteractive) {
      try { CanvasRenderer.drawGlow(0.4); } catch (e) { /* keep going */ }
    }

    // Draw pet sprite with fallback
    try {
      const frame = AnimationSystem.getCurrentFrame();
      if (frame && frame.width > 0) {
        CanvasRenderer.drawSprite(frame);
      } else {
        CanvasRenderer.drawFallback();
      }
    } catch (e) {
      // If anything fails, draw the fallback
      renderErrorCount++;
      try { CanvasRenderer.drawFallback(); } catch (e2) { /* silently ignore */ }
    }

    requestAnimationFrame(gameLoop);
  }

  // ── Speech Bubble ───────────────────────────────────

  function showSpeechBubble(msg) {
    bubbleText.textContent = msg;
    bubbleIn.classList.add('hidden');
    bubble.classList.remove('hidden');
    bubbleText.classList.remove('hidden');
    lockInteractionFor(120000);
  }

  function showTaskInput() {
    bubbleText.classList.add('hidden');
    bubbleIn.classList.remove('hidden');
    taskInput.value = '';
    taskInput.focus();
  }

  function hideSpeechBubble() {
    bubble.classList.add('hidden');
    clearInteractionLock();
    if (window.electronAPI) window.electronAPI.unlockInteraction();
  }

  // Bubble click → show input
  bubble.addEventListener('click', (e) => {
    if (e.target === submitBtn || e.target === cancelBtn || e.target === taskInput) return;
    if (!bubbleIn.classList.contains('hidden')) return;
    showTaskInput();
  });

  // Submit tasks
  submitBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const text = taskInput.value.trim();
    if (!text) return;

    let taskCount = 0, syncedCount = 0;
    if (window.electronAPI) {
      try {
        const parsed = await window.electronAPI.parseTasks(text);
        for (const task of parsed) {
          const saved = await window.electronAPI.addTask(task);
          if (!saved || !saved.id) continue;
          taskCount++;

          if (task.time_period || task.suggested_time) {
            try {
              const uid = await window.electronAPI.addCalendarEvent({
                id: saved.id, content: task.content,
                time_period: task.time_period,
                suggested_time: task.suggested_time,
                date: task.date
              });
              if (uid) {
                await window.electronAPI.updateTask(saved.id, { calendar_uid: uid });
                syncedCount++;
              }
            } catch (calErr) {
              console.warn('Auto calendar sync failed:', calErr);
            }
          }
        }
        await window.electronAPI.completeCheckin();
        window.electronAPI.refreshPanel();
      } catch (err) {
        console.error('Parse/add failed:', err);
        showSpeechBubble('出错了，请重试 😿');
        return;
      }
    } else {
      taskCount = text.split(/[,，。\n；;、]+/).filter(s => s.trim()).length;
    }

    AnimationSystem.onTaskCompleted();
    saveMood();
    const syncMsg = syncedCount > 0 ? `（${syncedCount} 个已同步到日历 📅）` : '';
    showSpeechBubble(`已添加 ${taskCount} 个任务 ✅ ${syncMsg}`);

    setTimeout(hideSpeechBubble, 3000);
  });

  // Cancel input
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    bubbleIn.classList.add('hidden');
    bubbleText.classList.remove('hidden');
  });

  // Plain Enter to submit (CMD+Enter still works too)
  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitBtn.click();
    }
  });

  // ── Feed Pet ────────────────────────────────────────

  function switchSkin(skin) {
    SpriteGenerator.setSkin(skin);
    AnimationSystem._skin = skin;
    AnimationSystem.init();
    if (window.electronAPI) {
      window.electronAPI.savePetState({ pet_type: skin });
    }
    showSpeechBubble('新皮肤！好看吗？✨');
    setTimeout(hideSpeechBubble, 2000);
  }

  function saveMood() {
    if (window.electronAPI) {
      window.electronAPI.savePetState({ mood: String(AnimationSystem.getMood()) });
    }
  }

  // ── Quick Note ──────────────────────────────────────

  const notePanel  = document.getElementById('quick-note');
  const noteArea   = document.getElementById('note-textarea');
  const noteSave   = document.getElementById('note-save');
  const noteClose  = document.getElementById('note-close');

  async function openQuickNote() {
    notePanel.classList.remove('hidden');
    lockInteractionFor(120000);
    // Load saved note
    if (window.electronAPI) {
      const saved = await window.electronAPI.getNote();
      noteArea.value = saved || '';
    }
    noteArea.focus();
  }

  function closeQuickNote() {
    notePanel.classList.add('hidden');
    clearInteractionLock();
    if (window.electronAPI) window.electronAPI.unlockInteraction();
  }

  noteSave.addEventListener('click', async () => {
    if (window.electronAPI) {
      await window.electronAPI.saveNote(noteArea.value);
    }
    showSpeechBubble('便签已保存 📝');
    setTimeout(hideSpeechBubble, 2000);
    closeQuickNote();
  });

  noteClose.addEventListener('click', closeQuickNote);

  // ── Shortcuts Assistant ─────────────────────────────

  async function activateSiri() {
    showSpeechBubble('正在唤醒 Siri… 🎤');
    if (window.electronAPI) {
      await window.electronAPI.runShortcut('鱼烧助手'); // actually just opens Siri now
    }
    setTimeout(hideSpeechBubble, 4000);
  }

  function feedPet() {
    AnimationSystem.onFeed();
    showSpeechBubble('好吃好吃！谢谢投喂 😋🍙');
    lockInteractionFor(10000);
    setTimeout(hideSpeechBubble, 3000);
    // Save mood
    if (window.electronAPI) {
      window.electronAPI.savePetState({ mood: String(AnimationSystem.getMood()) });
    }
  }

  // ── Head Pet Detection ──────────────────────────────

  let petTrackPoints = [];
  let petTrackTimer = null;

  canvas.addEventListener('mousemove', (e) => {
    if (!isInteractive) return;
    // Track mouse position relative to canvas center (where head is)
    const cx = canvas.width / 2, cy = canvas.height / 2 - 30; // head is above center
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // Only track when near the head (within ~40px)
    if (dist < 40) {
      petTrackPoints.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      // Keep only last 20 points
      if (petTrackPoints.length > 20) petTrackPoints.shift();

      // Check for circular motion: recent points form a rough circle
      if (petTrackPoints.length >= 10) {
        const recent = petTrackPoints.slice(-10);
        if (isCircularMotion(recent) && Date.now() - petTrackPoints[0].t < 1500) {
          triggerHeadPet();
        }
      }
    }
  });

  function isCircularMotion(points) {
    // Check if points move around a center (rough circular detection)
    let totalAngle = 0;
    const center = { x: canvas.width/2, y: canvas.height/2 - 30 };
    for (let i = 1; i < points.length; i++) {
      const a1 = Math.atan2(points[i-1].y - center.y, points[i-1].x - center.x);
      const a2 = Math.atan2(points[i].y - center.y, points[i].x - center.x);
      let diff = a2 - a1;
      if (diff > Math.PI) diff -= 2*Math.PI;
      if (diff < -Math.PI) diff += 2*Math.PI;
      totalAngle += diff;
    }
    // Complete at least ~270 degrees of rotation
    return Math.abs(totalAngle) > Math.PI * 1.5;
  }

  function triggerHeadPet() {
    petTrackPoints = [];
    AnimationSystem.onHeadPet();
    showSpeechBubble('呼噜呼噜~ 🥰');
    lockInteractionFor(8000);
    setTimeout(hideSpeechBubble, 2500);
    if (window.electronAPI) {
      window.electronAPI.savePetState({ mood: String(AnimationSystem.getMood()) });
    }
  }

  // ── Animation callback ──────────────────────────────

  // ── Auto Walk ───────────────────────────────────────

  let autoWalkTimer = null;
  let autoWalkInterval = null;
  let walkIdleTime = 0;

  function scheduleAutoWalk() {
    // Walk every 2-5 minutes when idle
    const delay = 120000 + Math.random() * 180000;
    clearTimeout(autoWalkTimer);
    autoWalkTimer = setTimeout(doAutoWalk, delay);
  }

  function resetAutoWalkTimer() {
    walkIdleTime = 0;
    clearTimeout(autoWalkTimer);
    clearInterval(autoWalkInterval);
    autoWalkInterval = null;
    scheduleAutoWalk();
  }

  async function doAutoWalk() {
    if (isInteractive || DragHandler.isDragging() || !bubble.classList.contains('hidden')) {
      scheduleAutoWalk(); return;
    }
    const state = AnimationSystem.getState();
    if (state !== 'idle' && state !== 'rabbit') {
      scheduleAutoWalk(); return;
    }

    const targetX = 100 + Math.random() * (window.screen.width - 500);
    const targetY = 100 + Math.random() * (window.screen.height - 500);

    AnimationSystem.onDragStart();

    let startPos = { x: 200, y: 200 };
    if (window.electronAPI) {
      const s = await window.electronAPI.getPetState();
      startPos = { x: s.pos_x, y: s.pos_y };
    }

    // Simplified smooth movement: use setInterval with direct setPosition
    const steps = 30;
    const duration = 2500;
    const stepMs = duration / steps;
    let step = 0;
    let prevX = startPos.x, prevY = startPos.y;

    autoWalkInterval = setInterval(() => {
      step++;
      if (step >= steps) {
        clearInterval(autoWalkInterval);
        autoWalkInterval = null;
        AnimationSystem.onDragEnd();
        if (window.electronAPI) window.electronAPI.savePetState({});
        scheduleAutoWalk();
        return;
      }

      const t = step / steps;
      const ease = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2;
      const curX = Math.round(startPos.x + (targetX - startPos.x) * ease);
      const curY = Math.round(startPos.y + (targetY - startPos.y) * ease);
      const dx = curX - prevX;
      const dy = curY - prevY;
      prevX = curX; prevY = curY;

      if (window.electronAPI && (dx !== 0 || dy !== 0)) {
        window.electronAPI.moveWindow({ dx, dy });
      }
    }, stepMs);
  }

  // Override drag handlers to reset auto-walk timer
  const origDragStart = DragHandler.onDragStart;
  DragHandler.onDragStart = function(cb) {
    resetAutoWalkTimer();
    if (origDragStart) origDragStart.call(DragHandler, cb);
    else DragHandler._onDragStartCallback = cb;
  };

  // Start auto-walk after init
  scheduleAutoWalk();

  // Reset timer on any user interaction
  canvas.addEventListener('mousedown', () => resetAutoWalkTimer());
  canvas.addEventListener('dblclick', () => resetAutoWalkTimer());

  function onAnimStateChange(newState, oldState) {
    console.log(`🐱 ${oldState} → ${newState}`);
  }

  // ── Boot ─────────────────────────────────────────────
  init();
})();
