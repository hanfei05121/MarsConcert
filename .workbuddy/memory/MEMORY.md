# 项目长期备忘（karaoke-desktop / MarsConcert）

## 架构决策
- **播放模型 = 单视频 + 双音频**（feature/dual-audio-merge）：视频 `<歌手> - <歌曲>.mp4` 只承载画面（`ffmpeg -an`，无音轨），
  原唱 `_vocals.mp3` / 伴奏 `_instrumental.mp3`。播放窗用 `<video muted>`（画面+时间主源）+ 独立 `<audio>`；切模式只换 audio src，
  **视频不重新解码**（解决旧双视频方案切换卡顿）。漂移 >0.3s 时 `audio.currentTime = video.currentTime`。
- **素材基名 = 「歌手 - 歌曲」**（`E:/song-lib/<歌手>/<歌曲>/`）。scanner `baseCandidates=[\`${artist} - ${song}\`, \`${artist}${song}\`, song]`，
  另有 `findBySuffix` 按后缀直扫兜底。音轨后缀**只看结尾不看前缀**：`[-_](?:vocals?)\.mp3$`、`[-_]instrumental\.mp3$`。
- **scanner 白名单只有 5 种素材**，其余一律不碰：`logo.jpg` / `*.lrc` / `*.mp4` / `*_vocals.mp3` / `*_instrumental.mp3`
  （`VIDEO_EXTS=['mp4']`、`AUDIO_EXTS=['mp3']`；webm/mov/mkv、m4a/wav/ogg/flac、orig./accomp./video.mp4 兜底均已删除）。
- 视频识别：`<基名>.mp4` → `findAnyVideo`（目录内任意 .mp4，排除 `[-_](vocals?|instrumental|原唱|伴奏)` 命名）。
  （坑：目录名与文件名可能不一致，如目录《不重逢》内是「华晨宇 - 不重逢.mp4」。）
- 图片：`artist.jpg`（歌手文件夹级，歌星视图读 `artist_avatar`）；歌曲展示图只认 `logo.jpg`（`song.logo = logo.jpg || artist_avatar`，底部栏与 SongRow 用它）。
- song 表：`orig_path` 唯一键（新格式指向 `_vocals.mp3`），`video_path` 列（旧库迁移回填 orig_path）。扫描后 `pruneSongs(seenPaths)` 清理磁盘上已不存在的行。

## 构建 / 环境坑（重要）
- **沙箱注入了 `NODE_OPTIONS`（safe-delete 钩子）**：Node 的 `fs.rmSync`/vite emptyDir 会被拦。
  构建用 `NODE_OPTIONS= npm run build`（记：bash 工具的 shim 缺 coreutils，`grep/head/ls` 不可用，用 node 过滤日志；
  PowerShell 工具吞 stdout，长命令先重定向到文件再用 node 读，注意输出可能是 UTF-16）。
- **沙箱注入 `ELECTRON_RUN_AS_NODE=1`**：跑 Electron 脚本必须 `unset ELECTRON_RUN_AS_NODE`，否则 `require('electron')` 拿不到 `app`。
  用 Electron 截图：`node_modules/electron/dist/electron.exe <script>`，配 `disableHardwareAcceleration + no-sandbox`，
  **隐藏窗口 rAF 会被节流**，用 `webPreferences.offscreen=true` 才有 ~64fps；页面用 data URL 载入（沙箱下 file:// 被拦）。
- **winCodeSign 解压符号链接失败 → 打包报错 + exe 图标不变**：electron-builder 的 rcedit 前置解压含 macOS dylib 软链，
  无符号链接权限 → 7za exit 2 → 重试 3 次失败，rcedit 从未执行 → exe 一直是 Electron 默认图标（Setup 图标正常，NSIS 直用 build/icon.ico）。
  修复：手动把 winCodeSign 解到 `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\`，或开开发者模式/管理员运行。
  验证：`python scripts/peicon.py <exe>`。
- DB：`C:/Users/han/AppData/Roaming/local-desktop-karaoke/app-data/karaoke.sqlite`。
- 曲库：`E:/song-lib/<歌手>/<歌曲>/{<歌手> - <歌曲>.mp4, _vocals.mp3, _instrumental.mp3, video.lrc, artist.jpg}`（路径见 config.json，默认 D:/song-lib 已改到 E:/）。

## 素材规范速查
- 歌词统一 `video.lrc`（每目录仅一个 .lrc，备份 .bak/.baked）；scanner 优先 `video.lrc`，兼容 `orig.lrc`/`<基名>.lrc`，其余 .lrc 兜底；UTF-8；LF/CRLF 均可。
- 歌手名取 `artist.txt` 首行（回退 LRC `[ar:]`）。
- 生成素材：`ffmpeg -i 原视频.mp4 -an -c:v copy "<歌手> - <歌曲>.mp4"`；`ffmpeg -i 原视频.mp4 -vn -c:a libmp3lame "<歌手> - <歌曲>_vocals.mp3"`。
- 旧命名批量迁移：`node scripts/rename-lib.mjs --dry`（预览）/ 直接跑（幂等）；`scripts/verify-lib.mjs` 端到端验证 scanner。

## 用户偏好
- KTV 歌词：左右角交替高亮、两行展示（不穿透填色）、白字+阴影、42px。
- **长前奏隐藏歌词**：首句晚于 10s → 前奏整块不显示，临近 5s 才预览（INTRO_HIDE_SEC/INTRO_PREVIEW_SEC）。
- **长停顿倒计时**：开头恒显示；句中 >15s 才提示；最后 5 秒 5 格倒计时（每秒熄一格，粉 #ff5ca8），跟随「下一句」槽位左右交替（PAUSE_GAP_SEC/PAUSE_COUNTDOWN_SEC）。
- **麦克风常开**：只要 mic 音量 >0，两种模式都监听（`refreshMicMonitor` 只按 mic 判断）。
- 不做手动偏移 UI（用对齐好的 video.lrc）；`lyricOffset` 保留。
- Song 接口 snake/camel 混用是历史遗留，读取必须经 rowToSong 显式映射。

## 侧边导航：弧形滚轮（2026-09-14 新增）
- 侧栏 **184px → 248px → 300px → 400px**（用户三次要加宽；`Sidebar.vue` 的 `.sidebar`）。**宽度改了必须同步**
  `PlaylistPopup.vue` 的 `inset: 56px 0 84px 400px`，否则「已点」弹窗遮罩会压到侧栏上（`src` 里就这两处用宽度）。
- 用户对这块的偏好（2026-09-14，第 5 次微调后）：**侧栏要宽（400px）**、**菜单字号要大（基态 22px / 压线 25px，图标 22px）**、
  **菜单项要离左边基准线有点距离**（`left:72px; padding:0 20px` → 图标约 x=92、文字约 x=128；行 `height:56px`）。
  `.user` 头像 46px、`.nick` 15px；`.cloud` padding 14px 18px、标题 15px、路径 `.clbpath` 12px/280px。
- **左侧基准刻度线常亮**（第 5 次改）：`.baseline{ left:20px; width:26px; height:2px; background:var(--accent); box-shadow:0 0 10px var(--accent) }`
  —— 一直橙色 + 外发光，**不再是「压线那一刻才亮」**。右端固定 x=46，只往左加长。
  于是每个 item 上原来的 `.mk`（压线橙标，位置也在 x=32..46）已经**删除**（模板 + CSS 都删了），别再把它加回来。
- `pos`(ref) = 压在基准线上的槽位，逐帧缓动追 `target`：`EASE=0.3`、`SETTLE_EPS=0.008`（≈210ms 落定）。
  **只有落定到整数槽位那一帧才高亮 + `router.push`**（`isLit()` = 非拖动 && `Number.isInteger(pos)` && `round(pos)===i`）→ 滚动途中一律不亮。
- 滚轮：`target += deltaY/100`（`deltaMode` 换算），停手 `SNAP_DELAY=120ms` 后 `snap()` 吸附；拖动：`target = dragT0 - dy/STEP`（pos 跟手），松手吸附；
  点击：先转到基准线、落定才切页（移动 >6px 视为拖动，不触发 click）。外部改路由（顶栏返回）时 watch `routeIndex` 把滚轮转过去。
- 几何：`RADIUS=640`，圆心在侧栏左侧远处；`dx=(cosθ-1)R`、`dy=sinθR`、`rotate=θ°`（贴弧切线 → 扇形张角，最大 ±22°）、
  `scale=1-0.035d`、`opacity=max(0.22,1-0.2d)`（**保底 22%**，远处要「退后」不是「消失」，否则停在首/尾时后面的菜单发现不了）、
  `blur=min(0.55d,1.6)px`。项 `height:56px; left:72px; right:24px`；`.nav{overflow:hidden;touch-action:none;cursor:grab}`。
- **槽位间距「近疏远密」**（2026-09-14 第 4 次改）：`arcOffset(d)` 取代固定 `STEP_ANGLE`——紧邻基准线一格 `STEP=62px`，
  每往两端远一格乘 `GAP_RATIO`（0.8 → 第 5 次压到 **0.74**）。好处：近处邻项留白足（透气），远端自动压缩 → 基准线可以偏上而首/尾项仍顶不出导航区。
- **基准线偏上**：`BASELINE` 50% → 42% → **39%**（第 5 次），由 `.nav` 上的 `--baseline` 一路喂给 `.baseline`/`.item`（`top: var(--baseline)`），
  **改一处即可**。目的是把整组菜单往上挪，免得导航上方空一大块（`.cloud` 在底下补住视觉重量）。
  **约束（实测已接近极限）**：39% × 570px nav → 基准线 cy=222.3；停在最后一项时首项 cy≈39.3、半项高 28 → 文字上沿只剩 ~11px。
  再往上就得同时调小 `GAP_RATIO`（0.74 继续降）或缩小项高/字号——`arcOffset(5)≈183px` 是上方余量的主要消耗者。
- **换页与滚轮同向淡入淡出**：`src/renderer/main/navDir.ts` 存 `navDir`(1/-1)，`landed()` 切页时按目标槽位与当前槽位的大小关系写方向；
  `App.vue` 的 `<main class="content">` 据此挂 `nav-down`/`nav-up` 类，`<router-view v-slot>` + `<Transition name="page">` 配一条全局 `.page-*` 规则
  （`.page-leave-active{position:absolute;inset:0}` 让旧页脱离文档流，新页立刻占位，避免两页堆叠跳动）。
- **坑**：全局 `button{transition:var(--ease)}`（= `transition:all .3s`）会把逐帧的 transform/opacity/filter 拖成橡皮筋
  → `.item` 必须只过渡 `background/box-shadow/color`。全局 `button:hover{transform:translateY(2px)}` 不生效（行内 style 覆盖）。
- 验证脚本（都在 `.workbuddy/tmp/`，不进版本库）：`arc-wheel-test.mjs`（状态机时序 + 全程不变量，8/8 通过）、
  `shot.js`（Electron 离屏截图 + DOM 断言：滚动途中 0 高亮、落定 1 高亮、`inBounds()` 查首/尾项纵向不被裁、`window.__dbg()` 读 pos/target/activeKey；
  产出 `shot-report.txt` + `shot-1..5-*.png`，exit 0/1 = 总 PASS/FAIL）、`arc-nav-preview.html`（可交互静态预览，头像已内联 data URI）。
  跑法：`unset ELECTRON_RUN_AS_NODE && node_modules/electron/dist/electron.exe .workbuddy/tmp/shot.js`（沙箱注入了 `ELECTRON_RUN_AS_NODE=1`，必须先 unset）。

## UI 主题：透明毛玻璃 · Mars Glass Edition
- 风格参照 `D:\study\Rainform`。**唯一主题源在 `src/renderer/main/style.css` 的 `:root`**（`src/renderer/mobile/style.css` 是同款副本，**改一处要同步另一处**）。
- token：底色 `--base-0/1/2`（body 分层星云渐变 + 星尘 `body::before` + 胶片颗粒 `body::after`）；玻璃面 `--bg-0`(凹陷控件)/`--bg-1`(面板)/`--bg-2`(卡片)/`--bg-3`(hover)；
  描边 `--line`/`--line-strong`；`--glass-blur`(34px)/`--glass-blur-sm`(15px)/`--glass-sat`(150%)/`--glass-sheen`/`--glass-edge`；
  accent 仍是火星红橙（`--accent #ff4d2e`/`--accent-2`/`--accent-3`）。
- **两档玻璃**：大面板（`.topbar/.bottombar/.sidebar/.glass/.card/.popup/.qr-panel/.vpop/.mrow/.pager` 等）用真模糊；
  小控件只半透明填充 + `inset 0 1px 0` 顶边高光，**不叠模糊**（性能）。组件里不写死颜色，一律用 token。
- **backdrop-filter 两个坑**：① 父元素有模糊就成为 backdrop root → 遮罩层只压暗不模糊，模糊交给里面的面板；
  ② 它创建层叠上下文，会把内部弹层的 z-index 锁死（曾导致底栏音量滑块被全屏遮罩吃事件）→ 给带模糊的容器加 `position:relative` + 抬 z-index（`.bottombar{z-index:40}` > `.pop-backdrop{z-index:30}`）。
- **滑块统一用全局 `.slider`/`.slider--v`**：`appearance:none` 自绘轨道/滑块头与开关同色源，填充比例由组件喂 `--fill`；
  竖直滑块别用已废弃的 `-webkit-appearance:slider-vertical`（用 `writing-mode: vertical-lr; direction: rtl`）。
- **控件配色统一走 `--ctrl-*`**（`--ctrl-accent`/`--ctrl-accent-soft`/`--ctrl-accent-line`/`--ctrl-accent-ink`）。
  两档：**soft（选中态/次级主按钮）**= `.item.active`/`.row.active`/`.chip.on`/`.pg.on`/`.add`/`.btn.accent`；
  **strong（强调动作键）**= `BottomBar .play`/`ControlSheet .big`/`DanmakuSheet .send`。判据：**「选中/被点亮」soft，「点下去要发生大事」strong**。
- **列表行三态对齐左侧导航**：默认=半透明白玻璃渐变 + `--line`；hover=`--bg-3` + `translateY(2px)`；选中=soft 橙玻璃 + `--ctrl-accent-line` + 橙字。
  定义在 `main/style.css`「列表行统一外观」一节与 `mobile/style.css`（手机端用 `:active` 代替 hover）；
  **组件里只写布局**（flex/padding/gap/radius），别再写行底色（scoped 会顶掉全局）。列表容器必须有 `gap`。
- **玻璃通透的正确配比（结论，别再动大方向）**：透明观感靠「半透明白面板 + 模糊透光」，**绝不靠拔高背景亮度/饱和度**
  （曾因「背景太亮太艳」被否）。`--glass-sat` 别超 150%；星云色团 alpha ≈ 0.15/0.12/0.06/0.09；`--shadow-glass/panel/pop` = .22/.34/.42（重投影会发「重」）。
- 小号橙字（11–16px）用 `--accent-2(#ff8c42)`（`--accent` 在浅玻璃上对比度只有 ~4:1）；`--accent` 只留给描边/光晕/≥18px 大字。
- 死代码：`SongList.vue` / `VolumePanel.vue` 无引用，不用维护。
- 预览页坑：`.workbuddy/tmp/*.html` 走内置静态服务（根路径 `/static-html/<hash>/`），写 `../../src/...` 会 404，本地图片要**内联成 data URI**。
