<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AudioOutlined,
  CustomerServiceOutlined,
  SoundOutlined,
  StepBackwardOutlined,
  StepForwardOutlined
} from '@ant-design/icons-vue'
import { store } from '../store'

const state = store.state

function fmt(d: number): string {
  if (!d || d <= 0) return '00:00'
  const m = Math.floor(d / 60)
  const s = Math.floor(d % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const masterPct = computed(() => Math.round(state.volumes.master * 100))
const micPct = computed(() => Math.round(state.volumes.mic * 100))
const popOpen = ref(false)

function onMaster(val: number) {
  state.volumes.master = val / 100
  store.applyVolumes()
}
function onMic(val: number) {
  state.volumes.mic = val / 100
  store.applyVolumes()
}
</script>

<template>
  <footer class="bottombar">
    <!-- 缩略 + 信息 -->
    <div class="left">
      <div class="thumb">
        <img v-if="state.currentSong?.logo" :src="state.currentSong.logo" :alt="state.currentSong.artist" />
        <span v-else-if="!state.currentSong"><AudioOutlined /></span>
        <span v-else><CustomerServiceOutlined /></span>
      </div>
      <div class="info">
        <div class="name">{{ state.currentSong?.name || '等待点歌…' }}</div>
        <div class="sub">
          {{ state.currentSong?.artist || '点一首歌开始吧' }}
          <span class="time">{{ fmt(state.currentTime) }}</span>
        </div>
      </div>
    </div>

    <!-- 播放控制 -->
    <div class="center">
      <button class="ctl" title="上一曲" @click="store.playPrev()"><StepBackwardOutlined /></button>
      <button class="play" :title="state.playing ? '暂停' : '播放'" @click="store.togglePlay()">
        <svg v-if="state.playing" class="ic" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
        </svg>
        <svg v-else class="ic" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M8 5v14l11-7z" fill="currentColor" />
        </svg>
      </button>
      <button class="ctl" title="下一曲" @click="store.playNext()"><StepForwardOutlined /></button>
    </div>

    <!-- 功能按钮组 -->
    <div class="funcs">
      <button class="f" title="重唱" @click="store.reSing()">重唱</button>
      <button
        id="queue-fab"
        class="f"
        :class="{ on: state.queueOpen }"
        title="已点歌单"
        @click="store.toggleQueueOpen()"
      >
        已点
        <span v-if="state.queue.length" class="qbadge">{{ state.queue.length }}</span>
      </button>
      <div class="orig">
        <span class="ol">原唱</span>
        <button
          class="toggle"
          :class="{ on: state.mode === 'orig' }"
          @click="store.toggleMode()"
        >
          <span class="knob" />
        </button>
      </div>
    </div>

    <!-- 音量 + 麦克风 + 总时长 -->
    <div class="right">
      <button class="vbtn" title="音量" @click="popOpen = !popOpen">
        <span class="spk"><SoundOutlined /></span>
        <span class="vt">{{ masterPct }}</span>
      </button>
      <button class="vbtn" title="麦克风音量" @click="popOpen = !popOpen">
        <span class="spk"><CustomerServiceOutlined /></span>
        <span class="vt">{{ micPct }}</span>
      </button>
      <span class="total">{{ fmt(state.duration) }}</span>

      <!-- 点击后弹出的竖直音量面板 -->
      <div v-if="popOpen" class="vpop">
        <div class="col">
          <span class="vlbl">总音量</span>
          <input
            class="vslide"
            type="range"
            min="0"
            max="100"
            :value="masterPct"
            step="1"
            @input="onMaster(Number(($event.target as HTMLInputElement).value))"
          />
          <span class="vnum">{{ masterPct }}</span>
        </div>
        <div class="col">
          <span class="vlbl">麦克风</span>
          <input
            class="vslide"
            type="range"
            min="0"
            max="100"
            :value="micPct"
            step="1"
            @input="onMic(Number(($event.target as HTMLInputElement).value))"
          />
          <span class="vnum">{{ micPct }}</span>
        </div>
      </div>
    </div>
  </footer>

  <!-- 点击面板外关闭 -->
  <div v-if="popOpen" class="pop-backdrop" @click="popOpen = false" />
</template>

<style scoped>
.bottombar {
  height: 84px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 22px;
  background: var(--bg-1);
  border-top: 1px solid var(--line);
}
.left {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 260px;
}
.thumb {
  width: 52px;
  height: 52px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--bg-3), var(--bg-2));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
  overflow: hidden;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.info {
  min-width: 0;
}
.name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub {
  font-size: 12px;
  color: var(--text-2);
  display: flex;
  gap: 8px;
  margin-top: 3px;
}
.time {
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}
.center {
  display: flex;
  align-items: center;
  gap: 14px;
}
.ctl {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--bg-2);
  color: var(--text-0);
  font-size: 18px;
  cursor: pointer;
}
.ctl:hover {
  border-color: var(--accent);
}
.play {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: var(--on-accent);
  padding: 0;
  cursor: pointer;
  box-shadow: var(--shadow-accent);
}
.play .ic {
  display: block;
}
.funcs {
  display: flex;
  align-items: center;
  gap: 10px;
}
.f {
  position: relative;
  height: 36px;
  padding: 0 14px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: var(--bg-2);
  color: var(--text-1);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.f:hover {
  border-color: var(--accent);
}
.f.on {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent);
}
/* 已点数量徽标：按钮右上角 */
.qbadge {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--danger);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  line-height: 18px;
  text-align: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}
/* 亮点落位后的弹跳，呼应数字 +1 */
.f.bump {
  animation: qbump 0.42s ease;
}
@keyframes qbump {
  0% {
    transform: scale(1);
  }
  35% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
  }
}
.orig {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ol {
  font-size: 13px;
  color: var(--text-1);
  font-weight: 600;
}
.toggle {
  width: 50px;
  height: 28px;
  border-radius: 999px;
  border: none;
  background: var(--bg-3);
  position: relative;
  cursor: pointer;
  transition: background 0.15s ease;
}
.toggle.on {
  background: var(--accent);
}
.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.15s ease;
}
.toggle.on .knob {
  left: 25px;
}
.right {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
  margin-left: auto;
}
.vbtn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 44px;
  padding: 4px 8px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--bg-2);
  color: var(--text-0);
  cursor: pointer;
}
.vbtn:hover {
  border-color: var(--accent);
}
.spk {
  font-size: 15px;
  line-height: 1;
}
.vt {
  font-size: 10px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.total {
  font-size: 13px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
  width: 44px;
  text-align: right;
}
.vpop {
  position: absolute;
  right: 0;
  bottom: calc(100% + 12px);
  z-index: 60;
  display: flex;
  gap: 16px;
  padding: 16px 14px;
  background: var(--bg-1);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: var(--shadow-panel);
}
.col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.vlbl {
  font-size: 12px;
  color: var(--text-2);
}
.vslide {
  width: 22px;
  height: 140px;
  accent-color: var(--accent);
  cursor: pointer;
  -webkit-appearance: slider-vertical;
}
.vnum {
  font-size: 12px;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}
.pop-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
}
</style>
