const progress = require('../../store/progress');
const dict = require('../../data/index');

Page({
  data: {
    mode: 'daily',
    levelName: '',
    done: 0,
    total: 0,
    barPct: 0,
    item: null,
    revealed: false,
    showCard: true,
    finished: false,
    counts: { right: 0, vague: 0, wrong: 0 },
    checkedToday: false
  },

  onLoad(options) {
    this.mode = (options && options.mode === 'wrong') ? 'wrong' : 'daily';
    this.counts = { right: 0, vague: 0, wrong: 0 };
    this.session = progress.ensureSession(this.mode);
    const levelName = dict.getLevelName(progress.getLevel());
    this.setData({
      mode: this.mode,
      levelName: levelName,
      counts: this.counts,
      done: this.session.i,
      total: this.session.q.length
    });
    this.syncCurrent();
  },

  onUnload() {
    progress.persist();
  },

  /** 根据会话进度刷新当前卡片 */
  syncCurrent() {
    const s = this.session;
    if (s.i >= s.q.length) {
      this.setData({
        finished: true,
        item: null,
        counts: this.counts,
        done: s.i,
        total: s.q.length,
        barPct: 100,
        checkedToday: this.isTodayChecked()
      });
      return;
    }
    const item = dict.getWord(progress.getLevel(), s.q[s.i]);
    if (!item) {
      // 词库中找不到（理论上不应发生），跳过该词
      s.i++;
      this.syncCurrent();
      return;
    }
    this.setData({
      finished: false,
      item: item,
      revealed: false,
      showCard: true,
      done: s.i,
      total: s.q.length,
      barPct: s.q.length ? Math.round(s.i * 100 / s.q.length) : 0
    });
  },

  isTodayChecked() {
    const st = progress.getStats();
    return st.checkedToday;
  },

  /**
   * 点击卡片：
   *   未显示释义 → 立即显示中文释义（无翻卡动画）
   *   已显示释义 → 视为「认识」，直接进入下一个单词
   */
  onCardTap() {
    if (this.data.finished || !this.data.item) return;
    if (!this.data.revealed) {
      this.setData({ revealed: true });
      return;
    }
    this.commit('right');
  },

  /**
   * 底部按钮：任何时候都可以直接标记，不要求先显示释义
   */
  onRate(e) {
    if (this.data.finished || !this.data.item) return;
    const rating = e.currentTarget.dataset.r;
    if (rating !== 'right' && rating !== 'vague' && rating !== 'wrong') return;
    this.commit(rating);
  },

  /** 提交评价并进入下一个单词 */
  commit(rating) {
    if (!this.data.item) return;
    const word = this.data.item.w;
    progress.rate(this.mode, word, rating);
    this.counts[rating]++;

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });

    // 先移除旧卡，再载入下一张（通过重挂载触发入场动画）
    const self = this;
    this.setData({ showCard: false, revealed: false });
    setTimeout(function () {
      self.session = progress.getSession(self.mode) || self.session;
      self.syncCurrent();
    }, 140);
  },

  onClose() {
    wx.navigateBack({
      fail: function () { wx.switchTab({ url: '/pages/index/index' }); }
    });
  },

  onCheckin() {
    const r = progress.checkin();
    wx.showToast({ title: r.ok ? '打卡成功 · 连续 ' + r.streak + ' 天' : r.msg, icon: 'none' });
    this.setData({ checkedToday: this.isTodayChecked() });
  },

  goWrongBook() {
    wx.redirectTo({ url: '/pages/wrong/wrong' });
  }
});
