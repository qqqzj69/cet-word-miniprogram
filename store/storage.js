/**
 * 本地持久化层
 * - 单 key 根对象，所有学习数据都在 cet_word_db_v1 下
 * - wx.setStorageSync 写入即落盘，进程被杀也不丢
 * - 读取时容错：任何异常都回退到默认值，绝不因数据损坏而白屏
 * - 只有用户主动「清空学习数据」才会移除该 key
 */
const KEY = 'cet_word_db_v1';
const VERSION = 1;

function defaults() {
  return {
    v: VERSION,
    level: 'cet4',
    goal: 20,
    words: {},      // { [word]: { s: 阶段0-6, n: 下次复习时间戳, w: 错误次数, l: 最近学习时间 } }
    daily: {},      // { 'YYYY-MM-DD': { learned, right, vague, wrong } }
    checkins: [],   // ['YYYY-MM-DD']
    sessions: {},   // { daily: {...}, wrong: {...} } 当日学习队列
    createdAt: Date.now()
  };
}

function load() {
  try {
    const raw = wx.getStorageSync(KEY);
    if (!raw) return defaults();
    let db = raw;
    if (typeof raw === 'string') {
      try { db = JSON.parse(raw); } catch (e) { return defaults(); }
    }
    if (!db || typeof db !== 'object') return defaults();
    return normalize(db);
  } catch (e) {
    console.warn('[storage] load failed, fallback to defaults', e);
    return defaults();
  }
}

/** 补齐缺失字段，兼容旧版本数据 */
function normalize(db) {
  const d = defaults();
  const out = {
    v: VERSION,
    level: (db.level === 'cet6') ? 'cet6' : 'cet4',
    goal: clampGoal(db.goal, d.goal),
    words: isObj(db.words) ? db.words : {},
    daily: isObj(db.daily) ? db.daily : {},
    checkins: Array.isArray(db.checkins) ? db.checkins : [],
    sessions: isObj(db.sessions) ? db.sessions : {},
    createdAt: db.createdAt || d.createdAt
  };
  return out;
}

function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }

function clampGoal(v, def) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return def;
  return Math.min(100, Math.max(5, n));
}

function save(db) {
  try {
    wx.setStorageSync(KEY, db);
  } catch (e) {
    console.warn('[storage] save failed', e);
  }
}

/** 危险操作：仅由「我的 → 清空学习数据」在二次确认后调用 */
function reset() {
  try {
    wx.removeStorageSync(KEY);
  } catch (e) { /* ignore */ }
}

module.exports = {
  KEY: KEY,
  defaults: defaults,
  load: load,
  save: save,
  reset: reset
};
