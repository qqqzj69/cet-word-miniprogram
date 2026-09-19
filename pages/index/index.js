const progress = require('../../store/progress');

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
    historyDays: 0
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
    this.setData({
      ov: ov,
      percent: percent,
      heroBtn: heroBtn,
      greeting: greeting(),
      historyDays: progress.getHistoryDays()
    });
  },

  goStudy() {
    // 学完一轮也能进去，学习页提供「继续加练」
    wx.navigateTo({ url: '/pages/study/study' });
  },

  goWrong() {
    wx.navigateTo({ url: '/pages/wrong/wrong' });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  onCheckin() {
    const r = progress.checkin();
    if (r.ok) {
      wx.showToast({ title: '打卡成功 · 连续 ' + r.streak + ' 天', icon: 'none' });
    } else {
      wx.showToast({ title: r.msg, icon: 'none' });
    }
    this.onShow();
  }
});
