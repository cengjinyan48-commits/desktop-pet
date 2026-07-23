// Task Panel — Renderer logic (v3: +mini calendar widget)

(function () {
  'use strict';

  // window.electronAPI 由 preload 注入；PetUtils 由 utils.js <script> 提供
  const { todayStr, pad } = window.PetUtils;

  // ── DOM ──────────────────────────────────────────────
  const panel      = document.getElementById('panel');
  const btnClose   = document.getElementById('btn-close');
  const btnSync    = document.getElementById('btn-sync');
  const addInput   = document.getElementById('new-task-input');
  const emptyState = document.getElementById('empty-state');
  const taskGroups = document.getElementById('task-groups');
  const dateDisplay = document.getElementById('date-display');

  // Calendar
  const calDays     = document.getElementById('cal-days');
  const calLabel    = document.getElementById('cal-month-label');
  const calPrev     = document.getElementById('cal-prev');
  const calNext     = document.getElementById('cal-next');
  const calTodayBtn = document.getElementById('cal-today');

  const lists = {
    morning:     document.getElementById('list-morning'),
    afternoon:   document.getElementById('list-afternoon'),
    evening:     document.getElementById('list-evening'),
    unscheduled: document.getElementById('list-unscheduled')
  };

  // ── State ────────────────────────────────────────────
  let allTasks = [];
  let selectedDate = todayStr();
  let calYear, calMonth;
  let taskDates = new Set(); // dates (YYYY-MM-DD) that have tasks

  // ── Init ─────────────────────────────────────────────

  function init() {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth(); // 0-based

    updateDateDisplay();
    renderCalendar();
    loadTasks();

    btnClose.addEventListener('click', () => window.electronAPI.hidePanel());
    btnSync.addEventListener('click', syncCalendar);
    addInput.addEventListener('keydown', onAddKeydown);
    calPrev.addEventListener('click', () => { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCalendar(); });
    calNext.addEventListener('click', () => { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCalendar(); });
    calTodayBtn.addEventListener('click', () => {
      const now = new Date();
      calYear = now.getFullYear();
      calMonth = now.getMonth();
      selectedDate = todayStr();
      updateDateDisplay();
      renderCalendar();
      loadTasks();
    });

    window.electronAPI.onTasksRefreshed(() => {
      loadTasks();
      loadMonthSummary();
    });

    // Load month summary for dot indicators
    loadMonthSummary();

    console.log('📋 Task panel ready');
  }

  // ── Calendar ─────────────────────────────────────────

  function renderCalendar() {
    calLabel.textContent = `${calYear}年 ${calMonth + 1}月`;

    const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

    calDays.innerHTML = '';

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const m = calMonth === 0 ? 11 : calMonth - 1;
      const y = calMonth === 0 ? calYear - 1 : calYear;
      const ds = `${y}-${pad(m+1)}-${pad(day)}`;
      addDayEl(day, 'other-month', ds);
    }

    // Current month days
    const today = todayStr();
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${calYear}-${pad(calMonth+1)}-${pad(d)}`;
      const cls = [];
      if (ds === today) cls.push('today');
      if (ds === selectedDate) cls.push('selected');
      if (taskDates.has(ds)) cls.push('has-tasks');
      addDayEl(d, cls.join(' '), ds);
    }

    // Next month days (fill the grid)
    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
      const m = calMonth === 11 ? 0 : calMonth + 1;
      const y = calMonth === 11 ? calYear + 1 : calYear;
      const ds = `${y}-${pad(m+1)}-${pad(d)}`;
      addDayEl(d, 'other-month', ds);
    }
  }

  function addDayEl(dayNum, className, dateStr) {
    const el = document.createElement('div');
    el.className = 'cal-day ' + (className || '');
    el.textContent = dayNum;
    el.addEventListener('click', () => {
      selectedDate = dateStr;
      updateDateDisplay();
      renderCalendar();
      loadTasks();
    });
    calDays.appendChild(el);
  }

  function updateDateDisplay() {
    const d = new Date(selectedDate + 'T00:00:00');
    const days = ['日','一','二','三','四','五','六'];
    const today = todayStr();
    const prefix = selectedDate === today ? '今天' : '';
    dateDisplay.textContent = `${prefix} ${d.getMonth()+1}月${d.getDate()}日 星期${days[d.getDay()]}`;
  }

  // ── Load month summary (which days have tasks) ──────

  async function loadMonthSummary() {
    try {
      const yearMonth = `${calYear}-${pad(calMonth+1)}`;
      const summary = await window.electronAPI.monthSummary(yearMonth);
      if (summary && Array.isArray(summary)) {
        taskDates = new Set(summary);
        renderCalendar();
      }
    } catch (e) {
      // Silently fail — dots are cosmetic
    }
  }

  // ── Load & Render Tasks ──────────────────────────────

  async function loadTasks() {
    allTasks = await window.electronAPI.getTasks(selectedDate);
    // Refresh month summary
    loadMonthSummary();
    render();
  }

  function render() {
    Object.values(lists).forEach(l => l.innerHTML = '');

    if (allTasks.length === 0) {
      emptyState.classList.remove('hidden');
      taskGroups.style.display = 'none';
      return;
    }

    emptyState.classList.add('hidden');
    taskGroups.style.display = '';

    const grouped = { morning: [], afternoon: [], evening: [], unscheduled: [] };
    for (const task of allTasks) {
      const key = task.time_period || 'unscheduled';
      if (grouped[key]) grouped[key].push(task);
      else grouped.unscheduled.push(task);
    }

    for (const [period, tasks] of Object.entries(grouped)) {
      const groupEl = lists[period].closest('.task-group');
      if (!groupEl) continue;
      groupEl.style.display = tasks.length === 0 ? 'none' : '';
      tasks.forEach(task => lists[period].appendChild(createTaskElement(task)));
    }
  }

  function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = 'task-item';
    if (task.is_focus) li.classList.add('focus');
    if (task.priority === 'high') li.classList.add('priority-high');
    if (task.priority === 'low') li.classList.add('priority-low');
    li.dataset.id = task.id;

    // Focus star
    const focusBtn = document.createElement('button');
    focusBtn.className = 'task-focus-btn' + (task.is_focus ? ' active' : '');
    focusBtn.textContent = task.is_focus ? '⭐' : '☆';
    focusBtn.title = task.is_focus ? '取消焦点' : '设为焦点';
    focusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFocus(task, focusBtn);
    });

    const cb = document.createElement('div');
    cb.className = 'task-checkbox' + (task.status === 'done' ? ' done' : '');
    cb.textContent = '✓';
    cb.addEventListener('click', () => toggleTask(task, cb));

    const content = document.createElement('span');
    content.className = 'task-content' + (task.status === 'done' ? ' done' : '');
    content.textContent = task.content;

    // Priority badge
    if (task.priority === 'high') {
      const badge = document.createElement('span');
      badge.className = 'task-priority high';
      badge.textContent = '高';
      content.prepend(badge);
    } else if (task.priority === 'low') {
      const badge = document.createElement('span');
      badge.className = 'task-priority low';
      badge.textContent = '低';
      content.prepend(badge);
    }

    const time = document.createElement('span');
    time.className = 'task-time';
    if (task.suggested_time) time.textContent = task.suggested_time;
    else if (task.source === 'calendar_sync') time.textContent = '📅';

    const calIcon = document.createElement('span');
    calIcon.className = 'task-cal-icon' + (task.calendar_uid ? ' synced' : '');
    calIcon.textContent = '📅';
    calIcon.title = task.calendar_uid ? '已同步到日历' : '添加到日历';
    if (!task.calendar_uid) {
      calIcon.addEventListener('click', (e) => { e.stopPropagation(); addToCalendar(task); });
    }

    const del = document.createElement('button');
    del.className = 'task-delete';
    del.textContent = '×';
    del.addEventListener('click', (e) => { e.stopPropagation(); deleteTask(task); });

    li.append(focusBtn, cb, content, time, calIcon, del);
    return li;
  }

  async function toggleFocus(task, btn) {
    const newFocus = task.is_focus ? 0 : 1;
    await window.electronAPI.updateTask(task.id, { is_focus: newFocus });
    task.is_focus = newFocus;
    btn.textContent = newFocus ? '⭐' : '☆';
    btn.classList.toggle('active', !!newFocus);
    // Reload to re-sort
    loadTasks();
  }

  // ── CRUD ─────────────────────────────────────────────

  async function toggleTask(task, cbEl) {
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    await window.electronAPI.updateTask(task.id, { status: newStatus });
    task.status = newStatus;
    if (newStatus === 'done') {
      cbEl.classList.add('done');
      cbEl.nextElementSibling.classList.add('done');
      window.electronAPI.triggerPetHappy();
    } else {
      cbEl.classList.remove('done');
      cbEl.nextElementSibling.classList.remove('done');
    }
  }

  async function deleteTask(task) {
    await window.electronAPI.deleteTask(task.id);
    allTasks = allTasks.filter(t => t.id !== task.id);
    render();
    loadMonthSummary();
  }

  async function addToCalendar(task) {
    try {
      const uid = await window.electronAPI.addCalendarEvent({ ...task, date: selectedDate });
      if (uid) {
        task.calendar_uid = uid;
        await window.electronAPI.updateTask(task.id, { calendar_uid: uid });
        render();
      }
    } catch (e) {
      console.error('Calendar add failed:', e);
    }
  }

  async function onAddKeydown(e) {
    if (e.key !== 'Enter') return;
    const text = addInput.value.trim();
    if (!text) return;
    const tasks = await window.electronAPI.parseTasks(text);
    for (const t of tasks) {
      const added = await window.electronAPI.addTask({
        ...t,
        date: t.date || selectedDate,
        source: 'manual'
      });
      if (added) allTasks.push(added);
    }
    addInput.value = '';
    render();
    loadMonthSummary();
  }

  async function syncCalendar() {
    btnSync.textContent = '⏳';
    try {
      await window.electronAPI.syncCalendar();
      await loadTasks();
      btnSync.textContent = '✅';
      setTimeout(() => { btnSync.textContent = '🔄'; }, 1500);
    } catch (e) {
      console.error('Sync failed:', e);
      btnSync.textContent = '❌';
      setTimeout(() => { btnSync.textContent = '🔄'; }, 2000);
    }
  }

  init();
})();
