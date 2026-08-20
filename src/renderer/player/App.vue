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

let current: Playload | null = null
let volumes: Volumes = { orig: 1, accomp: 1, master: 1 }
let wasPlaying = false
let savedTime = 0

const hasLyrics = computed(() => lyrics.value.length > 0)

function mediaUrl(p: string): string {
  return `media://${encodeURI(p.replace(/\\/g, '/'))}`
}

function applyVolume() {
  const v = videoRef.value
  if (!v) return
  const part = mode.value === 'orig' ? volumes.orig : volumes.accomp
  v.volume = Math.min(1, Math.max(0, part * volumes.master))
}

function setSource(forceTime?: number) {
  if (!current) return
  const path = mode.value === 'orig' ? current.song.orig_path : current.song.accomp_path
  src.value = mediaUrl(path)
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
  songName.value = `${p.song.name}${p.song.artist ? ' - ' + p.song.artist : ''}`
  lyrics.value = parseLrc(p.lrc)
  activeIndex.value = -1
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
    })
  )
})
onUnmounted(() => offs.forEach((off) => off()))

// —— video 事件上报 ——
function onTimeUpdate() {
  const v = videoRef.value
  if (!v) return
  window.api.emitTime({ currentTime: v.currentTime, duration: v.duration || 0 })
  activeIndex.value = findActiveLine(lyrics.value, v.currentTime)
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
</style>
