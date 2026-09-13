# 项目长期备忘（karaoke-desktop）

## 架构决策
- **播放模型 = 单视频 + 双音频**（feature/dual-audio-merge 分支）：
  - 视频 `<歌手> - <歌曲>.mp4` 只承载画面（必须无音轨，`ffmpeg -an`），原唱/伴奏共用。
  - 原唱 `<歌手> - <歌曲>_vocals.mp3`、伴奏 `<歌手> - <歌曲>_instrumental.mp3`。
  - 播放窗用 `<video muted>`（只出画面，时间主源）+ 独立 `<audio>`（播 vocals/instrumental）；
    切原唱/伴奏只换 audio src 并对齐视频时钟，**视频不重新解码** → 解决旧双视频方案切换卡顿。
  - 音画同步：timeupdate 里音频漂移 >0.3s 拉回 `audio.currentTime = video.currentTime`。
- **素材基名 = 「歌手 - 歌曲」**（新布局 `E:/song-lib/<歌手>/<歌曲>/` 下文件名带歌手前缀；
  scanner `baseCandidates = [\`${artist} - ${song}\`, \`${artist}${song}\`, song]`，并有 `findBySuffix` 按 `_vocals`/`_instrumental` 后缀直扫兜底）。
- **scanner 只认这 5 种素材，其余一律不碰**：`logo.jpg` / `*.lrc` / `*.mp4` / `*_vocals.mp3` / `*_instrumental.mp3`。
  `VIDEO_EXTS=['mp4']`、`AUDIO_EXTS=['mp3']`；已删除 `webm/mov/mkv`、`m4a/wav/ogg/flac`、`orig.*/accomp.*/video.mp4` 等旧兜底。
- **音轨后缀只看结尾、不看前缀/分隔符**：`findBySuffix` 用 `[-_](?:vocals?)\.mp3$` 认 `-vocal/-vocals/_vocal/_vocals`，用 `[-_]instrumental\.mp3$` 认 `-instrumental/_instrumental`。
  （下载源命名很杂，如 华晨宇 - 怪诞心理学-vocal.mp3 / -instrumental.mp3 直接可识别，无需改名。）
- **视频识别顺序**：`<基名>.mp4` → `findAnyVideo`（目录内任意 .mp4，**只看后缀不看前缀**，排除 `[-_](vocals?|instrumental|原唱|伴奏)` 命名）。
  （坑：目录名可能与文件名不一致，如目录《不重逢》内文件是「华晨宇 - 不重逢.mp4」，此时必须靠 findAnyVideo 兜底。）
- 歌手头像 `artist.jpg`（歌手文件夹级，歌星视图用）保留识别；歌曲展示图只认 `logo.jpg`。
- 数据库 song 表：`orig_path` 为唯一键（新格式指向 `_vocals.mp3`），新增 `video_path` 列（旧库迁移时回填 orig_path）。
- 扫描后 `pruneSongs(seenPaths)` 清理磁盘上已不存在的行（旧格式残留/删除素材），避免幽灵/重复歌曲。

## 构建 / 环境坑（重要）
- **本沙箱内 NODE_OPTIONS 注入了 safe-delete 钩子**：任何 Node 进程的 `fs.rmSync`/`rm` 都会被拦截，
  genie-trash 在项目目录失败 → `rm -rf dist`、vite 的 emptyDir（dist 残留时）都会报错。
- **正确构建姿势**：`NODE_OPTIONS= npm run build`（清空注入变量，需允许非沙箱执行）。
  vite 默认会清空 outDir，不需要手动删 dist。用户自己终端构建不受此限制。
- **winCodeSign 解压符号链接失败 → 打包报错 + exe 图标不变（重要）**：
  改 exe 图标/版本的是 app-builder 的 `rcedit`，它执行前会下载解压 winCodeSign 到
  `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\<随机目录>`；包内含 macOS dylib 符号链接，
  当前用户无符号链接权限（未开开发者模式/非管理员）→ 7za exit 2 → 重试 3 次后打包失败，
  rcedit 从未执行 → 应用 exe 一直是 Electron 默认图标（ProductName=Electron）。
  安装包（Setup）图标正常是因为 NSIS 直接用 build/icon.ico 编译 installerIcon，不经 rcedit。
  **修复**：手动把 winCodeSign 7z 解到 `Cache\winCodeSign\winCodeSign-2.6.0\`（忽略 dylib 软链错误），
  或开 Windows 开发者模式 / 管理员运行。验证工具：`python scripts/peicon.py <exe>` 看图标尺寸字节数是否与 icon.ico 一致。
- DB 路径：`C:/Users/han/AppData/Roaming/local-desktop-karaoke/app-data/karaoke.sqlite`
- 曲库：`E:/song-lib/<歌手>/<歌曲>/{<歌手> - <歌曲>.mp4, <歌手> - <歌曲>_vocals.mp3, <歌手> - <歌曲>_instrumental.mp3, video.lrc, artist.jpg}`（实际路径见 config.json；默认 D:/song-lib 已被用户改到 E:/）

## 素材规范速查
- 歌词统一 `video.lrc`（每目录仅一个 .lrc，备份用 .bak/.baked）；scanner 优先 `video.lrc`，兼容旧 `orig.lrc` 与 `<基名>.lrc`，其余 `.lrc` 兜底；UTF-8；LF/CRLF 均可；时间戳与视频对齐。
- 歌手名 `artist.txt` 首行（回退 LRC `[ar:]`）；歌手头像 `artist.jpg`（歌手文件夹内，歌星视图用）→ 存入 `artist_avatar`。
- **歌曲展示图只认 `logo.jpg`（歌曲目录内，可选）**：优先于歌手头像，`song.logo = logo.jpg token || artist_avatar`。
  底部栏缩略图 + 所有歌曲列表（SongRow）读 `song.logo`；「歌星」视图仍读 `artist_avatar`（artist.jpg）。
- 生成素材：`ffmpeg -i 原视频.mp4 -an -c:v copy "<歌手> - <歌曲>.mp4"`；`ffmpeg -i 原视频.mp4 -vn -c:a libmp3lame "<歌手> - <歌曲>_vocals.mp3"`（伴奏同理 `_instrumental`）。
- **旧命名批量迁移**：`node scripts/rename-lib.mjs --dry`（预览）/ 直接运行（执行，幂等），把 `video.mp4/orig.*/accomp.*` 重命名为「歌手 - 歌曲」基名新规范；`scripts/verify-lib.mjs` 可端到端验证 scanner 识别。

## 用户偏好
- KTV 式歌词左右角交替高亮、两行展示（不穿透填色）、白字+阴影、42px。
- **长前奏隐藏歌词**：首句歌词晚于 10s 出现时（长前奏纯伴奏），前奏期间整块不显示，临近首句 5s 才显示预览（LyricsOverlay 的 `visible` 逻辑，常量 INTRO_HIDE_SEC=10 / INTRO_PREVIEW_SEC=5）。
- **长停顿倒计时**：歌曲开头恒显示；句中停顿 >15s 才提示。临近下一句的最后 5 秒显示 5 格倒计时（每秒熄灭一格，粉色 #ff5ca8），并跟随「下一句」槽位左右交替（LyricsOverlay `countdown` + `countdownRight`，常量 PAUSE_GAP_SEC=15 / PAUSE_COUNTDOWN_SEC=5）。
- **麦克风常开**：只要麦克风音量 >0，原唱/伴奏模式都监听自己的声音（App.vue `refreshMicMonitor` 只按 mic 音量判断，与模式无关）。
- 不做手动偏移 UI（用对齐好的 video.lrc）；`lyricOffset` 字段保留用于特殊情况。
- Song 接口 snake/camel 混用是历史遗留，读取路径必须经 rowToSong 显式映射。

## UI 主题：透明毛玻璃 · Mars Glass Edition
- 风格参照 `D:\study\Rainform`（深色半透明面板 + `backdrop-filter` 毛玻璃 + 发丝白描边 + 顶边高光 + 噪点背景）。原先的「实心暖炭黑 + 红霓虹」已全部替换。
- **唯一主题源在 `src/renderer/main/style.css` 的 `:root`**（`src/renderer/mobile/style.css` 是手机端同款副本，改一处要同步另一处）。核心 token：
  - 底色 `--base-0/1/2`（body 的分层星云渐变 + 星尘 `body::before` + 胶片颗粒 `body::after`，玻璃要有东西可糊才通透）。
  - 玻璃面 `--bg-0`(凹陷控件) / `--bg-1`(面板) / `--bg-2`(卡片控件) / `--bg-3`(hover)，描边 `--line` / `--line-strong`。
  - 玻璃参数 `--glass-blur`(30px) / `--glass-blur-sm`(14px) / `--glass-sat` / `--glass-sheen` / `--glass-edge`。
  - accent 仍是火星红/橙（`--accent/--accent-2/--accent-3`），调色板不改粉丝色。
- **两档玻璃约定**：大面板（`.topbar/.bottombar/.sidebar/.glass/.card/.plcard/.popup/.qr-panel/.vpop/.mrow/.pager` 等）用 `backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat))`；小控件只用半透明填充 + `inset 0 1px 0` 顶边高光，**不叠模糊**（避免几十个模糊层拖垮渲染）。
- **组件里不要再写死颜色**，一律用上面的 token；新增面板加进 `style.css` 里那份「大面板清单」即可获得模糊。
- **backdrop-filter 嵌套限制（踩过的坑）**：父元素一旦有 `backdrop-filter` 就成为 backdrop root，子元素的模糊只能糊到父层自己的背景。所以遮罩层（`.overlay/.qr-backdrop/.backdrop`）**只压暗、不模糊**，模糊交给里面的玻璃面板 —— 否则弹层糊不到背后画面。
- **backdrop-filter 的第二个坑：它会创建层叠上下文，把内部弹层的 z-index 锁死**（2026-09-13 实际事故）：
  底栏加了 `backdrop-filter` 后成为层叠上下文，里面的音量面板 `.vpop`（z-index:60）在根上下文里等同 z-index:0，
  于是全屏遮罩 `.pop-backdrop`（z-index:50）**盖到了面板上面** → 鼠标事件全被遮罩吃掉 → **总音量/麦克风滑块拖不动**
  （只点击不拖反而会把面板关掉，是很典型的症状）。
  **修法**：给带模糊的容器自身显式抬起层级 —— `.bottombar { position: relative; z-index: 40 }`，
  并让遮罩降到其下 `.pop-backdrop { z-index: 30 }`。
  **通用规则**：任何加了 `backdrop-filter` 的容器，只要内部有绝对定位的弹层，就必须顺手给容器 `position: relative` + 足够的 `z-index`。
- **原生 range 滑块：统一用全局 `.slider` / `.slider--v`**（2026-09-13 用户反馈「滑块颜色和原唱开关不一样」后定下）：
  - 病因：滑块原来用 `accent-color: var(--accent)` —— 那是**实心**橙，而开关是**半透明橙玻璃**，两种观感。
  - 修法：弃用 `accent-color`，改用 `appearance: none` + 自绘轨道/滑块头，**与开关同色源**；
    已填充比例由组件用 `--fill` 喂进来，例如 `:style="{ '--fill': pct + '%' }"`。
  - 竖直滑块**别再写 `-webkit-appearance: slider-vertical`**（已废弃，新版 Chromium 失效后退化成横向，24px 宽列里抓不住）：
    用 `.slider--v`（`writing-mode: vertical-lr; direction: rtl`，上=最大，下=最小，填充从下往上）。
  - 样式定义在 `main/style.css` 与 `mobile/style.css`（两份镜像，改一处要同步另一处）。
- **控件配色统一走 `--ctrl-*` 语义 token**（`main/style.css` 与 `mobile/style.css` 各一份）：
  `--ctrl-accent`(控件底) / `--ctrl-accent-soft`(次级小控件) / `--ctrl-accent-line`(描边) / `--ctrl-accent-ink`(图标文字滑块头)，
  由底层的 `--accent-glass*` / `--accent-line` / `--accent-ink` 派生。
  **开关 / 滑块 / 播放键 / 选中态（chip、页码、侧栏当前项、已点）/ 「＋」/ 主按钮 / 头像占位** 全部从这里取色 ——
  改这 4 个变量即可整套同步。新增橙色控件一律用 `--ctrl-*`，不要再直接用 `--accent`（实心）或裸写 `--accent-glass*`。
- **橙玻璃分两档，别再临时拍透明度**（2026-09-13 用户反馈「重新扫描按钮跟导航选中色不一样」后定下）：
  - **soft 档 `--ctrl-accent-soft`（= `--accent-glass`，0.28→0.13）**：选中态 + 次级主按钮。
    用到的：`Sidebar .item.active`、`.row/.prow.active`、`.qrow.active`、`.f.on`、`.chip.on`、`.pg.on`、
    `.add`（＋）、`.r-add`、`.cat.on`、`.now-i`、`Sidebar .avatar` / `ArtistsView .ava` 占位、**`.btn.accent`（主按钮）**。
  - **strong 档 `--ctrl-accent`（= `--accent-glass-strong`，0.44→0.22）**：只有「强调动作键」用 ——
    `BottomBar .play`（播放）、`ControlSheet .big`（手机播放）、`DanmakuSheet .send`（发送）。
  - 判据：**「选中/被点亮」用 soft；「点下去要发生大事」用 strong**。`.btn.accent` 一度误用 strong，比侧栏选中项重，已改回 soft。
- **列表行统一外观（2026-09-13 用户要求，三态对齐左侧导航）**：
  - **默认态 = 原来「悬停」那层玻璃**（用户觉得好看）：`linear-gradient(180deg, rgba(255,250,246,.11), rgba(255,250,246,.04))` + `1px solid var(--line)`。
  - **悬停 = 与 Sidebar `.item:hover` 一致**：`background: var(--bg-3)` + `transform: translateY(2px)`。
  - **选中 = 与 `.item.active` 一致**：`var(--ctrl-accent-soft), var(--bg-2)` + `border-color: var(--ctrl-accent-line)` + `box-shadow: 0 6px 18px rgba(255,77,46,.18)`，标题转 `--ctrl-accent-ink`。
  - 定义位置：`main/style.css` 的「列表行统一外观」一节（`.row` / `.prow`）、`mobile/style.css`（`.row` / `.qrow`，手机端没有 hover，用 `:active` 代替）。
  - **组件里只写布局**（flex / padding / gap / radius），**不要再写行底色** —— 两处都写会互相打架（scoped 优先级更高，容易把全局规则顶掉）。
  - 列表容器必须有 `gap`（`.list` / `.plist` / 手机端 `.list`），否则相邻行的玻璃底会粘成一片。
  - `SongList.vue` / `VolumePanel.vue` 是**无引用的死代码**，不用维护。
- `.row`（SongRow）默认透明，`hover` 才浮起一层玻璃；全局 `--shadow-glow` 已收细到 `0 0 5px rgba(255,95,55,.3)`，给玻璃让位。
- 播放窗（`player/App.vue`）顶部信息条用「渐隐 + mask-image + 10px 模糊」压在视频上；待机页底色与主窗星云一致。
- 顺带清理：`SongList.vue` / `VolumePanel.vue` 里引用不存在的 `--neon/--neon-2/--neon-3`，已改为 `--accent*`。
- 可查看的风格样例：`.workbuddy/tmp/glass-style-preview.html`（静态复刻主界面，用于肉眼比对）。
- **橙色改「橙玻璃」，不做实心色块**（2026-09-13 用户明确要求）：主按钮/选中态统一用 `--accent-glass`（半透明橙底）或 `--accent-glass-strong`（主操作）+ `--accent-line` 描边 + `--accent-ink` 暖橙文字；元素本身 `border: none` 时用 `inset 0 0 0 1px var(--accent-line)` 做环，避免改布局。已覆盖：侧栏当前项、底栏播放键/原唱开关/「已点」、歌曲行「＋」、榜单徽标、当前页码、分类 chip、`重新扫描素材库`、歌手/用户头像占位，以及手机端播放键/发送/分类 chip/开关。`--on-accent` 已无引用（保留定义）。
- **预览页的坑**：`.workbuddy/tmp/*.html` 是走内置静态服务预览的（根路径 `/static-html/<hash>/`），
  页面里写 `../../src/...` 这类相对路径**取不到本地资源会 404**，头像/图片会变空。
  预览页里引用本地图片要**内联成 data URI（base64）**。诊断脚本见 `.workbuddy/tmp/diag.py`。
- **玻璃「通透」的正确配比（2026-09-13 两轮用户反馈后定死，别再动大方向）**：
  - 用户先反馈「背景有点重、不够透明」→ 我提亮底色 + 加亮色团 → 又被反馈**「背景太亮了，搞这么鲜艳干什么」**。
  - **结论：透明观感靠「半透明白面板 + 模糊透光」，绝不靠拔高背景亮度/饱和度。**
    - 底色最终 `--base-0 #100b10` / `--base-1 #1a131a` / `--base-2 #241a22`（只在最初 #0a0709 上微提一档）。
    - body 星云色团**只留克制的一层，alpha ≈ 0.15 / 0.12 / 0.06 / 0.09**，中央辉光 0.05（极淡）；
      **不要冷白挑光那一层**（会整体发亮）。
    - 面板填充 `--bg-1: rgba(255,246,242,.085)` 半透明白（这是透明的关键机制，必须保留），
      `--bg-0`(凹陷控件) .4、`--bg-2` .07、`--bg-3`(hover) .13、`--line` .15。
    - `--glass-blur: 34px`、`--glass-sat: 150%`（**别超 150%，超了背景发艳**）、`--glass-sheen` 顶 .10；
      `--shadow-glass/panel/pop` = 0.22 / 0.34 / 0.42（重投影会让整体发「重」）。
  - **新增面板一律用「半透明白 + 发丝描边 + 顶边高光」，不要再写深色实心填充，也不要为了「透」去提亮底色。**
- **小号橙字对比度**：背景提亮后 `--accent`(#ff4d2e) 在浅玻璃上只有 ~4:1，已达标 11–16px 橙字
  （`.rank.top` / `.lang` / `.time` / `.no`）统一改用 `--accent-2`(#ff8c42)。`--accent` 只留给描边、光晕和 ≥18px 的大字号。
