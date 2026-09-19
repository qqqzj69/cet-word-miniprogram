const progress = require('./store/progress');

App({
  globalData: {
    // 预留全局状态；页面统一从 store 读取，避免双份状态
  },

  onLaunch() {
    // 冷启动即载入本地库，失败时 storage 层会自动回退默认值
    progress.init();
  },

  onShow() {
    // 跨天后回到前台，各页面在 onShow 里自行调用 progress.refreshDate()
  },

  onHide() {
    // 兜底落盘：用户切走 / 杀进程前把内存态写回本地
    progress.persist();
  },

  onError(msg) {
    console.error('[app error]', msg);
  }
});
