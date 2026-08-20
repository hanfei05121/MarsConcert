# 桌面系统测试（Electron + Vue3 离线版）

纯本地离线桌面点歌软件，无服务器、无联网。适配 Windows 双屏扩展模式：主屏点歌控制，副屏（电视）全屏播放 MV + LRC 歌词滚动高亮。仅用于个人本地学习，禁止商用 / 分发。

## 技术栈

| 能力 | 选型 |
| --- | --- |
| 桌面框架 | Electron + Vite（electron-vite） |
| 前端 | Vue3 + TypeScript + Ant Design Vue |
| 本地数据库 | sql.js（SQLite 的 WASM 移植版，纯 JS、免原生编译，仅存索引） |
| 歌词解析 | 自研 LRC 解析（无第三方依赖） |
| 进程通信 | Electron IPC（主进程 ↔ 渲染进程双向） |
| 媒体处理 | FFmpeg（仅素材制作，运行时可选） |

## 目录结构

```
karaoke-desktop/
├── electron.vite.config.ts     # 双 HTML 入口（index / player）
├── src/
│   ├── shared/types.ts         # 共享类型 + IPC 通道常量
│   ├── main/                   # 主进程
│   │   ├── index.ts           # 双窗口创建 + IPC 路由 + media:// 协议
│   │   ├── windows.ts         # 窗口创建 + 扩展屏检测
│   │   ├── database.ts        # sql.js (WASM SQLite) song 表
│   │   ├── scanner.ts         # 扫描 D:/song-lib 入库
│   │   └── config.ts          # 配置 JSON 持久化
│   ├── preload/index.ts        # 安全桥接 API（contextBridge）
│   └── renderer/
│       ├── index.html          # 控制窗入口
│       ├── player.html         # 播放窗入口
│       ├── main/               # 控制窗（搜索/歌单/音量/控制）
│       └── player/             # 播放窗（全屏视频 + LRC 歌词）
└── scripts/make-sample-lib.mjs # 生成演示素材库
```

## 快速开始

```bash
# 1. 安装依赖（sql.js 为纯 JS/WASM，无需原生编译，install 不会再因 better-sqlite3 失败）
npm install

# 2. 生成演示素材库（需要 D: 盘；若装了 ffmpeg 会一并生成测试视频）
npm run sample

# 3. 开发模式（会启动两个窗口：控制台 + 播放屏）
npm run dev
```

> Windows 双屏请先在「显示设置」中选择 **扩展这些显示器**（不要镜像/复制）。
> 播放窗会自动定位到扩展屏并全屏；若只有一块屏，则覆盖在主屏上。

## 素材规范（严格遵守，否则歌词错位 / 无法播放）

```
D:/
└─ song-lib\                 # 默认素材库（可在「重新扫描」前改配置）
   ├─ 稻香\
   │  ├─ orig.mp4            # 原唱 MV
   │  ├─ accomp.mp4          # 同画面伴奏 MV（画面/时长须 100% 对齐）
   │  └─ 稻香.lrc            # 标准 [00:00.00] 时间戳，UTF-8 编码
   └─ 晴天\
      ├─ orig.mp4
      ├─ accomp.mp4
      └─ 晴天.lrc
```

- 数据库只存**路径**，绝不存视频 / 歌词二进制。
- 开发调试偷懒方案：直接把 `orig.mp4` 复制为 `accomp.mp4`，先跑通代码，后期再替换真实伴奏。
- 生成真实伴奏：`ffmpeg -i orig.mp4 -vn -acodec pcm_s16le audio.wav`，UVR5 分离伴奏后 `ffmpeg -i orig.mp4 -i 伴奏.wav -c:v copy -c:a aac accomp.mp4`。

## 核心功能

- ✅ 本地歌曲库自动扫描、歌名/歌手模糊搜索
- ✅ 双屏分离：主屏点歌、副屏全屏播放 MV
- ✅ 原唱 / 伴奏一键切换（动态替换视频源，保留播放进度）
- ✅ 原唱 / 伴奏 / 总音量独立调节
- ✅ LRC 歌词解析、实时滚动、当前行高亮跟随节奏
- ✅ 播放 / 暂停 / 上一曲 / 下一曲 / 进度拖拽
- ✅ 歌单与软件配置本地持久化（userData/app-data）

## 打包为 exe

```bash
npm run pack      # 先 build，再用 electron-builder 生成 nsis 安装包到 release/
```

## 已知坑点

- **双屏**：必须「扩展」模式，禁镜像。
- **素材对齐**：orig 与 accomp 画面/时长必须一致，否则歌词严重错位。
- **LRC 编码**：必须 UTF-8，否则中文乱码。
- **原生模块**：本项目刻意选用 `sql.js`（SQLite 的 WASM 版）而非 `better-sqlite3`，原因是 `better-sqlite3` 在 Electron 中必须源码编译（需 MSVC/Python），极易导致 `npm install` 失败；`sql.js` 纯 JS/WASM，开箱即用。若你本机已装好编译工具且想用 `better-sqlite3`，可参考文档自行替换 `src/main/database.ts`。

## 版权声明

本项目素材仅用于个人本地代码调试、学习研究，属合理使用范围。禁止将打包后的软件、素材包对外分发、上传网络、商用盈利。
