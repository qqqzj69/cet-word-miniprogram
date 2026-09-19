Component({
  options: { addGlobalClass: true },
  properties: {
    /** { w: 单词, m: 释义 } */
    item: { type: Object, value: null },
    /** 是否已显示中文释义 */
    revealed: { type: Boolean, value: false }
  },
  methods: {
    onTap() {
      // 事件名不用 'tap'：自定义 tap 事件与原生冒泡 tap 会被页面同时接收到，
      // 导致处理函数一次点击触发两次
      this.triggerEvent('cardtap');
    }
  }
});
