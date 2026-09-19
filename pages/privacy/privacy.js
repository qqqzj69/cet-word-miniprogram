const dateUtil = require('../../utils/date');

Page({
  data: {
    date: ''
  },

  onLoad() {
    this.setData({ date: dateUtil.todayStr() });
  }
});
