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
      this.triggerEvent('tap');
    }
  }
});
