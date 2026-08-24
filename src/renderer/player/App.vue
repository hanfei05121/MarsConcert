<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { AudioOutlined, CustomerServiceOutlined, WarningOutlined, MinusOutlined, BorderOutlined, CloseOutlined } from '@ant-design/icons-vue'
import { parseLrc, findActiveLine } from './lrc'
import type { LyricLine } from './lrc'
import LyricsOverlay from './components/LyricsOverlay.vue'
import type { Playload, VideoMode, Volumes, ModePayload, DanmakuItem, RemoteInfo } from '../../shared/types'

const videoRef = ref<HTMLVideoElement | null>(null)
const accompAudioRef = ref<HTMLAudioElement | null>(null) // 伴奏轨：一直播放
const origAudioRef = ref<HTMLAudioElement | null>(null) // 人声轨：原唱模式叠加输出
const src = ref('') // 视频画面地址（video.mp4，无音轨）
const accompSrc = ref('') // 伴奏音频（常播）
const origSrc = ref('') // 人声音频（原唱时叠加）
const lyrics = ref<LyricLine[]>([])
const activeIndex = ref(-1)
const lyricNow = ref(0) // 当前歌词时间（视频时间 - 歌词偏移），供长前奏时隐藏歌词用
const mode = ref<VideoMode>('orig')
const errorMsg = ref('')
const audioError = ref(false)
const songName = ref('')
const lyricOffset = ref(0) // 歌词整体偏移（秒）：正=歌词延后，校正音画/歌词错位
const idle = ref(true) // 空闲态：无歌曲/播完无下一首时，副屏显示“去点歌”提示而不是黑屏挂歌词

// —— 弹幕（手机发来的文字，副屏叠加滚动）——
interface DanmakuLine {
  id: number
  text: string
  top: number // 垂直位置(百分比)
  dur: number // 滚动时长(秒)
  size: number // 字号
}
const danmakus = ref<DanmakuLine[]>([])
function pushDanmaku(d: DanmakuItem) {
  const line: DanmakuLine = {
    id: d.id,
    text: d.text,
    top: 8 + Math.random() * 62,
    dur: 8 + Math.random() * 4,
    size: 26 + Math.floor(Math.random() * 10)
  }
  danmakus.value.push(line)
  window.setTimeout(() => {
    danmakus.value = danmakus.value.filter((x) => x.id !== d.id)
  }, (line.dur + 1) * 1000)
}

// —— 待机页展示手机遥控二维码 ——
const remoteInfo = ref<RemoteInfo | null>(null)

let current: Playload | null = null
let audioUrls: { orig: string; accomp: string } = { orig: '', accomp: '' }
let volumes: Volumes = { orig: 1, accomp: 1, master: 1, mic: 1 }
let userPlaying = false // 用户意图（是否要出声）；不受「窗口隐藏导致视频被系统暂停」影响
let wasPlaying = false
let savedTime = 0
let idleTimer: ReturnType<typeof setTimeout> | null = null

/** 进入待点歌空闲态：清空媒体与歌词，副屏显示提示页 */
function showIdle() {
  idle.value = true
  current = null
  userPlaying = false
  wasPlaying = false
  songName.value = ''
  lyrics.value = []
  activeIndex.value = -1
  errorMsg.value = ''
  audioError.value = false
  const v = videoRef.value
  if (v) {
    v.pause()
    v.removeAttribute('src')
    v.load() // 清掉最后一帧画面，避免残留
  }
  accompAudioRef.value?.pause()
  origAudioRef.value?.pause()
}

// —— 麦克风（WebAudio 真实处理唱歌人声）——
// 麦克风常开：只要麦克风音量 >0，就把麦克风接到扬声器（监听），
// 原唱/伴奏模式都能听到自己的声音（用户需求：不管开不开伴奏，麦克风一直有声音）。
let micCtx: AudioContext | null = null
let micGain: GainNode | null = null
let micStream: MediaStream | null = null
let micReady = false
let micMonitoring = false

async function ensureMic(): Promise<boolean> {
  if (micReady) return true
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    micCtx = new AudioContext()
    const src = micCtx.createMediaStreamSource(micStream)
    micGain = micCtx.createGain()
    micGain.gain.value = Math.max(0, volumes.mic ?? 1)
    src.connect(micGain)
    // 注意：micGain 默认不接 destination，由 setMicMonitor 按需连接
    micReady = true
    return true
  } catch {
    micStream = null
    micCtx = null
    micGain = null
    return false
  }
}

// 开启/关闭麦克风监听（连接到 / 断开扬声器）
async function setMicMonitor(on: boolean) {
  micMonitoring = on
  if (on) {
    const ok = await ensureMic()
    if (!ok || !micGain || !micCtx) return
    try { micGain.disconnect(micCtx.destination) } catch {}
    micGain.connect(micCtx.destination)
  } else if (micGain && micCtx) {
    try { micGain.disconnect(micCtx.destination) } catch {}
  }
}

function applyMicVolume() {
  const g = micGain
  const c = micCtx
  if (!g || !c) return
  const target = Math.max(0, volumes.mic ?? 1)
  if (target <= 0.01) g.gain.setTargetAtTime(0, c.currentTime, 0.02)
  else g.gain.setTargetAtTime(target, c.currentTime, 0.02)
}

// 麦克风常开：只要麦克风音量 >0 就监听（与原唱/伴奏模式无关），音量调 0 才静音
function refreshMicMonitor() {
  setMicMonitor((volumes.mic ?? 0) > 0)
}

function disposeMic() {
  if (micStream) micStream.getTracks().forEach((t) => t.stop())
  micStream = null
  if (micCtx) micCtx.close().catch(() => {})
  micCtx = null
  micGain = null
  micReady = false
  micMonitoring = false
}

const hasLyrics = computed(() => lyrics.value.length > 0)

// 音量按轨独立控制：伴奏轨 = accomp×总音量，人声轨 = orig×总音量
function applyVolume() {
  const a = accompAudioRef.value
  const o = origAudioRef.value
  const m = Math.min(1, Math.max(0, volumes.master))
  if (a) a.volume = Math.min(1, Math.max(0, volumes.accomp * m))
  if (o) o.volume = Math.min(1, Math.max(0, volumes.orig * m))
}

/**
 * 把所有音频对齐到视频时钟并起停。
 * 关键：起停只看「用户意图 userPlaying」，绝不让「视频被系统暂停」拖停音频——
 * 窗口被盖住/切走时 Chromium 会暂停静音视频省资源，但音频必须继续放。
 */
function syncAudios() {
  const v = videoRef.value
  const a = accompAudioRef.value
  const o = origAudioRef.value
  if (!v) return
  const t = v.currentTime || 0
  if (a) {
    if (a.readyState >= 1) a.currentTime = t
    if (userPlaying) a.play().catch(() => { audioError.value = true })
    else a.pause()
  }
  if (o && o.src) {
    if (o.readyState >= 1) o.currentTime = t
    if (userPlaying && mode.value === 'orig') o.play().catch(() => { audioError.value = true })
    else o.pause()
  }
  applyVolume()
}

function onVideoLoadedMetadata() {
  const v = videoRef.value
  if (!v) return
  if (savedTime > 0) v.currentTime = savedTime
  if (wasPlaying) v.play().catch(() => {})
}

function onAudioLoadedMetadata() {
  // 任一音频单独加载完成后对齐到视频当前时间并按用户意图起播
  syncAudios()
}

function load(p: Playload) {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  idle.value = false
  current = p
  mode.value = p.mode
  volumes = p.volumes
  audioUrls = p.audioUrls
  applyMicVolume()
  refreshMicMonitor()
  songName.value = `${p.song.name}${p.song.artist ? ' - ' + p.song.artist : ''}`
  lyrics.value = parseLrc(p.lrc)
  activeIndex.value = -1
  lyricNow.value = 0
  // 恢复该歌曲已保存的歌词偏移（官方 MV 长前奏等错位，调一次永久生效）
  lyricOffset.value = p.song.lyricOffset ?? 0
  errorMsg.value = ''
  audioError.value = false
  src.value = p.videoUrl
  accompSrc.value = p.audioUrls.accomp
  origSrc.value = p.audioUrls.orig
  savedTime = 0
  wasPlaying = true
  userPlaying = true
}

/**
 * 原唱/伴奏切换 = 人声轨叠加开关：
 * - 原唱：accomp（伴奏）+ orig（人声）同时输出
 * - 伴奏：只输出 accomp，人声轨静音（这时开麦克风，用户自己唱）
 * 视频画面/解码完全不中断，伴奏轨也从不中断。
 */
function switchMode(p: ModePayload) {
  if (!current) return
  const next = typeof p === 'string' ? (p as VideoMode) : p.mode // 兼容旧格式消息
  // 主进程若带来最新音频地址（点歌后素材变化），更新两条音轨
  if (p && typeof p === 'object' && p.audioUrls) {
    if (p.audioUrls.accomp && p.audioUrls.accomp !== accompSrc.value) accompSrc.value = p.audioUrls.accomp
    if (p.audioUrls.orig && p.audioUrls.orig !== origSrc.value) origSrc.value = p.audioUrls.orig
    audioUrls = p.audioUrls
  }
  mode.value = next
  audioError.value = false
  const o = origAudioRef.value
  if (o && o.src) {
    if (next === 'orig' && userPlaying) o.play().catch(() => { audioError.value = true })
    else o.pause()
  }
  refreshMicMonitor()
}

function handleControl(action: string, payload?: number) {
  const v = videoRef.value
  const a = accompAudioRef.value
  const o = origAudioRef.value
  if (action === 'play') {
    userPlaying = true
    v?.play().catch(() => {})
    a?.play().catch(() => {})
    if (o && o.src && mode.value === 'orig') o.play().catch(() => { audioError.value = true })
  } else if (action === 'pause') {
    userPlaying = false
    v?.pause()
    a?.pause()
    o?.pause()
  } else if (action === 'seek' && typeof payload === 'number') {
    if (v) v.currentTime = payload
    if (a) a.currentTime = payload
    if (o) o.currentTime = payload
  }
}

// —— 注册播放窗指令 ——
const offs: Array<() => void> = []
onMounted(() => {
  offs.push(
    window.api.onLoad((p) => load(p)),
    window.api.onSetMode((m) => switchMode(m)),
    window.api.onControl(({ action, payload }) => handleControl(action, payload)),
    window.api.onVolumes((vol) => {
      volumes = vol
      applyVolume()
      applyMicVolume()
      refreshMicMonitor()
    }),
    window.api.onStop(() => showIdle()), // 已点为空时点下一首 → 回到待点歌页
    window.api.onDanmaku((d) => pushDanmaku(d))
  )

  // 待机页展示手机遥控二维码
  window.api.getRemoteInfo().then((r) => (remoteInfo.value = r)).catch(() => {})

  // Esc：最小化播放屏，把控制权还给控制台
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') window.api.escape()
  }
  window.addEventListener('keydown', onKey)
  offs.push(() => window.removeEventListener('keydown', onKey))

  // 窗口重新可见时：视频若被系统暂停（静音视频在隐藏时会被 Chromium 暂停），
  // 拉回视频位置并续播；音频一直没停，不受影响
  const onVis = () => {
    if (document.visibilityState === 'visible') {
      const v = videoRef.value
      const a = accompAudioRef.value
      if (v && a && userPlaying) {
        if (Math.abs(v.currentTime - a.currentTime) > 0.5) v.currentTime = a.currentTime
        if (v.paused) v.play().catch(() => {})
      }
    }
  }
  document.addEventListener('visibilitychange', onVis)
  offs.push(() => document.removeEventListener('visibilitychange', onVis))
})
onUnmounted(() => {
  if (idleTimer) clearTimeout(idleTimer)
  offs.forEach((off) => off())
  disposeMic()
})

// —— video 事件上报 ——
function onTimeUpdate() {
  const v = videoRef.value
  if (!v) return
  window.api.emitTime({ currentTime: v.currentTime, duration: v.duration || 0 })
  const lt = v.currentTime - lyricOffset.value // 歌词时间（含偏移）
  activeIndex.value = findActiveLine(lyrics.value, lt)
  lyricNow.value = lt
  // 视频为时间主源：两条音频漂移超过阈值时拉回
  const t = v.currentTime
  const a = accompAudioRef.value
  const o = origAudioRef.value
  if (a && !a.paused && Math.abs(a.currentTime - t) > 0.3) a.currentTime = t
  if (o && o.src && !o.paused && Math.abs(o.currentTime - t) > 0.3) o.currentTime = t
}
function onPlay() {
  userPlaying = true
  window.api.emitState({ playing: true })
  syncAudios() // 视频恢复时确保音频跟随用户意图
}
function onPause() {
  // 区分「用户暂停」和「窗口隐藏被系统暂停」：
  // 只有用户暂停才上报停止；系统因隐藏暂停视频时音频仍在播，不上报
  if (!userPlaying) window.api.emitState({ playing: false })
}
function onEnded() {
  userPlaying = false
  accompAudioRef.value?.pause()
  origAudioRef.value?.pause()
  window.api.emitEnded()
  // 宽限期：控制台若有下一首会立刻发来 load；2.5s 内没有新歌就进入待点歌提示页
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (idle.value) return
    showIdle()
  }, 2500)
}
function onVideoError() {
  errorMsg.value = '无法播放该视频，请检查素材文件是否存在（<歌曲名>.mp4 / <歌曲名>_vocals.mp3 / <歌曲名>_instrumental.mp3）'
}

// 副屏窗口控制：最小化 / 最大化 / 关闭（关闭后下次点歌自动重开）
function pwin(action: 'min' | 'max' | 'close') {
  window.api.playerWindowControl(action)
}
function onAudioError() {
  audioError.value = true
}
</script>

<template>
  <div class="stage">
    <!-- 副屏窗口控制：最小化 / 最大化 / 关闭（无边框窗口没有系统标题栏） -->
    <div class="pctrl">
      <button class="pic" title="最小化" @click="pwin('min')"><MinusOutlined /></button>
      <button class="pic" title="最大化" @click="pwin('max')"><BorderOutlined /></button>
      <button class="pic close" title="关闭" @click="pwin('close')"><CloseOutlined /></button>
    </div>

    <!-- 空闲态：启动/播完无下一首时，副屏提示点歌，而不是黑屏挂着上一句歌词 -->
    <div v-if="idle" class="idle">
      <div class="idle-box">
        <div class="idle-icon"><CustomerServiceOutlined /></div>
        <div class="idle-title">没有歌曲啦，请点歌 ~ ~</div>
        <div class="idle-sub">搜索或浏览歌曲，点击即可</div>
        <!-- 手机遥控扫码入口 -->
        <div v-if="remoteInfo" class="idle-remote">
          <img v-if="remoteInfo.qrDataUrl" :src="remoteInfo.qrDataUrl" class="idle-qr" alt="扫码用手机遥控" />
          <div class="idle-qr-label">扫码用手机 · 点歌</div>
        </div>
      </div>
    </div>

    <template v-else>
      <video
        v-show="!errorMsg"
        ref="videoRef"
        class="video"
        :src="src"
        autoplay
        muted
        playsinline
        @loadedmetadata="onVideoLoadedMetadata"
        @timeupdate="onTimeUpdate"
        @play="onPlay"
        @pause="onPause"
        @ended="onEnded"
        @error="onVideoError"
      />
      <!-- 伴奏轨：常播（accomp.m4a） -->
      <audio
        ref="accompAudioRef"
        class="hidden-audio"
        :src="accompSrc"
        preload="auto"
        @loadedmetadata="onAudioLoadedMetadata"
        @error="onAudioError"
      />
      <!-- 人声轨：原唱模式叠加（orig.m4a） -->
      <audio
        ref="origAudioRef"
        class="hidden-audio"
        :src="origSrc"
        preload="auto"
        @loadedmetadata="onAudioLoadedMetadata"
        @error="onAudioError"
      />
      <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

      <div class="topbar">
        <span class="title">{{ songName || '等待点歌…' }}</span>
        <span class="mode" :class="mode">{{ mode === 'orig' ? '原唱' : '伴奏' }}</span>
        <span v-if="audioError" class="audio-warn"><WarningOutlined /> 音频缺失</span>
      </div>

      <LyricsOverlay :lines="lyrics" :active="activeIndex" :now="lyricNow" />
      <div v-if="!hasLyrics && !errorMsg" class="no-lyric"><AudioOutlined /></div>
    </template>

    <!-- 弹幕层：手机发来的文字从右向左滚动叠加在画面上方 -->
    <div v-if="!idle && danmakus.length" class="danmaku-layer">
      <div
        v-for="d in danmakus"
        :key="d.id"
        class="dan"
        :style="{ top: d.top + '%', fontSize: d.size + 'px', animationDuration: d.dur + 's' }"
      >
        {{ d.text }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: fixed;
  inset: 0;
  background: #000;
  overflow: hidden;
}
.video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
.hidden-audio {
  display: none;
}
.topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 22px 32px;
  display: flex;
  align-items: center;
  gap: 16px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.7), transparent);
  pointer-events: none;
}
.title {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
}
.mode {
  font-size: 13px;
  padding: 3px 12px;
  border-radius: 999px;
  border: 1px solid #ff5a2e;
  color: #ff5a2e;
}
.mode.accomp {
  border-color: #ff8c42;
  color: #ff8c42;
}
.audio-warn {
  font-size: 13px;
  padding: 3px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 191, 0, 0.8);
  color: #ffbf00;
  background: rgba(0, 0, 0, 0.4);
}
.error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 18px;
  text-align: center;
  padding: 40px;
}
.no-lyric {
  position: absolute;
  top: 40%;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 60px;
  color: rgba(255, 255, 255, 0.18);
}
/* —— 待点歌空闲页 —— */
.idle {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at center, #1a120f 0%, #0a0605 70%);
}
.idle-box {
  text-align: center;
  animation: idleFloat 3s ease-in-out infinite;
}
.idle-icon {
  font-size: 96px;
  line-height: 1;
  margin-bottom: 26px;
  filter: drop-shadow(0 0 30px rgba(255, 77, 46, 0.5));
}
.idle-title {
  font-size: 46px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 6px;
  text-shadow: 0 0 28px rgba(255, 77, 46, 0.55), 0 4px 14px rgba(0, 0, 0, 0.8);
}
.idle-sub {
  margin-top: 16px;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 2px;
}
.idle-remote {
  margin-top: 28px;
}
.idle-qr {
  width: 180px;
  height: 180px;
  border-radius: 14px;
  background: #fff;
  padding: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}
.idle-qr-label {
  margin-top: 14px;
  font-size: 16px;
  color: #ffd166;
  letter-spacing: 1px;
}
@keyframes idleFloat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
/* —— 弹幕 —— */
.danmaku-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.dan {
  position: absolute;
  left: 0;
  white-space: nowrap;
  color: #fff;
  font-weight: 700;
  text-shadow:
    0 2px 4px rgba(0, 0, 0, 0.9),
    0 0 10px rgba(255, 77, 46, 0.6);
  will-change: transform;
  animation: danfly linear forwards;
}
@keyframes danfly {
  from {
    transform: translateX(100vw);
  }
  to {
    transform: translateX(-100vw);
  }
}
/* —— 副屏窗口控制按钮（无边框窗口无系统标题栏） —— */
.pctrl {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  pointer-events: auto;
  opacity: 0.25;
  transition: opacity 0.25s ease;
}
.pctrl:hover {
  opacity: 1;
}
.pic {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}
.pic:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: #ff5a2e;
}
.pic.close:hover {
  background: #e5484d;
  border-color: #e5484d;
}
</style>
