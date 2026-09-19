const progress = require('../../store/progress');

const RANGES = [
  { value: 7, label: '7 天' },
  { value: 30, label: '30 天' },
  { value: 90, label: '90 天' }
];

const CURVE_DAYS = 14;          // 遗忘曲线取最近 14 天，节点太密就没法点了
const CURVE_LABEL_STEP = 2;     // 横轴每隔几天打一个日期

Page({
  data: {
    st: null,
    range: 7,
    ranges: RANGES,
    bars: [],
    curve: [],
    curveReady: false,
    curveDate: '',
    curveWords: [],
    curveLearned: 0,
    curveRetention: 0
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

    const curve = progress.getForgetCurve(CURVE_DAYS);
    const hasData = curve.filter(function (p) { return p.retention !== null; }).length >= 2;

    this.setData({
      st: st,
      range: st.range,
      bars: bars,
      curve: curve,
      curveReady: hasData
    }, this.drawCurve.bind(this));
  },

  onPickRange(e) {
    const r = parseInt(e.currentTarget.dataset.r, 10);
    if (r === this.data.range) return;
    this.refresh(r);
  },

  /* ---------------- 遗忘曲线 ---------------- */

  drawCurve() {
    const curve = this.data.curve;
    if (!curve || !curve.length) return;

    const self = this;
    wx.createSelectorQuery().in(this)
      .select('#forgetCurve')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const w = res[0].width;
        const h = res[0].height;
        const dpr = (wx.getSystemInfoSync().pixelRatio) || 2;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        const padL = 10, padR = 10, padT = 16, padB = 26;
        const iw = w - padL - padR;
        const ih = h - padT - padB;
        const n = curve.length;
        const xAt = function (i) { return padL + (n > 1 ? (i / (n - 1)) * iw : iw / 2); };
        const yAt = function (v) { return padT + (1 - v / 100) * ih; };

        // 横向网格
        ctx.strokeStyle = 'rgba(28,28,30,0.08)';
        ctx.lineWidth = 1;
        [25, 50, 75].forEach(function (v) {
          ctx.beginPath();
          ctx.moveTo(padL, yAt(v));
          ctx.lineTo(padL + iw, yAt(v));
          ctx.stroke();
        });

        // 理论遗忘曲线（虚线，灰）
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(28,28,30,0.28)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        curve.forEach(function (p, i) {
          const x = xAt(i), y = yAt(p.theory);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.restore();

        // 实际留存（实线，蓝）+ 面积
        const pts = [];
        curve.forEach(function (p, i) {
          if (p.retention !== null) pts.push({ x: xAt(i), y: yAt(p.retention), i: i });
        });

        if (pts.length > 1) {
          const grad = ctx.createLinearGradient(0, padT, 0, padT + ih);
          grad.addColorStop(0, 'rgba(10,132,255,0.28)');
          grad.addColorStop(1, 'rgba(10,132,255,0.02)');
          ctx.beginPath();
          ctx.moveTo(pts[0].x, padT + ih);
          pts.forEach(function (p) { ctx.lineTo(p.x, p.y); });
          ctx.lineTo(pts[pts.length - 1].x, padT + ih);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.beginPath();
          ctx.strokeStyle = '#0A84FF';
          ctx.lineWidth = 2.5;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          pts.forEach(function (p, k) {
            if (k === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.stroke();
        }

        // 节点与日期刻度
        ctx.textAlign = 'center';
        curve.forEach(function (p, i) {
          const x = xAt(i);
          const active = self.data.curveDate === p.date;
          if (p.retention !== null) {
            ctx.beginPath();
            ctx.arc(x, yAt(p.retention), active ? 6 : 3.5, 0, Math.PI * 2);
            ctx.fillStyle = active ? '#0A84FF' : '#FFFFFF';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#0A84FF';
            ctx.stroke();
          }
          if (i % CURVE_LABEL_STEP === 0 || i === n - 1) {
            ctx.fillStyle = active ? '#0A84FF' : 'rgba(28,28,30,0.45)';
            ctx.font = '11px -apple-system, sans-serif';
            ctx.fillText(p.md, x, h - 8);
          }
        });

        self.curveGeom = { padL: padL, iw: iw, n: n };
      });
  },

  /** 点击曲线：命中最近的日期节点 */
  onCurveTap(e) {
    const g = this.curveGeom;
    if (!g) return;
    const x = (e.detail && e.detail.x) || (e.touches && e.touches[0] && e.touches[0].x) || 0;
    let idx = Math.round(((x - g.padL) / g.iw) * (g.n - 1));
    idx = Math.max(0, Math.min(g.n - 1, idx));
    const point = this.data.curve[idx];
    if (!point) return;

    if (this.data.curveDate === point.date) {
      this.setData({ curveDate: '', curveWords: [], curveLearned: 0, curveRetention: 0 });
    } else {
      this.setData({
        curveDate: point.date,
        curveWords: point.words,
        curveLearned: point.learned,
        curveRetention: point.retention === null ? 0 : point.retention
      });
    }
    this.drawCurve();
  },

  /** 点开累计卡：查看错词本或每日学习记录 */
  onOpenAcc() {
    wx.showActionSheet({
      itemList: ['查看错词本', '查看每日学习记录'],
      success(res) {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/wrong/wrong' });
        } else if (res.tapIndex === 1) {
          wx.navigateTo({ url: '/pages/history/history' });
        }
      }
    });
  }
});
