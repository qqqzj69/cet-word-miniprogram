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
const MAX_DAILY_LIST = 200;   // 单日历史明细上限，防止长期使用时存储无限膨胀

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

/**
 * 丢弃当前会话并重建，用于「继续加练」学完一轮后再来一批
 * @param {string} mode 'daily' | 'wrong'
 * @param {number} [count] 本轮词数（10/15/20），不传则沿用每日目标
 */
function resetSession(mode, count) {
  const d = getDb();
  if (!d.sessions) d.sessions = {};
  delete d.sessions[mode];

  const savedGoal = d.goal;
  const n = parseInt(count, 10);
  if (!isNaN(n) && n >= 5 && n <= 100) {
    d.goal = n;               // 只影响这一轮的队列大小，不改每日目标
    const s = ensureSession(mode);
    d.goal = savedGoal;
    persist();
    return s;
  }
  return ensureSession(mode);
}

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
  const dayRec = d.daily[t] || { learned: 0, right: 0, vague: 0, wrong: 0, list: [] };
  dayRec.learned++;
  if (rating === 'right') dayRec.right++;
  else if (rating === 'vague') dayRec.vague++;
  else dayRec.wrong++;

  // 记录当日学习明细（单词 + 释义 + 评价），供「每日背单词历史」展示
  if (!Array.isArray(dayRec.list)) dayRec.list = [];
  const detail = dict.getWord(d.level, word);
  dayRec.list.push({ w: word, m: detail ? detail.m : '', r: rating });
  if (dayRec.list.length > MAX_DAILY_LIST) {
    dayRec.list = dayRec.list.slice(dayRec.list.length - MAX_DAILY_LIST);
  }
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

/* ---------------- 每日历史 ---------------- */

function ratingText(r) {
  if (r === 'right') return '认识';
  if (r === 'vague') return '模糊';
  if (r === 'wrong') return '不认识';
  return '';
}

/**
 * 分页取「每日背单词历史」，按日期倒序
 * @param {number} limit  本页天数，0 表示全部
 * @param {number} offset 已加载天数
 * @returns {{days: Array, total: number, hasMore: boolean}}
 */
function getHistory(limit, offset) {
  const d = getDb();
  const dates = Object.keys(d.daily).sort().reverse();
  const total = dates.length;
  const start = offset > 0 ? offset : 0;
  const end = (limit && limit > 0) ? Math.min(total, start + limit) : total;
  const slice = dates.slice(start, end);

  const days = slice.map(function (ds) {
    const rec = d.daily[ds] || {};
    const list = Array.isArray(rec.list) ? rec.list : [];
    return {
      date: ds,
      shortDate: dateUtil.shortDate(ds),
      label: dateUtil.weekday(ds),
      isToday: ds === today(),
      isYesterday: ds === dateUtil.offsetStr(-1),
      learned: rec.learned || list.length || 0,
      right: rec.right || 0,
      vague: rec.vague || 0,
      wrong: rec.wrong || 0,
      hasWords: list.length > 0,
      words: list.map(function (x, i) {
        return { id: i + '-' + x.w, w: x.w, m: x.m, r: x.r, rText: ratingText(x.r) };
      })
    };
  });

  return { days: days, total: total, hasMore: end < total };
}

/** 有记录的天数，用于首页入口的角标 */
function getHistoryDays() {
  return Object.keys(getDb().daily).length;
}

/** 读取某词当前的记忆状态，用于撤销前的快照 */
function getWordState(word) {
  const st = getDb().words[word];
  return st ? { s: st.s, n: st.n, w: st.w, l: st.l } : null;
}

/**
 * 撤销一次评价：还原该词的记忆状态、扣回当日计数、
 * 移除当日明细中最后一条该词的记录，并回退会话进度
 */
function restoreWordState(mode, word, prev, rating) {
  const d = getDb();
  if (prev) {
    d.words[word] = { s: prev.s, n: prev.n, w: prev.w, l: prev.l };
  } else {
    delete d.words[word];
  }

  const t = today();
  const rec = d.daily[t];
  if (rec) {
    rec.learned = Math.max(0, (rec.learned || 0) - 1);
    if (rating === 'right') rec.right = Math.max(0, (rec.right || 0) - 1);
    else if (rating === 'vague') rec.vague = Math.max(0, (rec.vague || 0) - 1);
    else rec.wrong = Math.max(0, (rec.wrong || 0) - 1);
    if (Array.isArray(rec.list) && rec.list.length) {
      for (let i = rec.list.length - 1; i >= 0; i--) {
        if (rec.list[i].w === word && rec.list[i].r === rating) {
          rec.list.splice(i, 1);
          break;
        }
      }
    }
  }

  const s = d.sessions[mode];
  if (s) s.i = Math.max(0, s.i - 1);
  persist();
}

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
function getStats(range) {
  const d = getDb();
  const t = today();
  const day = d.daily[t] || { learned: 0, right: 0, vague: 0, wrong: 0 };
  const r = (range === 30 || range === 90) ? range : 7;

  const bars = [];
  let rangeTotal = 0;
  let rangeMax = 0;
  let activeDays = 0;

  if (r === 90) {
    // 90 天按周聚合，最近 13 周
    const WEEKS = 13;
    for (let w = WEEKS - 1; w >= 0; w--) {
      let sum = 0;
      for (let k = 0; k < 7; k++) {
        const rec = d.daily[dateUtil.offsetStr(-(w * 7 + k))];
        if (rec) sum += (rec.learned || 0);
      }
      if (sum > 0) activeDays++;
      if (sum > rangeMax) rangeMax = sum;
      rangeTotal += sum;
      bars.push({
        label: w === 0 ? '本周' : (w % 2 === 0 ? w + '周前' : ''),
        value: sum,
        showLabel: true
      });
    }
  } else {
    for (let i = r - 1; i >= 0; i--) {
      const ds = dateUtil.offsetStr(-i);
      const rec = d.daily[ds];
      const v = rec ? (rec.learned || 0) : 0;
      if (v > 0) activeDays++;
      if (v > rangeMax) rangeMax = v;
      rangeTotal += v;
      bars.push({
        label: i === 0 ? '今天' : (r === 7 ? dateUtil.weekday(ds) : dateUtil.shortDate(ds)),
        value: v,
        // 30 天时柱子密集，标签隔 5 根显示一次
        showLabel: r === 7 ? true : ((r - 1 - i) % 5 === 0 || i === 0)
      });
    }
  }

  const week = [];
  for (let i = 6; i >= 0; i--) {
    const ds = dateUtil.offsetStr(-i);
    const rec = d.daily[ds];
    week.push({
      date: ds,
      label: i === 0 ? '今天' : dateUtil.weekday(ds),
      learned: rec ? (rec.learned || 0) : 0
    });
  }

  let totalLearned = 0;
  for (const k in d.daily) totalLearned += (d.daily[k].learned || 0);

  return {
    today: day,
    accuracy: day.learned ? Math.round(day.right * 100 / day.learned) : 0,
    week: week,
    weekMax: Math.max.apply(null, week.map(function (x) { return x.learned; }).concat([1])),
    weekTotal: week.reduce(function (a, b) { return a + b.learned; }, 0),
    range: r,
    bars: bars,
    rangeTotal: rangeTotal,
    rangeMax: rangeMax || 1,
    rangeActiveDays: activeDays,
    rangeAvg: activeDays ? Math.round(rangeTotal / activeDays) : 0,
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
  resetSession: resetSession,
  rate: rate,
  checkin: checkin,
  getLevel: getLevel,
  getSettings: getSettings,
  getWordState: getWordState,
  restoreWordState: restoreWordState,
  masterWord: masterWord,
  getOverview: getOverview,
  getStats: getStats,
  getLevelProgress: getLevelProgress,
  getWrongList: getWrongList,
  getHistory: getHistory,
  getHistoryDays: getHistoryDays,
  resetAll: resetAll
};
