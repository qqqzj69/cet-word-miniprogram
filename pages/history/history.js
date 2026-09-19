const progress = require('../../store/progress');

const PAGE_SIZE = 10;   // 每次加载的天数

Page({
  data: {
    days: [],
    total: 0,
    hasMore: false,
    expanded: '',
    empty: false,
    loading: false
  },

  onLoad() {
    this.cache = [];
    this.reload();
  },

  onShow() {
    // 从学习页返回时，今天的新记录要能看到
    this.reload();
  },

  reload() {
    this.cache = [];
    this.append();
  },

  /** 追加下一页 */
  append() {
    const res = progress.getHistory(PAGE_SIZE, this.cache.length);
    const merged = this.cache.concat(res.days);
    this.cache = merged;
    this.setData({
      days: merged,
      total: res.total,
      hasMore: res.hasMore,
      empty: res.total === 0
    });
  },

  onLoadMore() {
    if (!this.data.hasMore) return;
    this.setData({ loading: true });
    this.append();
    this.setData({ loading: false });
  },

  onReachBottom() {
    this.onLoadMore();
  },

  /** 展开 / 收起某天的单词列表 */
  onToggle(e) {
    const date = e.currentTarget.dataset.date;
    this.setData({ expanded: this.data.expanded === date ? '' : date });
  },

  goStudy() {
    wx.navigateBack({
      fail: function () { wx.switchTab({ url: '/pages/index/index' }); }
    });
  }
});
