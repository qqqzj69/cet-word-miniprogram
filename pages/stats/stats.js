const progress = require('../../store/progress');

Page({
  data: {
    st: null,
    weekBars: []
  },

  onShow() {
    const st = progress.getStats();
    const max = st.weekMax || 1;
    const weekBars = st.week.map(function (d, idx) {
      return {
        date: d.date,
        label: d.label,
        learned: d.learned,
        isToday: idx === 6,
        hPct: Math.round((d.learned / max) * 100),
        isEmpty: d.learned === 0
      };
    });
    this.setData({ st: st, weekBars: weekBars });
  },

  onCheckin() {
    const r = progress.checkin();
    wx.showToast({
      title: r.ok ? '打卡成功 · 连续 ' + r.streak + ' 天' : r.msg,
      icon: 'none'
    });
    if (r.ok) this.onShow();
  }
});
