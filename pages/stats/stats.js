const progress = require('../../store/progress');

const RANGES = [
  { value: 7, label: '7 天' },
  { value: 30, label: '30 天' },
  { value: 90, label: '90 天' }
];

Page({
  data: {
    st: null,
    range: 7,
    ranges: RANGES,
    bars: []
  },

  onShow() {
    this.refresh(this.data.range);
  },

  refresh(range) {
    const st = progress.getStats(range);
    const max = st.rangeMax || 1;
    const last = st.bars.length - 1;
    const bars = st.bars.map(function (b, idx) {
      return {
        label: b.showLabel ? b.label : '',
        value: b.value,
        isToday: idx === last,
        isEmpty: b.value === 0,
        hPct: Math.round((b.value / max) * 100)
      };
    });
    this.setData({ st: st, range: st.range, bars: bars });
  },

  onPickRange(e) {
    const r = parseInt(e.currentTarget.dataset.r, 10);
    if (r === this.data.range) return;
    this.refresh(r);
  }
});
