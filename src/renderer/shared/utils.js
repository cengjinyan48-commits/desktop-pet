// Shared utilities (renderer + main process safe — no DOM deps)

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function offsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return fmtDate(d);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { todayStr, pad, fmtDate, offsetDate };
}
if (typeof window !== 'undefined') {
  window.PetUtils = { todayStr, pad, fmtDate, offsetDate };
}
