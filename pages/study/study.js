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
    rated: false,
    rating: '',
    showCard: true,
    finished: false,
    counts: { right: 0, vague: 0, wrong: 0 },
    checkinMsg: '',
    checkedToday: false
  },

  onLoad(options) {
    this.mode = (options && options.mode === 'wrong') ? 'wrong' : 'daily';
    this.counts = { right: 0, vague: 0, wrong: 0 };
    this.autoChecked = false;
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
      this.onFinished();
      return;
    }
    const item = dict.getWord(progress.getLevel(), s.q[s.i]);
    if (!item) {
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

  /** 本轮结束：自动打卡，无需再点按钮 */
  onFinished() {
    const msg = this.autoCheckin();
    this.setData({
      finished: true,
      item: null,
      counts: this.counts,
      done: this.session.i,
      total: this.session.q.length,
      barPct: 100,
      checkinMsg: msg
    });
  },

  /** 自动打卡，返回给用户的提示文案 */
  autoCheckin() {
    const r = progress.checkin();
    if (r.ok) {
      wx.showToast({ title: '打卡成功 · 连续 ' + r.streak + ' 天', icon: 'none', duration: 1800 });
      this.setData({ checkedToday: true });
      return '已自动打卡 · 连续 ' + r.streak + ' 天';
    }
    this.setData({ checkedToday: progress.getStats().checkedToday });
    return (r.msg === '今天已经打过卡啦') ? '今天已打过卡' : '';
  },

  /**
   * 点击卡片：只负责显示 / 隐藏中文释义，绝不会跳到下一个单词
   */
  onCardTap() {
    if (this.data.finished || !this.data.item) return;
    this.setData({ revealed: !this.data.revealed });
  },

  /**
   * 认识：直接跳过，进入下一个单词
   */
  onKnow() {
    if (this.data.finished || !this.data.item) return;
    if (this.data.rated) { this.onNext(); return; }   // 已评过价就只翻页，避免重复计数
    this.commit('right');
  },

  /**
   * 不认识 / 模糊：先在卡片上显示中文，让人看清这个词的释义，
   * 再由用户点「下一个」继续，避免误点直接跳过
   */
  onUnknow(e) {
    if (this.data.finished || !this.data.item || this.data.rated) return;
    const rating = e.currentTarget.dataset.r === 'vague' ? 'vague' : 'wrong';
    progress.rate(this.mode, this.data.item.w, rating);
    this.counts[rating]++;

    const s = progress.getSession(this.mode);
    const done = s ? s.i : this.data.done + 1;
    this.setData({
      revealed: true,
      rated: true,
      rating: rating,
      counts: this.counts,
      done: done,
      barPct: this.session.q.length ? Math.round(done * 100 / this.session.q.length) : 100
    });
  },

  /** 看完释义后进入下一个单词 */
  onNext() {
    const self = this;
    this.setData({ showCard: false, revealed: false, rated: false, rating: '' });
    setTimeout(function () {
      self.session = progress.getSession(self.mode) || self.session;
      self.syncCurrent();
    }, 160);
  },

  commit(rating) {
    if (!this.data.item) return;
    progress.rate(this.mode, this.data.item.w, rating);
    this.counts[rating]++;
    this.onNext();
  },

  /** 学完一轮后还想继续：再来一批新词 */
  onContinue() {
    const self = this;
    this.session = progress.resetSession(this.mode);
    this.setData({
      finished: false,
      showCard: false,
      revealed: false,
      rated: false,
      rating: '',
      checkinMsg: '',
      done: 0,
      total: this.session.q.length,
      barPct: 0
    });
    setTimeout(function () { self.syncCurrent(); }, 160);
  },

  onClose() {
    wx.navigateBack({
      fail: function () { wx.switchTab({ url: '/pages/index/index' }); }
    });
  },

  goWrongBook() {
    wx.redirectTo({ url: '/pages/wrong/wrong' });
  }
});
