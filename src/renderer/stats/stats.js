// Stats panel — load & display stats
(function () {
  'use strict';
  const { ipcRenderer } = require('electron');

  async function load() {
    try {
      const s = await ipcRenderer.invoke('stats:get');
      if (!s || !s.today) return;

      // Today
      document.getElementById('today-rate').textContent = s.today.rate + '%';
      document.getElementById('today-detail').textContent = s.today.done + '/' + s.today.total + ' 个任务';

      // Week
      document.getElementById('week-rate').textContent = s.week.rate + '%';
      document.getElementById('week-detail').textContent = s.week.done + '/' + s.week.total + ' 个任务';

      // Streak
      document.getElementById('streak-num').textContent = s.streak || 0;

      // Period breakdown
      document.getElementById('cnt-morning').textContent   = s.periods.morning   || 0;
      document.getElementById('cnt-afternoon').textContent = s.periods.afternoon || 0;
      document.getElementById('cnt-evening').textContent   = s.periods.evening   || 0;

      // Highlight busiest period
      for (const p of ['morning','afternoon','evening']) {
        document.getElementById('p-' + p).classList.remove('busiest');
      }
      if (s.busiest && s.busiest.includes('上午')) document.getElementById('p-morning').classList.add('busiest');
      else if (s.busiest && s.busiest.includes('下午')) document.getElementById('p-afternoon').classList.add('busiest');
      else if (s.busiest && s.busiest.includes('晚上')) document.getElementById('p-evening').classList.add('busiest');
    } catch (e) {
      console.error('Stats load error:', e);
    }
  }

  document.getElementById('btn-close').addEventListener('click', () => {
    ipcRenderer.invoke('stats:close');
  });

  load();
})();
