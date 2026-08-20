<script setup lang="ts">
import { computed } from 'vue'
import { store, progress } from '../store'

const state = store.state

function fmt(d: number): string {
  if (!d || d <= 0) return '00:00'
  const m = Math.floor(d / 60)
  const s = Math.floor(d % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const masterPct = computed(() => Math.round(state.volumes.master * 100))

function onVolume(val: number) {
  state.volumes.master = val / 100
  store.applyVolumes()
}
</script>

<template>
  <footer class="bottombar">
    <!-- 缩略 + 信息 -->
    <div class="left">
      <div class="thumb">
        <span v-if="!state.currentSong">♪</span>
        <span v-else>🎵</span>
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
      <button class="ctl" title="上一曲" @click="store.playPrev()">⏮</button>
      <button class="play" :title="state.playing ? '暂停' : '播放'" @click="store.togglePlay()">
        {{ state.playing ? '⏸' : '▶' }}
      </button>
      <button class="ctl" title="下一曲" @click="store.playNext()">⏭</button>
    </div>

    <!-- 功能按钮组 -->
    <div class="funcs">
      <button class="f" title="重唱" @click="store.reSing()">重唱</button>
      <button
        class="f"
        :class="{ on: state.currentSong && store.isFav(state.currentSong.id) }"
        title="收藏"
        @click="state.currentSong && store.toggleFav(state.currentSong)"
      >
        收藏
      </button>
      <button class="f" :title="state.playMode === 'order' ? '顺序播放' : '随机播放'" @click="store.togglePlayMode()">
        {{ state.playMode === 'order' ? '顺序' : '随机' }}
      </button>
      <button class="f" :class="{ on: state.queueOpen }" title="已点歌单" @click="store.toggleQueueOpen()">
        已点
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

    <!-- 音量 + 总时长 -->
    <div class="right">
      <span class="spk">🔊</span>
      <input
        class="vol"
        type="range"
        min="0"
        max="100"
        :value="masterPct"
        @input="onVolume(Number(($event.target as HTMLInputElement).value))"
      />
      <span class="vt">{{ masterPct }}</span>
      <span class="total">{{ fmt(state.duration) }}</span>
      <div class="prog"><div class="bar" :style="{ width: progress + '%' }" /></div>
    </div>
  </footer>
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
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #1a1205;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(255, 153, 34, 0.4);
}
.funcs {
  display: flex;
  align-items: center;
  gap: 10px;
}
.f {
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
  background: rgba(255, 153, 34, 0.16);
  color: var(--accent);
  border-color: var(--accent);
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
  display: flex;
  align-items: center;
  gap: 10px;
  width: 320px;
  justify-content: flex-end;
}
.spk {
  font-size: 16px;
}
.vol {
  width: 120px;
  accent-color: var(--accent);
  cursor: pointer;
}
.vt {
  width: 28px;
  text-align: right;
  font-size: 12px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.total {
  font-size: 13px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
  width: 44px;
  text-align: right;
}
.prog {
  display: none;
}
</style>
