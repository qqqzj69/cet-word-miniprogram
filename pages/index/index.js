const progress = require('../../store/progress');
const dict = require('../../data/index');

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

Page({
  data: {
    ov: null,
    percent: 0,
    heroBtn: '',
    greeting: '',
    historyDays: 0,
    kw: '',
    results: [],
    searching: false,
    remaining: 0,
    showRemaining: false
  },

  onShow() {
    // onShow 兜底处理跨天：ensureSession 内部会自动重建当日队列
    const ov = progress.getOverview();
    const percent = ov.queueTotal > 0
      ? Math.min(100, Math.round(ov.done * 100 / ov.queueTotal))
      : 100;
    let heroBtn = '开始学习';
    if (ov.done >= ov.queueTotal && ov.queueTotal > 0) heroBtn = '继续加练';
    else if (ov.done > 0) heroBtn = '继续学习';

    // 「还差多少词」只在今天第一次开始、还没背过时提示；
    // 一旦进入「继续学习/继续加练」就不再显示，避免造成压力
    const showRemaining = ov.done === 0 && !ov.checkedToday && ov.queueTotal > 0;

    this.setData({
      ov: ov,
      percent: percent,
      heroBtn: heroBtn,
      greeting: greeting(),
      historyDays: progress.getHistoryDays(),
      remaining: Math.max(0, ov.queueTotal - ov.done),
      showRemaining: showRemaining
    });
  },

  /* ---------------- 学习 ---------------- */

  goStudy() {
    // 学完一轮也能进去，学习页提供「继续加练」
    wx.navigateTo({ url: '/pages/study/study' });
  },

  /* ---------------- 打卡状态灯 ---------------- */

  onCheckin() {
    const r = progress.checkin();
    wx.showToast({
      title: r.ok ? '打卡成功 · 连续 ' + r.streak + ' 天' : r.msg,
      icon: 'none'
    });
    this.onShow();
  },

  /* ---------------- 顶部搜索 ---------------- */

  onSearchInput(e) {
    const kw = e.detail.value;
    this.setData({ kw: kw });
    if (this.timer) clearTimeout(this.timer);
    const self = this;
    this.timer = setTimeout(function () { self.homeSearch(kw); }, 300);
  },

  /** 首页轻量查询：只取前 6 条，完整结果交给查词页 */
  homeSearch(kw) {
    if (!kw || !kw.trim()) {
      this.setData({ results: [], searching: false });
      return;
    }
    const list = dict.searchWords(progress.getLevel(), kw, 6).map(function (x) {
      return { i: x.i, w: x.w, m: x.m };
    });
    this.setData({ results: list, searching: true });
  },

  onClearSearch() {
    this.setData({ kw: '', results: [], searching: false });
  },

  goSeeAll() {
    const kw = this.data.kw || '';
    wx.navigateTo({ url: '/pages/search/search?kw=' + encodeURIComponent(kw) });
  },

  /* ---------------- 辅助入口 ---------------- */

  goWrong() {
    wx.navigateTo({ url: '/pages/wrong/wrong' });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' });
  }
});
