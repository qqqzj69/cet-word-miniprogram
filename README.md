# 贝贝四六级 · 英语四六级背单词小程序

一个**完全离线、零依赖、开箱即用**的微信小程序。基于简化艾宾浩斯记忆曲线的四六级单词学习工具，数据全部内置并持久化在本机。

> 双重定位：① 备考四六级的日常学习工具；② 一个可完整跑通的微信小程序开发作品（原生框架 + 自研 UI + 完整测试）。

## ✨ 功能

| 模块 | 说明 |
|---|---|
| 📖 卡片背单词 | 单词卡片 3D 翻转，认识 / 模糊 / 不认识 三档自评 |
| 🧠 记忆调度 | 简化艾宾浩斯：stage 0–6，间隔 1/2/4/7/15/30 天；答错的词 10 分钟后即到期 |
| ✅ 错词本 | 自动收集答错词，按错误次数优先复习，支持手动标记已掌握 |
| 📊 学习统计 | 今日学习量 / 正确率、近 7 天柱状图、累计与词库进度（纯 CSS 图表，零图表库） |
| 🔥 每日打卡 | 连续打卡天数计算、跨天自动断签处理 |
| ⚙️ 个性化 | 四级 / 六级词库切换、每日目标（10–50 词）调整 |

词库规模：**四级 4,543 词 + 六级 3,991 词**（同一词的多分册释义已合并去重）。

## 🚀 运行

1. 克隆仓库
   ```bash
   git clone https://github.com/qqqzj69/cet-word-miniprogram.git
   ```
2. 用**微信开发者工具**打开项目根目录（`appid` 已配置为测试号 `touristappid`，无需注册即可运行）
3. 编译即可使用。要真机预览或正式发布，把 `project.config.json` 里的 `appid` 换成你自己的。

无 npm、无构建步骤、无第三方组件库 —— clone 即跑。

## 🏗️ 技术要点

- **原生框架**：WXML / WXSS / JS，未引入 TDesign / WeUI 等任何 UI 库，视觉与动效全部手写
- **本地持久化**：单根对象存储于 `wx.setStorageSync`，学习/打卡/错词数据关机不丢，仅主动清空才删除
- **容错设计**：存储损坏自动回退默认值，字段缺失自动补齐，不会白屏
- **当日队列落盘**：每日学习队列构建一次并持久化，中断重进顺序不变，进度不会错乱
- **主包体积 489KB**（上限 2MB），冷启动零网络请求
- **深色模式**：CSS 变量 + `prefers-color-scheme` 自动适配

### 目录结构

```
├── app.{js,json,wxss}        # 入口 / 路由与 tabBar / 设计令牌
├── theme.json                # 深色模式窗口配色
├── data/                     # 内置词库（tools/build_dict.py 生成）
├── store/                    # 业务层：storage(持久化) / progress(记忆算法+统计)
├── pages/                    # index 首页 · study 背单词 · wrong 错词本 · stats 统计 · mine 我的
├── components/               # word-card(3D翻转卡片) · progress-ring(环形进度)
├── utils/date.js             # 跨天与连续天数（手动解析，规避 iOS 日期解析差异）
├── tests/smoke.js            # Node 冒烟测试（27 项断言，覆盖全业务链路）
├── tools/                    # 数据与图标构建脚本
└── docs/PROJECT.md           # 项目文档（目标 / 架构 / 开发计划）
```

## 🧪 测试

```bash
node tests/smoke.js
```

覆盖：词库完整性、首日学习流程、打卡规则、**杀进程后数据恢复**、错词本、跨天复习队列、换词库/目标、存储损坏容错、数据清空。

## 🎨 设计

视觉方向「晨读纸感」：暖白纸底 + 靛青→青绿渐变主色 + 大圆角双层浅阴影。
交互动效：卡片 `rotateY` 3D 翻转、进度环与柱状图缓动、自评按钮缩放 + 振动反馈、完成态弹跳。

UI 参考项目：[Tencent/tdesign-miniprogram](https://github.com/Tencent/tdesign-miniprogram)、[ant-design/ant-design-mini](https://github.com/ant-design/ant-design-mini)、[openages/light-design](https://github.com/openages/light-design)

## 📚 数据来源与声明

词库源自开源项目 [KyleBing/english-vocabulary](https://github.com/KyleBing/english-vocabulary)，本项目仅做格式转换、释义合并与本地内置，**仅用于个人学习**。

⚠️ 该词库源仓库**未声明开源许可证**。如需正式上架或商用，请替换为自有词库或事先取得授权。

## 📄 License

代码部分 MIT。词库数据版权归原整理者所有，使用请遵循上文声明。
