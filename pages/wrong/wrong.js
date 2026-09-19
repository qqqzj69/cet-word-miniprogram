const progress = require('../../store/progress');
const dict = require('../../data/index');

Page({
  data: {
    list: [],
    levelName: '',
    expanded: ''
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const list = progress.getWrongList();
    this.setData({
      list: list,
      levelName: dict.getLevelName(progress.getLevel())
    });
  },

  onToggle(e) {
    const w = e.currentTarget.dataset.w;
    this.setData({ expanded: this.data.expanded === w ? '' : w });
  },

  onStartReview() {
    const s = progress.ensureSession('wrong');
    if (!s.q.length) {
      wx.showToast({ title: '错词本已清空，太棒了', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/study/study?mode=wrong' });
  },

  onMaster(e) {
    const w = e.currentTarget.dataset.w;
    const self = this;
    wx.showModal({
      title: '标记为已掌握',
      content: '「' + w + '」将从错词本移除，之后按正常节奏复习。',
      confirmText: '已掌握',
      confirmColor: '#16A34A',
      success(res) {
        if (res.confirm) {
          progress.masterWord(w);
          self.refresh();
        }
      }
    });
  }
});
