/**
 * 学习进度与记忆算法（核心业务层）
 *
 * 记忆模型：简化艾宾浩斯
 *   stage 0-6，间隔 1/2/4/7/15/30 天
 *   认识 → stage+1；模糊 → stage-1；不认识 → 归 0 且 10 分钟后即到期
 *
 * 会话（session）设计：
 *   每日队列只构建一次并落盘，保证中断重进后队列顺序不变，
 *   进度 i 与队列长度比较即可判断今日是否完成。
 */
const dict = require('../data/index');
const storage = require('./storage');
const dateUtil = require('../utils/date');

const INTERVAL_DAYS = [1, 2, 4, 7, 15, 30];
const DAY = 24 * 60 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;
const WRONG_QUEUE_CAP = 50;

let db = null;

/* ---------------- 基础 ---------------- */

function getDb() {
  if (!db) db = storage.load();
  return db;
}

function init() { return getDb(); }

/** 立即落盘 */
function persist() {
  if (db) storage.save(db);
}

function today() { return dateUtil.todayStr(); }

/** 当前词库 key：'cet4' | 'cet6' */
function getLevel() { return getDb().level; }

/** 当前设置（词库 + 每日目标） */
function getSettings() {
  const d = getDb();
  return { level: d.level, goal: d.goal };
}

/** 错词本中手动标记已掌握：清除错误计数并拉高记忆阶段 */
function masterWord(word) {
  const d = getDb();
  const st = d.words[word];
  if (!st) return;
  st.w = 0;
  st.s = Math.max(st.s || 0, 4);
  st.n = Date.now() + INTERVAL_DAYS[5] * DAY;
  persist();
}

/** 已构建的当日会话（不触发重建） */
function getSession(mode) { return getDb().sessions[mode] || null; }

/* ---------------- 设置 ---------------- */

function setLevel(lv) {
  if (lv !== 'cet4' && lv !== 'cet6') return;
  const d = getDb();
  if (d.level === lv) return;
  d.level = lv;
  d.sessions = {};   // 换词库即重建当日队列
  persist();
}

function setGoal(n) {
  const d = getDb();
  const v = parseInt(n, 10);
  if (isNaN(v)) return;
  d.goal = Math.min(100, Math.max(5, v));
  d.sessions = {};
  persist();
}

/* ---------------- 队列构建 ---------------- */

/** 当日队列：到期复习词优先（最久未复习在前），再补新词 */
function buildDailyQueue(d) {
  const words = dict.getWords(d.level);
  const now = Date.now();
  const due = [];
  const fresh = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].w;
    const st = d.words[w];
    if (!st) fresh.push(w);
    else if (st.n <= now) due.push(w);
  }
  due.sort(function (a, b) { return d.words[a].n - d.words[b].n; });
  return due.concat(fresh).slice(0, d.goal);
}

/** 错词队列：错误次数多、最近答错的优先 */
function buildWrongQueue(d) {
  const words = dict.getWords(d.level);
  const list = [];
  for (let i = 0; i < words.length; i++) {
    const st = d.words[words[i].w];
    if (st && st.w > 0) list.push(words[i].w);
  }
  list.sort(function (a, b) {
    return (d.words[b].w - d.words[a].w) || (d.words[a].n - d.words[b].n);
  });
  return list.slice(0, WRONG_QUEUE_CAP);
}

/**
 * 取当日会话；跨天 / 换词库 / 换目标后自动重建
 * @param {'daily'|'wrong'} mode
 */
function ensureSession(mode) {
  const d = getDb();
  const t = today();
  let s = d.sessions[mode];
  if (s && s.d === t && s.lv === d.level) return s;
  s = {
    d: t,
    lv: d.level,
    q: (mode === 'wrong') ? buildWrongQueue(d) : buildDailyQueue(d),
    i: 0
  };
  d.sessions[mode] = s;
  persist();
  return s;
}

/* ---------------- 学习动作 ---------------- */

/**
 * 对一个单词作出评价
 * @param {string} mode 'daily' | 'wrong'
 * @param {string} word
 * @param {'right'|'vague'|'wrong'} rating
 */
function rate(mode, word, rating) {
  const d = getDb();
  const now = Date.now();
  const st = d.words[word] || { s: 0, n: 0, w: 0 };

  if (rating === 'wrong') {
    st.s = 0;
    st.w = (st.w || 0) + 1;
    st.n = now + TEN_MIN;
  } else if (rating === 'vague') {
    st.s = Math.max(0, (st.s || 0) - 1);
    st.n = now + INTERVAL_DAYS[Math.min(INTERVAL_DAYS.length - 1, st.s)] * DAY;
  } else {
    st.s = Math.min(6, (st.s || 0) + 1);
    st.n = now + INTERVAL_DAYS[Math.min(INTERVAL_DAYS.length - 1, st.s - 1)] * DAY;
  }
  st.l = now;
  d.words[word] = st;

  const t = today();
  const dayRec = d.daily[t] || { learned: 0, right: 0, vague: 0, wrong: 0 };
  dayRec.learned++;
  if (rating === 'right') dayRec.right++;
  else if (rating === 'vague') dayRec.vague++;
  else dayRec.wrong++;
  d.daily[t] = dayRec;

  const s = d.sessions[mode];
  if (s) s.i = Math.min(s.q.length, s.i + 1);
  persist();
}

/* ---------------- 打卡 ---------------- */

function checkin() {
  const d = getDb();
  const t = today();
  const day = d.daily[t];
  if (!day || day.learned < 1) {
    return { ok: false, msg: '今天还没学过单词，先学 1 个再来打卡' };
  }
  if (d.checkins.indexOf(t) >= 0) {
    return { ok: false, msg: '今天已经打过卡啦' };
  }
  d.checkins.push(t);
  d.checkins.sort();
  persist();
  return { ok: true, streak: dateUtil.streak(d.checkins) };
}

/* ---------------- 查询 ---------------- */

/** 当前词库的学习进度 */
function getLevelProgress() {
  const d = getDb();
  const words = dict.getWords(d.level);
  let learned = 0, mastered = 0, wrong = 0;
  for (let i = 0; i < words.length; i++) {
    const st = d.words[words[i].w];
    if (!st) continue;
    learned++;
    if (st.s >= 4) mastered++;
    if (st.w > 0) wrong++;
  }
  return { learned: learned, mastered: mastered, wrong: wrong, total: words.length };
}

/** 首页概览 */
function getOverview() {
  const d = getDb();
  const t = today();
  const s = ensureSession('daily');
  const day = d.daily[t] || { learned: 0, right: 0, vague: 0, wrong: 0 };
  return {
    date: t,
    weekday: dateUtil.weekday(t),
    level: d.level,
    levelName: dict.getLevelName(d.level),
    goal: d.goal,
    done: s.i,
    queueTotal: s.q.length,
    today: day,
    streak: dateUtil.streak(d.checkins),
    checkedToday: d.checkins.indexOf(t) >= 0,
    acc: getLevelProgress()
  };
}

/** 统计页 */
function getStats() {
  const d = getDb();
  const t = today();
  const day = d.daily[t] || { learned: 0, right: 0, vague: 0, wrong: 0 };

  const week = [];
  let totalWeek = 0;
  for (let i = 6; i >= 0; i--) {
    const ds = dateUtil.offsetStr(-i);
    const rec = d.daily[ds];
    const learned = rec ? (rec.learned || 0) : 0;
    totalWeek += learned;
    week.push({
      date: ds,
      label: i === 0 ? '今天' : dateUtil.weekday(ds),
      learned: learned
    });
  }

  let totalLearned = 0;
  for (const k in d.daily) totalLearned += (d.daily[k].learned || 0);

  return {
    today: day,
    accuracy: day.learned ? Math.round(day.right * 100 / day.learned) : 0,
    week: week,
    weekMax: Math.max.apply(null, week.map(function (x) { return x.learned; }).concat([1])),
    weekTotal: totalWeek,
    totalLearned: totalLearned,
    streak: dateUtil.streak(d.checkins),
    totalCheckins: d.checkins.length,
    checkedToday: d.checkins.indexOf(t) >= 0,
    acc: getLevelProgress(),
    levelName: dict.getLevelName(d.level)
  };
}

/** 错词本 */
function getWrongList() {
  const d = getDb();
  const words = dict.getWords(d.level);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const st = d.words[words[i].w];
    if (st && st.w > 0) {
      out.push({
        w: words[i].w,
        m: words[i].m,
        wrong: st.w,
        stage: st.s
      });
    }
  }
  out.sort(function (a, b) { return (b.wrong - a.wrong) || (a.w < b.w ? -1 : 1); });
  return out;
}

/** 清空全部学习数据（仅「我的」页二次确认后调用） */
function resetAll() {
  storage.reset();
  db = storage.load();
  persist();
}

module.exports = {
  init: init,
  persist: persist,
  setLevel: setLevel,
  setGoal: setGoal,
  ensureSession: ensureSession,
  getSession: getSession,
  rate: rate,
  checkin: checkin,
  getLevel: getLevel,
  getSettings: getSettings,
  masterWord: masterWord,
  getOverview: getOverview,
  getStats: getStats,
  getLevelProgress: getLevelProgress,
  getWrongList: getWrongList,
  resetAll: resetAll
};
