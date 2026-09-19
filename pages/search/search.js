const progress = require('../../store/progress');
const dict = require('../../data/index');

Page({
  data: {
    kw: '',
    results: [],
    searched: false,
    expanded: '',
    levelName: '',
    total: 0
  },

  onLoad(options) {
    this.setData({
      levelName: dict.getLevelName(progress.getLevel()),
      total: dict.getCount(progress.getLevel())
    });
    // 从首页搜索框带关键词进入时，直接出结果
    const kw = (options && options.kw) ? decodeURIComponent(options.kw) : '';
    if (kw) {
      this.setData({ kw: kw });
      this.doSearch(kw);
    }
  },

  onInput(e) {
    const kw = e.detail.value;
    this.setData({ kw: kw });
    // 输入防抖：300ms 内连续输入只查最后一次
    if (this.timer) clearTimeout(this.timer);
    const self = this;
    this.timer = setTimeout(function () { self.doSearch(kw); }, 300);
  },

  onClear() {
    this.setData({ kw: '', results: [], searched: false, expanded: '' });
  },

  doSearch(kw) {
    if (!kw || !kw.trim()) {
      this.setData({ results: [], searched: false, expanded: '' });
      return;
    }
    const list = dict.searchWords(progress.getLevel(), kw, 50).map(function (x) {
      return { i: x.i, w: x.w, p: x.p, m: x.m, e: x.e, ec: x.ec };
    });
    this.setData({ results: list, searched: true });
  },

  onToggle(e) {
    const w = e.currentTarget.dataset.w;
    this.setData({ expanded: this.data.expanded === w ? '' : w });
  }
});
