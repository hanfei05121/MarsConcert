<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { parseLrc, findActiveLine } from './lrc'
import type { LyricLine } from './lrc'
import LyricsOverlay from './components/LyricsOverlay.vue'
import type { Playload, VideoMode, Volumes } from '../../shared/types'

const videoRef = ref<HTMLVideoElement | null>(null)
const src = ref('')
const lyrics = ref<LyricLine[]>([])
const activeIndex = ref(-1)
const mode = ref<VideoMode>('orig')
const errorMsg = ref('')
const songName = ref('')
const lyricOffset = ref(0) // 歌词整体偏移（秒）：正=歌词延后，校正音画/歌词错位

let current: Playload | null = null
let volumes: Volumes = { orig: 1, accomp: 1, master: 1, mic: 1 }
let wasPlaying = false
let savedTime = 0

// —— 麦克风增益（WebAudio 真实处理唱歌人声）——
let micCtx: AudioContext | null = null
let micGain: GainNode | null = null
let micStream: MediaStream | null = null

async function initMic() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    micCtx = new AudioContext()
    const src = micCtx.createMediaStreamSource(micStream)
    micGain = micCtx.createGain()
    micGain.gain.value = Math.max(0, volumes.mic ?? 1)
    src.connect(micGain)
    micGain.connect(micCtx.destination)
  } catch {
    micStream = null
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

function disposeMic() {
  if (micStream) micStream.getTracks().forEach((t) => t.stop())
  micStream = null
  if (micCtx) micCtx.close().catch(() => {})
  micCtx = null
  micGain = null
}

const hasLyrics = computed(() => lyrics.value.length > 0)

function applyVolume() {
  const v = videoRef.value
  if (!v) return
  const part = mode.value === 'orig' ? volumes.orig : volumes.accomp
  v.volume = Math.min(1, Math.max(0, part * volumes.master))
}

function setSource(forceTime?: number) {
  if (!current) return
  src.value = current.urls[mode.value === 'orig' ? 'orig' : 'accomp']
  // 等元数据加载后恢复进度并播放
  wasPlaying = true
  savedTime = forceTime ?? 0
}

function onLoadedMetadata() {
  const v = videoRef.value
  if (!v) return
  if (savedTime > 0) v.currentTime = savedTime
  applyVolume()
  if (wasPlaying) v.play().catch(() => {})
}

function load(p: Playload) {
  current = p
  mode.value = p.mode
  volumes = p.volumes
  applyMicVolume()
  songName.value = `${p.song.name}${p.song.artist ? ' - ' + p.song.artist : ''}`
  lyrics.value = parseLrc(p.lrc)
  activeIndex.value = -1
  // 恢复该歌曲已保存的歌词偏移（官方 MV 长前奏等错位，调一次永久生效）
  lyricOffset.value = p.song.lyricOffset ?? 0
  errorMsg.value = ''
  savedTime = 0
  setSource(0)
}

function switchMode(next: VideoMode) {
  if (!current) return
  const v = videoRef.value
  if (v) savedTime = v.currentTime
  mode.value = next
  wasPlaying = !v || !v.paused
  setSource(savedTime)
}

function handleControl(action: string, payload?: number) {
  const v = videoRef.value
  if (!v) return
  if (action === 'play') v.play().catch(() => {})
  else if (action === 'pause') v.pause()
  else if (action === 'seek' && typeof payload === 'number') v.currentTime = payload
}

// 歌词整体偏移校正（秒）：正=歌词延后，用于视频与 LRC 不同步时现场对齐
// 限幅 ±120s，调整后按歌曲持久化，免去每次重调
function nudgeLyric(delta: number) {
  const next = Math.round((lyricOffset.value + delta) * 10) / 10
  lyricOffset.value = Math.min(120, Math.max(-120, next))
  if (current?.song?.id != null) {
    window.api.setLyricOffset(current.song.id, lyricOffset.value).catch(() => {})
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
    })
  )
  initMic()

  // Esc：最小化播放屏；[ / ]（或 ←/→）：歌词提前/延后 0.5s
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') window.api.escape()
    else if (e.key === ']' || e.key === 'ArrowRight') nudgeLyric(0.5)
    else if (e.key === '[' || e.key === 'ArrowLeft') nudgeLyric(-0.5)
  }
  window.addEventListener('keydown', onKey)
  offs.push(() => window.removeEventListener('keydown', onKey))
})
onUnmounted(() => {
  offs.forEach((off) => off())
  disposeMic()
})

// —— video 事件上报 ——
function onTimeUpdate() {
  const v = videoRef.value
  if (!v) return
  window.api.emitTime({ currentTime: v.currentTime, duration: v.duration || 0 })
  activeIndex.value = findActiveLine(lyrics.value, v.currentTime - lyricOffset.value)
}
function onPlay() {
  window.api.emitState({ playing: true })
}
function onPause() {
  window.api.emitState({ playing: false })
}
function onEnded() {
  window.api.emitEnded()
}
function onError() {
  errorMsg.value = '无法播放该视频，请检查素材文件是否存在（orig.mp4 / accomp.mp4）'
}
</script>

<template>
  <div class="stage">
    <video
      v-show="!errorMsg"
      ref="videoRef"
      class="video"
      :src="src"
      autoplay
      playsinline
      @loadedmetadata="onLoadedMetadata"
      @timeupdate="onTimeUpdate"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
      @error="onError"
    />
    <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

    <div class="topbar">
      <span class="title">{{ songName || '等待点歌…' }}</span>
      <span class="mode" :class="mode">{{ mode === 'orig' ? '原唱' : '伴奏' }}</span>
    </div>

    <LyricsOverlay :lines="lyrics" :active="activeIndex" />
    <div v-if="!hasLyrics && !errorMsg" class="no-lyric">♪</div>

    <div v-if="hasLyrics" class="lyric-offset">
      <div class="grp">
        <button @click="nudgeLyric(-5)">提前5s</button>
        <button @click="nudgeLyric(-0.5)">提前0.5s</button>
      </div>
      <span class="val">
        {{ lyricOffset > 0 ? '延后' : lyricOffset < 0 ? '提前' : '已对齐' }}
        {{ lyricOffset !== 0 ? ' ' + Math.abs(lyricOffset).toFixed(1) + 's' : '' }}
      </span>
      <div class="grp">
        <button @click="nudgeLyric(0.5)">延后0.5s</button>
        <button @click="nudgeLyric(5)">延后5s</button>
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
  border: 1px solid #ff3d8b;
  color: #ff3d8b;
}
.mode.accomp {
  border-color: #21e6c1;
  color: #21e6c1;
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
.lyric-offset {
  position: absolute;
  right: 24px;
  bottom: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 13px;
  pointer-events: auto;
  z-index: 5;
  user-select: none;
}
.lyric-offset button {
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: transparent;
  color: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
}
.lyric-offset button:hover {
  background: rgba(255, 255, 255, 0.15);
}
.lyric-offset .val {
  min-width: 88px;
  text-align: center;
}
.lyric-offset .grp {
  display: flex;
  gap: 6px;
}
</style>
