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
│   │   ├── media.ts           # media:// token 映射 + 按扩展名返回正确 mime（支持图片）
│   │   ├── windows.ts         # 窗口创建 + 扩展屏检测
│   │   ├── database.ts        # sql.js (WASM SQLite) song 表（含 artist_avatar 列）
│   │   ├── scanner.ts         # 扫描 D:/song-lib 入库（含 artist.txt / 头像识别）
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
   │  ├─ orig.lrc            # 歌词（固定文件名 orig.lrc）
   │  ├─ artist.txt          # 歌手名（首行，可选；缺省回退读取 orig.lrc 的 [ar:] 标签）
   │  └─ artist.jpg          # 歌手头像（可选；也认 avatar.* / cover.* 等图片）
   └─ 晴天\
      ├─ orig.mp4
      ├─ accomp.mp4
      ├─ orig.lrc
      ├─ artist.txt
      └─ artist.jpg
```

### 文件命名要求
- **歌词文件固定命名为 `orig.lrc`**：扫描器优先加载每个歌目录下的 `orig.lrc`，**不再使用「歌名.lrc」**。
  仅当某歌目录下没有 `orig.lrc` 时，`歌名.lrc` 才作为兼容回退被读取。
- **每个歌目录只允许存在一个 `.lrc`**：若目录里同时有 `orig.lrc` 与 `歌名.lrc`，
  扫描器可能选错文件，导致歌词与视频对不上。多余副本请改用 `.bak` / `.baked` 等非 `.lrc` 后缀备份。
- **`orig.lrc` 时间戳需与视频对齐**：歌词按视频自身时间轴对时。如官方 MV 前奏较长，
  第一句时间戳应直接落在对应秒数（例如 `[00:34.27]`），无需在程序里额外调偏移。
- **编码 UTF-8**：否则中文乱码。
- **换行符 LF / CRLF 均可**：LRC 解析按行切分，两种换行都不影响时间戳提取。

### 歌手与头文件要求
- **歌手名（`artist.txt`，可选）**：在歌目录下放 `artist.txt`，**首行**写歌手名，例如：
  ```
  薛之谦
  ```
  扫描器优先用 `artist.txt` 的内容作为 `song.artist`；若文件不存在，则回退读取
  `orig.lrc` 里的 `[ar:歌手名]` 标签。两者都没有时歌手名留空。
- **歌手头像（可选）**：在歌目录下放一张图片，文件名认以下任一个：
  `artist.jpg` / `artist.png` / `avatar.jpg` / `avatar.png` / `cover.jpg` / `cover.png`
  （扫描器优先 `artist.*`，其次 `avatar.*`，再次 `cover.*`）。
  - 头像**不会**原样暴露给前端：扫描器会把它登记进 `media://res/<token>` 安全通道
    （与视频同一机制，真实文件路径不进渲染进程），存入 `song.artist_avatar`，
    由歌曲列表和「歌星」页以 `<img>` 圆形头像显示。
  - 无头像文件时，界面自动用歌手名**首字**作占位，不影响使用。
- **每目录放一份即可**：同一歌手多首歌各自目录放一张图也能用（图片会重复存储）；
  歌多了想省空间，再升级为独立的 `artist` 表 + `song.artist_id` 外键也不迟。

- 数据库只存**路径**，绝不存视频 / 歌词二进制。
- 开发调试偷懒方案：直接把 `orig.mp4` 复制为 `accomp.mp4`，先跑通代码，后期再替换真实伴奏。
- 生成真实伴奏：`ffmpeg -i orig.mp4 -vn -acodec pcm_s16le audio.wav`，UVR5 分离伴奏后 `ffmpeg -i orig.mp4 -i 伴奏.wav -c:v copy -c:a aac accomp.mp4`。

## 核心功能

- ✅ 本地歌曲库自动扫描、歌名/歌手模糊搜索
- ✅ 双屏分离：主屏点歌、副屏全屏播放 MV
- ✅ 原唱 / 伴奏一键切换（动态替换视频源，保留播放进度）
- ✅ 原唱 / 伴奏 / 总音量独立调节
- ✅ LRC 歌词解析、实时滚动、当前行在左右两角交替高亮（KTV 风格）
- ✅ 歌手信息：`artist.txt` 登记歌手名 + `artist.jpg` 头像，歌曲列表与「歌星」页圆形头像展示
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
注解：声音分离助手：https://fenli.ftcxx.com/voice，lrc文件提取：https://subtitlekit.com/cn/lrc-editor
视频下载地址：
B站视频下载工具推荐
工具名称	类型	支持平台	主要特点	适合用户
Bilibili-Downloader-plus	桌面软件	Windows, macOS, Linux	开源免费，功能全面，支持8K、HDR、杜比视界，可下载视频、番剧、课程等	追求多功能和高质量下载的用户
DownKyi (哔哩下载姬)	桌面软件	Windows, macOS, Linux	开源免费，跨平台，支持8K、HDR、杜比视界，提供音视频提取等工具箱	需要批量下载和额外处理功能的用户
bilidown	桌面软件	Windows为主	轻量免费，支持8K视频、Hi-Res音频下载，操作简单，可扫码登录	追求简单易用、快速下载的用户
唧唧Down (JiJiDown)	桌面软件	Windows	老牌免费工具，可下载99%的UP主投稿视频，支持单独下载MP3和弹幕	B站重度用户，需要下载各类UP主视频
bilibili-video-downloader	桌面软件	Windows, macOS, Linux	图形界面，功能强大，支持充电视频、番剧、课程等，可下载字幕、弹幕	需要管理媒体库（如Emby、Jellyfin）的用户
bili_downloader	桌面软件 (命令行)	Windows, macOS, Linux	基于Rust编写，轻量（<10MB），适合喜欢命令行的技术用户	熟悉命令行的技术爱好者
B站下载工具 (Firefox插件)	浏览器插件	Firefox	安装后在视频页面底部出现操作界面，使用方便	经常使用Firefox浏览器的用户
哔晓晓 / Bilibili Download Helper	浏览器插件	Chrome	一键解析并下载当前页面视频	习惯使用Chrome浏览器的用户
cobalt	在线网站	全平台 (浏览器)	开源、无广告，支持B站、YouTube等20+网站	不想安装任何软件，偶尔下载的用户
Easydown	在线网站	全平台 (浏览器)	在浏览器里粘贴链接即可解析保存视频，操作简单	追求快捷、不想安装软件的用户
多种在线解析网站	在线网站	全平台 (浏览器)	如xbeibeix.com、bilibili.iiilab.com等，无需安装，即开即用	临时、快速下载，不介意尝试多个网站的用户
💡 如何选择？
追求功能和高质量：选桌面软件，如 Bilibili-Downloader-plus 或 DownKyi。

追求方便快捷：选浏览器插件，如 哔晓晓。

不想安装任何东西：选在线网站，如 cobalt。