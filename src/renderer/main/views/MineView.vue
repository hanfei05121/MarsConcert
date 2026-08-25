<script setup lang="ts">
import { store } from '../store'

const state = store.state
</script>

<template>
  <div class="scroll">
    <div class="mine">
      <div class="mrow">
        <span>本地歌曲</span><b>{{ state.allSongs.length }} 首</b>
      </div>
      <div class="mrow">
        <span>已点队列</span><b>{{ state.queue.length }} 首</b>
      </div>
      <div class="mrow">
        <span>我的收藏</span><b>{{ store.favSongs.value.length }} 首</b>
      </div>
      <div class="mrow">
        <span>最近播放</span><b>{{ state.history.length }} 首</b>
      </div>
      <button class="btn accent wide" @click="store.rescan()">
        {{ state.scanning ? '扫描中…' : '重新扫描素材库' }}
      </button>
      <p class="tip">本软件为纯本地离线点歌，素材来自本机 D:/song-lib，不上传任何数据。</p>
    </div>
  </div>
</template>

<style scoped>
.mine {
  max-width: 460px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mrow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  border-radius: 12px;
  background: var(--bg-1);
  border: 1px solid var(--line);
  color: var(--text-1);
  font-size: 15px;
  margin-bottom: 10px;
}
.mrow b {
  color: var(--accent);
  font-size: 16px;
}
.wide {
  margin-top: 8px;
  height: 44px;
  font-size: 15px;
}
.tip {
  margin-top: 14px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.6;
}
</style>