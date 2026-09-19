const progress = require('../../store/progress');
const dict = require('../../data/index');

const GOAL_OPTIONS = [10, 15, 20, 30, 50];

Page({
  data: {
    level: 'cet4',
    goal: 20,
    levels: [],
    goalOptions: GOAL_OPTIONS,
    counts: { learned: 0, total: 0, wrong: 0 }
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const levels = dict.LEVELS.map(function (lv) {
      return {
        key: lv.key,
        name: lv.name,
        short: lv.short,
        count: dict.getCount(lv.key)
      };
    });
    const st = progress.getSettings();
    this.setData({
      level: st.level,
      goal: st.goal,
      levels: levels,
      counts: progress.getLevelProgress()
    });
  },

  onPickLevel(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.level) return;
    const self = this;
    wx.showModal({
      title: '切换词库',
      content: '切换到「' + dict.getLevelName(key) + '」？今日学习队列将重新生成，已有进度保留。',
      success(res) {
        if (res.confirm) {
          progress.setLevel(key);
          self.refresh();
        }
      }
    });
  },

  onPickGoal(e) {
    const n = parseInt(e.currentTarget.dataset.n, 10);
    if (n === this.data.goal) return;
    progress.setGoal(n);
    this.refresh();
    wx.showToast({ title: '每日目标已设为 ' + n + ' 词', icon: 'none' });
  },

  onPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  onClear() {
    const self = this;
    wx.showModal({
      title: '清空学习数据',
      content: '将删除全部学习进度、错词本与打卡记录，且无法恢复。确定继续吗？',
      confirmText: '清空',
      confirmColor: '#FF6B5B',
      success(res) {
        if (!res.confirm) return;
        // 二次确认，防止误触
        wx.showModal({
          title: '再次确认',
          content: '真的要清空吗？此操作不可撤销。',
          confirmText: '确认清空',
          confirmColor: '#FF6B5B',
          success(res2) {
            if (res2.confirm) {
              progress.resetAll();
              self.refresh();
              wx.showToast({ title: '已清空', icon: 'success' });
            }
          }
        });
      }
    });
  }
});
