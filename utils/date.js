/**
 * 日期工具
 * 统一手动解析 'YYYY-MM-DD'，避免 iOS JavaScriptCore 对
 * new Date('YYYY-MM-DD') 的解析差异导致的跨天/连续天数错乱。
 */

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function fmt(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function todayStr() { return fmt(new Date()); }

function parseDate(s) {
  const p = String(s).split('-');
  return new Date(+p[0], (+p[1]) - 1, +p[2]);
}

function offsetStr(delta, base) {
  const d = base ? parseDate(base) : new Date();
  d.setDate(d.getDate() + delta);
  return fmt(d);
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function weekday(s) {
  return WEEK[parseDate(s).getDay()];
}

/** 简短日期，如 09.19 */
function shortDate(s) {
  const p = String(s).split('-');
  return p[1] + '.' + p[2];
}

/** 更短日期，如 9/19（用于密集坐标轴的刻度） */
function md(s) {
  const p = String(s).split('-');
  return (+p[1]) + '/' + (+p[2]);
}

/** 连续打卡天数：从今天（或昨天）往回数 */
function streak(dates) {
  if (!dates || !dates.length) return 0;
  const set = {};
  for (let i = 0; i < dates.length; i++) set[dates[i]] = true;
  let cur = todayStr();
  if (!set[cur]) {
    cur = offsetStr(-1);
    if (!set[cur]) return 0;
  }
  let n = 0;
  while (set[cur]) {
    n++;
    cur = offsetStr(-n);
  }
  return n;
}

module.exports = {
  todayStr: todayStr,
  offsetStr: offsetStr,
  parseDate: parseDate,
  weekday: weekday,
  shortDate: shortDate,
  md: md,
  streak: streak
};
