/**
 * Node 冒烟测试：验证 store 层业务逻辑（不依赖微信开发者工具）
 * 运行：node tests/smoke.js
 */
const assert = require('assert');
const path = require('path');
const Module = require('module');

/* ---------- wx mock：用内存对象模拟本地存储 ---------- */
const mem = {};
global.wx = {
  getStorageSync(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : ''; },
  setStorageSync(k, v) { mem[k] = JSON.parse(JSON.stringify(v)); }, // 序列化，模拟真实落盘
  removeStorageSync(k) { delete mem[k]; }
};

const ROOT = path.join(__dirname, '..');
function purge() {
  ['store/progress.js', 'store/storage.js', 'data/index.js', 'data/cet4.js', 'data/cet6.js', 'utils/date.js']
    .forEach((p) => delete require.cache[path.join(ROOT, p)]);
}

function fresh() {
  purge();
  return require(path.join(ROOT, 'store/progress.js'));
}

const KEY = 'cet_word_db_v1';
const TODAY = (() => {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
})();

let passed = 0;
function ok(name, cond) {
  assert(cond, 'FAILED: ' + name);
  passed++;
  console.log('  ✓', name);
}

/* ================= 用例 ================= */
console.log('\n[1] 词库数据');
const dict = require(path.join(ROOT, 'data/index.js'));
const cet4 = dict.getWords('cet4');
const cet6 = dict.getWords('cet6');
ok('四级词库非空且含释义', cet4.length > 4000 && cet4.every((x) => x.w && x.m));
ok('六级词库非空且含释义', cet6.length > 3000 && cet6.every((x) => x.w && x.m));
ok('按词查词可命中', dict.getWord('cet4', cet4[0].w).w === cet4[0].w);

console.log('\n[2] 首日学习流程');
let progress = fresh();
progress.init();
let ov = progress.getOverview();
ok('默认四级词库', ov.level === 'cet4');
ok('当日队列已生成且不超过目标', ov.queueTotal > 0 && ov.queueTotal <= ov.goal);
ok('初始进度为 0', ov.done === 0);

let s = progress.getSession('daily');
const firstWord = s.q[0];
for (let i = 0; i < s.q.length; i++) {
  progress.rate('daily', s.q[i], i % 3 === 0 ? 'wrong' : i % 3 === 1 ? 'vague' : 'right');
}
ov = progress.getOverview();
ok('学完一轮后进度到达队尾', ov.done === ov.queueTotal);
ok('当日学习数与队列一致', ov.today.learned === ov.queueTotal);

console.log('\n[3] 打卡');
let r = progress.checkin();
ok('学完即可打卡成功', r.ok === true);
r = progress.checkin();
ok('重复打卡被拒绝', r.ok === false);
const freshProgress = fresh();
const r2 = freshProgress.checkin();
ok('未学习时打卡被拒绝', r2.ok === false);

console.log('\n[4] 杀进程后数据不丢（重新从存储加载）');
progress = fresh();
progress.init();
ov = progress.getOverview();
ok('进度仍在（done 保持队尾）', ov.done === ov.queueTotal);
ok('当日学习数仍在', ov.today.learned === ov.queueTotal);
ok('打卡记录仍在', ov.checkedToday === true);
ok('连续打卡为 1 天', ov.streak === 1);

console.log('\n[5] 错词本');
const wrongList = progress.getWrongList();
ok('答错的词进入错词本', wrongList.length > 0 && wrongList.every((x) => x.wrong > 0));
const firstWrong = wrongList[0].w;
progress.masterWord(firstWrong);
ok('标记已掌握后移出错词本', progress.getWrongList().every((x) => x.w !== firstWrong));

console.log('\n[6] 跨天复习队列');
// 直接改落盘数据，模拟“过了一天”
const raw = JSON.parse(JSON.stringify(mem[KEY]));
raw.sessions.daily.d = '2026-09-01';
// 把部分已学词的下次复习时间挪到过去
let moved = 0;
for (const w in raw.words) {
  if (raw.words[w].s >= 1) { raw.words[w].n = Date.now() - 1000; moved++; }
  if (moved >= 5) break;
}
mem[KEY] = raw;
progress = fresh();
progress.init();
ov = progress.getOverview();
ok('跨天后队列重建', ov.done === 0);
ok('到期复习词优先进入队列', ov.queueTotal > 0);
const session = progress.getSession('daily');
ok('队列前部为到期复习词', session.q.slice(0, Math.min(5, moved)).every((w) => raw.words[w] && raw.words[w].n <= Date.now()));

console.log('\n[7] 换词库 / 换目标');
progress.setLevel('cet6');
ov = progress.getOverview();
ok('切到六级后队列重建且基于六级词库', ov.level === 'cet6' && ov.done === 0);
progress.setGoal(10);
ok('修改每日目标生效', progress.getSettings().goal === 10);
progress.setLevel('cet4');
ok('切回四级后设置保留', progress.getSettings().level === 'cet4');

console.log('\n[8] 存储容错');
mem[KEY] = 'not-a-json{{{';
ok('存储损坏时回退默认值', fresh().getOverview().queueTotal >= 0 && progress !== null);
mem[KEY] = { v: 1, level: 'bogus', goal: 9999 };
const p2 = fresh();
ok('非法字段被归一化', p2.getSettings().level === 'cet4' && p2.getSettings().goal <= 100);
delete mem[KEY];
ok('空存储可正常初始化', fresh().getOverview().queueTotal > 0);

console.log('\n[9] 清空数据');
progress = fresh();
progress.init();
progress.rate('daily', progress.getSession('daily').q[0], 'right');
progress.checkin();
progress.resetAll();
const after = fresh();
const ovAfter = after.getOverview();
ok('清空后回到初始态', ovAfter.done === 0 && ovAfter.today.learned === 0 && ovAfter.checkedToday === false);

console.log('\n[10] 每日背单词历史');
progress = fresh();
progress.init();
// 造三天历史：今天 + 昨天 + 前天
const histSeed = JSON.parse(JSON.stringify(mem[KEY]));
const t0 = Date.now();
['2026-09-17', '2026-09-18'].forEach(function (ds, idx) {
  histSeed.daily[ds] = {
    learned: 2, right: 1, vague: 1, wrong: 0,
    list: [
      { w: 'day' + idx + 'a', m: '释义A', r: 'right' },
      { w: 'day' + idx + 'b', m: '释义B', r: 'vague' }
    ]
  };
});
mem[KEY] = histSeed;
progress = fresh();
progress.init();

let h = progress.getHistory(10, 0);
ok('历史天数 = 2（尚未学习今天）', h.total === 2);
ok('按日期倒序，最新在前', h.days[0].date > h.days[1].date);
ok('能看到昨天', h.days.some(function (x) { return x.date === '2026-09-18'; }));
ok('能看到更早的记录', h.days.some(function (x) { return x.date === '2026-09-17'; }));
ok('每天带单词与释义', h.days[1].words.length === 2 && h.days[1].words[0].m === '释义A');
ok('评价转中文标签', h.days[1].words[0].rText === '认识' && h.days[1].words[1].rText === '模糊');

// 学习后当天明细追加，且排到最前
progress.rate('daily', progress.getSession('daily').q[0], 'wrong');
h = progress.getHistory(10, 0);
ok('学习后新增今天，且排第一', h.total === 3 && h.days[0].isToday === true);
ok('今日记录含刚学的词与释义', h.days[0].words.some(function (x) { return x.m && x.m.length > 0; }));
ok('今日记录含不认识标签', h.days[0].words.some(function (x) { return x.rText === '不认识'; }));

// 分页
const page1 = progress.getHistory(2, 0);
ok('分页：首页 2 条且提示还有更多', page1.days.length === 2 && page1.hasMore === true);
const page2 = progress.getHistory(2, 2);
ok('分页：第二页 1 条且无更多', page2.days.length === 1 && page2.hasMore === false);
ok('分页：两页不重复且覆盖全部',
  page1.days[0].date !== page2.days[0].date && (page1.days.length + page2.days.length) === 3);

// 空状态
delete mem[KEY];
const emptyH = fresh().getHistory(10, 0);
ok('无记录时返回空列表', emptyH.total === 0 && emptyH.days.length === 0 && emptyH.hasMore === false);

console.log('\n全部通过：' + passed + ' 项 ✓');
