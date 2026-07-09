# 🐱 桌面鱼烧 — Desktop Pet v1.0.0

> 一只会问你"今天有什么计划？"的像素风桌面橘猫，也是你的私人助理。

基于 **Electron** 构建的 macOS 桌面宠物应用。灵感来自网红橘猫"鱼烧"（哥叫鱼烧你记住），半耷拉眼皮、鄙视眼神、嫌弃嘴角，每天 9:00 准时问候你。

---

## ✨ 功能一览

### 🐱 桌面宠物
- 像素风橘猫"鱼烧"，32×32 程序化生成，4倍放大
- 4种动画：**待机**（呼吸+随机眨眼+斜眼看你）、**走路**（拖拽/自动漫步）、**睡觉**（30分钟无互动）、**开心**（完成任务/摸头/喂食）
- 鼠标靠近自动激活（发光+可交互），远离穿透点击不挡操作
- 拖拽换位，位置自动记忆
- **自动漫步**：每2-5分钟随机走到桌面新位置
- 3种皮肤：🟠 鱼烧 (橘猫) / ⚪ 小白猫 / ⚫ 小黑猫

### ⏰ 早安检查
- 每天 9:00 自动弹出气泡问候
- 时段感知：上午好 / 中午好 / 下午好 / 晚上好
- 附送当日天气（wttr.in）
- 启动补检：过点不遗漏

### 📝 任务管理
- NLP 解析：智能识别时间段、具体时间、日期
- 日期识别：7月10日、明天、后天、下周一
- 重复任务：每天、每周X、每月N号、工作日
- 右侧半透明毛玻璃任务面板
- 面板内小日历，点击切换日期
- 有任务的日期显示橙色圆点

### 📅 日历同步
- AppleScript 双向同步 macOS Calendar
- 有时间信息的任务自动创建日历事件
- 日历事件合并到任务列表

### 🔔 效率增强
- **任务提醒**：到时间前10分钟系统通知
- **晚间总结**：21:00 统计今日完成情况
- **番茄钟**：25分钟专注 + 5分钟休息
- **喝水提醒**：工作时间每小时随机提醒

### 🎮 互动玩法
- **心情系统**：完成任务+15、摸头+5、喂食+20
- **摸头检测**：鼠标在鱼烧头上画圈触发呼噜
- **喂食**：右键喂猫粮，鱼烧低头吃东西
- **随机小动作**：伸懒腰、打哈欠

### ⌨️ 快捷操作
- `Cmd+Shift+Y` 全局快捷键快速呼出
- 右键菜单 10 项功能完整触达
- `🎙️ 呼出 Siri` 一键唤醒 macOS Siri
- 📝 便签随手记
- ⚙️ 偏好设置（宠物名、日历名、检查时间、开机自启）

### 📊 统计面板
- 今日/本周完成率
- 连续打卡天数
- 时段任务分布

---

## 🚀 快速开始

```bash
# 启动（必须在项目目录下用 npm start）
cd ~/projects/desktop-pet
npm start

# 打包 .dmg
npm run build
```

> ⚠️ 由于 VS Code 会注入 `ELECTRON_RUN_AS_NODE` 环境变量，必须用 `npm start` 启动，不能直接 `electron .`

---

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 33 |
| 渲染 | HTML5 Canvas (像素风，`imageSmoothingEnabled: false`) |
| 数据 | better-sqlite3 (WAL 模式) |
| 定时任务 | node-schedule |
| 日历 | AppleScript / osascript |
| 天气 | wttr.in (免费，无需 API Key) |
| 打包 | electron-builder |

---

## 📁 项目结构

```
desktop-pet/
├── src/
│   ├── main/           # 主进程 (9 files)
│   │   ├── index.js          # 入口 + 生命周期
│   │   ├── window-manager.js # 窗口工厂
│   │   ├── ipc-handlers.js   # IPC 通信
│   │   ├── database.js       # SQLite
│   │   ├── calendar-bridge.js# AppleScript
│   │   ├── scheduler.js      # 定时任务
│   │   ├── cursor-poll.js    # 鼠标检测
│   │   ├── tray.js           # 托盘
│   │   └── config.js         # 常量
│   ├── renderer/       # 渲染进程
│   │   ├── pet/              # 宠物窗口 (6 files)
│   │   ├── task-panel/       # 任务面板 (3 files)
│   │   ├── settings/         # 设置面板 (3 files)
│   │   ├── stats/            # 统计面板 (2 files)
│   │   └── shared/           # 公共模块 (2 files)
│   └── preload/         # 预加载脚本
├── assets/icons/       # App 图标
├── package.json
└── electron-builder.yml
```

---

## 📊 项目统计

| 指标 | 数值 |
|------|------|
| 代码行数 | ~3,900 |
| 源文件数 | 28 |
| 功能数 | 30+ |
| 数据库表 | 4 (tasks, settings, pet_state, calendar_cache) |
| IPC 通道 | 30+ |

---

## 📄 License

MIT

---

> "哥叫鱼烧你记住" 😼
