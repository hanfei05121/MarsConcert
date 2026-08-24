<script setup lang="ts">
import { StepBackwardOutlined, StepForwardOutlined, RedoOutlined } from '@ant-design/icons-vue'
import { mobile, api } from '../remote'

defineEmits<{ (e: 'close'): void }>()

function control(name: 'togglePlay' | 'prev' | 'next' | 'reSing' | 'toggleMode') {
  api.control(name)
  if (name === 'toggleMode') mobile.mode = mobile.mode === 'orig' ? 'accomp' : 'orig'
}

function onVol(key: 'master' | 'mic', val: number) {
  mobile.volumes[key] = val / 100
  api.volume({ [key]: val / 100 })
}
</script>

<template>
  <div class="backdrop" @click="$emit('close')">
    <div class="sheet" @click.stop>
      <div class="grab" />

      <div class="title">播放控制</div>

      <!-- 主控四键 -->
      <div class="ctrl-row">
        <button class="cbtn" @click="control('prev')">
          <span class="cico"><StepBackwardOutlined /></span><span class="clb">上一首</span>
        </button>
        <button class="big" :class="{ playing: mobile.playing }" @click="control('togglePlay')">
          <svg v-if="mobile.playing" viewBox="0 0 24 24" width="30" height="30"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>
          <svg v-else viewBox="0 0 24 24" width="30" height="30"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
        </button>
        <button class="cbtn" @click="control('next')">
          <span class="cico"><StepForwardOutlined /></span><span class="clb">下一首</span>
        </button>
      </div>

      <div class="func-row">
        <button class="fbtn" @click="control('reSing')"><RedoOutlined /> 重唱</button>
        <button class="fbtn" :class="{ on: mobile.mode === 'orig' }" @click="control('toggleMode')">
          原唱
        </button>
        <button class="fbtn" :class="{ on: mobile.mode === 'accomp' }" @click="control('toggleMode')">
          伴奏
        </button>
      </div>

      <div class="vol">
        <div class="vrow">
          <span class="vlb">总音量 {{ Math.round(mobile.volumes.master * 100) }}</span>
          <input type="range" min="0" max="100" :value="Math.round(mobile.volumes.master * 100)" @input="onVol('master', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <div class="vrow">
          <span class="vlb">麦克风 {{ Math.round(mobile.volumes.mic * 100) }}</span>
          <input type="range" min="0" max="100" :value="Math.round(mobile.volumes.mic * 100)" @input="onVol('mic', Number(($event.target as HTMLInputElement).value))" />
        </div>
      </div>

      <div class="meta">
        正在播放：<b>{{ mobile.currentSong?.name || '等待点歌…' }}</b>
        <span v-if="mobile.currentSong" class="meta-art">{{ mobile.currentSong.artist }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  background: linear-gradient(160deg, var(--bg-1), var(--bg-0));
  border-radius: 20px 20px 0 0;
  padding: 10px 18px calc(22px + env(safe-area-inset-bottom));
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.5);
}
.grab {
  width: 40px;
  height: 4px;
  border-radius: 4px;
  background: var(--line);
  margin: 2px auto 10px;
}
.title {
  font-size: 16px;
  font-weight: 800;
  margin-bottom: 14px;
}
.ctrl-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin: 6px 0 14px;
}
.cbtn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--text-1);
}
.cico {
  font-size: 26px;
  line-height: 1;
}
.clb {
  font-size: 12px;
  color: var(--text-2);
}
.big {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: var(--on-accent);
  box-shadow: 0 6px 18px rgba(255, 77, 46, 0.5);
}
.big.playing {
  box-shadow: 0 0 0 6px rgba(255, 77, 46, 0.2);
}
.func-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.fbtn {
  flex: 1;
  height: 40px;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: var(--bg-2);
  color: var(--text-1);
  font-size: 13px;
  font-weight: 600;
}
.fbtn.on {
  background: var(--accent);
  color: var(--on-accent);
  border-color: var(--accent);
}
.vol {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.vrow {
  display: flex;
  align-items: center;
  gap: 10px;
}
.vlb {
  width: 78px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-2);
}
.vrow input[type='range'] {
  flex: 1;
  accent-color: var(--accent);
  height: 26px;
}
.meta {
  margin-top: 16px;
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta-art {
  margin-left: 4px;
  color: var(--text-2);
}
</style>