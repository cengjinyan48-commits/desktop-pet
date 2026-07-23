// task-parser.js 单元测试 — node --test 运行（Node 内置，无额外依赖）
//
// 注意：parse() 内部使用 new Date()，日期类断言全部动态计算，
// 保证任何一天跑测试都稳定通过。

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../src/renderer/shared/task-parser.js');

// ── 与解析器同逻辑的日期工具 ─────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }
function fmt(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function offset(days) { const d = new Date(); d.setDate(d.getDate() + days); return fmt(d); }
const today = () => fmt(new Date());

// ── 基础 ────────────────────────────────────────────

test('空输入返回空数组', () => {
  assert.deepEqual(parse(''), []);
  assert.deepEqual(parse('   '), []);
  assert.deepEqual(parse(null), []);
  assert.deepEqual(parse(undefined), []);
});

test('单个任务：内容保留，默认今天', () => {
  const [t] = parse('写周报');
  assert.equal(t.content, '写周报');
  assert.equal(t.date, today());
  assert.equal(t.time_period, null);
  assert.equal(t.suggested_time, null);
  assert.equal(t.priority, 'medium');
});

test('多任务分隔：逗号/顿号/分号/换行', () => {
  const tasks = parse('买菜，做饭、洗碗；拖地\n倒垃圾');
  assert.equal(tasks.length, 5);
  assert.deepEqual(tasks.map(t => t.content), ['买菜', '做饭', '洗碗', '拖地', '倒垃圾']);
});

test('"和/还有/以及"也是分隔符', () => {
  const tasks = parse('开会还有写代码以及回邮件');
  assert.equal(tasks.length, 3);
});

// ── 时段识别 ────────────────────────────────────────

test('时段词：上午/下午/晚上', () => {
  const tasks = parse('上午开会，下午写代码，晚上健身');
  assert.equal(tasks[0].time_period, 'morning');
  assert.equal(tasks[1].time_period, 'afternoon');
  assert.equal(tasks[2].time_period, 'evening');
  // 时段词应从内容中剥离
  assert.equal(tasks[0].content, '开会');
});

// ── 具体时间 ────────────────────────────────────────

test('下午3点 → 15:00 并归入 afternoon', () => {
  const [t] = parse('下午3点开会');
  assert.equal(t.suggested_time, '15:00');
  assert.equal(t.time_period, 'afternoon');
  assert.equal(t.content, '开会');
});

test('上午9点30分 → 09:30', () => {
  const [t] = parse('上午9点30分体检');
  assert.equal(t.suggested_time, '09:30');
  assert.equal(t.time_period, 'morning');
});

test('中午12点不加12（12点边界）', () => {
  const [t] = parse('中午12点吃饭');
  assert.equal(t.suggested_time, '12:00');
  assert.equal(t.time_period, 'afternoon');
});

test('晚上8点 → 20:00 evening', () => {
  const [t] = parse('晚上8点看电影');
  assert.equal(t.suggested_time, '20:00');
  assert.equal(t.time_period, 'evening');
});

test('19点（无时段前缀）按小时归 evening', () => {
  const [t] = parse('19点复盘');
  assert.equal(t.suggested_time, '19:00');
  assert.equal(t.time_period, 'evening');
});

// ── 日期解析 ────────────────────────────────────────

test('明天/后天/大后天', () => {
  assert.equal(parse('明天交报告')[0].date, offset(1));
  assert.equal(parse('后天出差')[0].date, offset(2));
  assert.equal(parse('大后天回来')[0].date, offset(3));
});

test('X月X日：具体日期', () => {
  const y = new Date().getFullYear();
  const [t] = parse('8月15日请假');
  assert.equal(t.date, `${y}-08-15`);
  assert.equal(t.content, '请假');
});

test('非法日期（13月40日）不当日期解析', () => {
  const [t] = parse('13月40日这是一句话');
  assert.equal(t.date, today());
});

test('下周X：落在下一周', () => {
  const [t] = parse('下周三 交方案');
  const d = new Date(t.date + 'T00:00:00');
  assert.equal(d.getDay(), 3);                 // 是周三
  const diffDays = Math.round((d - new Date(today() + 'T00:00:00')) / 86400000);
  assert.ok(diffDays >= 7 && diffDays <= 13, `应在7~13天内，实际${diffDays}天`);
});

test('前置日期作用于后续所有任务', () => {
  const tasks = parse('明天：买票，订酒店');
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].date, offset(1));
  assert.equal(tasks[1].date, offset(1));
});

// ── 重复任务 ────────────────────────────────────────

test('每天 → daily', () => {
  const [t] = parse('每天喝水打卡');
  assert.equal(t.recurrence, 'daily');
  assert.equal(t.recurrence_day, null);
  assert.ok(!t.content.includes('每天'));
});

test('每周三 → weekly day=3', () => {
  const [t] = parse('每周三开例会');
  assert.equal(t.recurrence, 'weekly');
  assert.equal(t.recurrence_day, 3);
});

test('每周日 → weekly day=0', () => {
  const [t] = parse('每周日大扫除');
  assert.equal(t.recurrence, 'weekly');
  assert.equal(t.recurrence_day, 0);
});

test('每月15号 → monthly day=15', () => {
  const [t] = parse('每月15号交房租');
  assert.equal(t.recurrence, 'monthly');
  assert.equal(t.recurrence_day, 15);
});

test('工作日 → weekday', () => {
  const [t] = parse('工作日晨会');
  assert.equal(t.recurrence, 'weekday');
});

// ── 优先级 ──────────────────────────────────────────

test('重要/紧急 → high + is_focus', () => {
  const [t] = parse('紧急修复线上bug');
  assert.equal(t.priority, 'high');
  assert.equal(t.is_focus, 1);
  assert.ok(!t.content.includes('紧急'));
});

test('不急 → low', () => {
  const [t] = parse('不急 整理照片');
  assert.equal(t.priority, 'low');
  assert.equal(t.is_focus, 0);
});

test('默认 medium', () => {
  assert.equal(parse('普通任务')[0].priority, 'medium');
});

// ── 组合场景 ────────────────────────────────────────

test('组合：日期+时间+优先级', () => {
  const [t] = parse('明天下午3点 重要 给客户演示');
  assert.equal(t.date, offset(1));
  assert.equal(t.suggested_time, '15:00');
  assert.equal(t.priority, 'high');
  assert.equal(t.content, '给客户演示');
});

test('纯时段词输入退化后仍产出任务（内容兜底不为空）', () => {
  const tasks = parse('下午开会，晚上');
  // "晚上"剥离时段词后内容为空 → 兜底逻辑或被过滤，均不能产生空 content
  for (const t of tasks) assert.ok(t.content.length > 0);
});
