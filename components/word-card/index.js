Component({
  options: { addGlobalClass: true },
  properties: {
    /** { w: 单词, m: 释义 } */
    item: { type: Object, value: null },
    flipped: { type: Boolean, value: false }
  },
  methods: {
    onTap() {
      this.triggerEvent('flip');
    }
  }
});
