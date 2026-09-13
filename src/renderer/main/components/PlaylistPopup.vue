<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import type { Song } from '../../../shared/types'
import { store } from '../store'

const state = store.state
const emit = defineEmits<{ (e: 'close'): void }>()

const list = computed<Song[]>(() =>
  state.queueTab === 'queued' ? state.queue : state.history
)

function fmt(d: number): string {
  if (!d || d <= 0) return '--:--'
  const m = Math.floor(d / 60)
  const s = Math.floor(d % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function onRowClick(i: number) {
  if (state.queueTab === 'queued') await store.topQueue(i)
  else await store.addToQueue(list.value[i]) // 已唱：再点一次 = 重新点歌，加到已点末尾
}
async function onRemove(i: number) {
  if (state.queueTab === 'queued') await store.removeQueueAt(i)
}
function onPin(i: number) {
  if (state.queueTab === 'queued') store.pinToNext(i)
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="popup glass">
      <header class="phead">
        <div class="tabs">
          <button
            class="tab"
            :class="{ on: state.queueTab === 'queued' }"
            @click="store.setQueueTab('queued')"
          >
            已点 ({{ state.queue.length }})
          </button>
          <button
            class="tab"
            :class="{ on: state.queueTab === 'sung' }"
            @click="store.setQueueTab('sung')"
          >
            已唱 ({{ state.history.length }})
          </button>
        </div>
        <button class="x" title="关闭" @click="emit('close')"><CloseOutlined /></button>
      </header>

      <div class="plist">
        <div
          v-for="(song, i) in list"
          :key="song.id"
          class="prow"
          :class="{ active: song.id === state.currentSong?.id }"
          :title="state.queueTab === 'sung' ? '点击重新点歌' : ''"
          @click="onRowClick(i)"
          @dblclick="onRowClick(i)"
        >
          <span class="no">{{ String(i + 1).padStart(2, '0') }}</span>
          <div class="meta">
            <div class="name">
              {{ song.name }}
              <span v-if="song.artist" class="tag">原版</span>
            </div>
            <div class="artist">{{ song.artist || '未知歌手' }}</div>
          </div>
          <span class="dur">{{ fmt(song.duration) }}</span>
          <span v-if="state.queueTab === 'sung'" class="req">+ 重唱</span>
          <button
            v-if="state.queueTab === 'queued' && song.id !== state.currentSong?.id"
            class="pin"
            title="置顶：下一首就唱它"
            @click.stop="onPin(i)"
          >
            <ArrowUpOutlined />
          </button>
          <button
            v-if="state.queueTab === 'queued'"
            class="del"
            title="删除"
            @click.stop="onRemove(i)"
          >
            <DeleteOutlined />
          </button>
        </div>
        <div v-if="list.length === 0" class="empty">
          {{ state.queueTab === 'queued' ? '还没有点歌，去首页或搜索挑一首吧～' : '还没有唱过的歌' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 56px 0 84px 184px; /* 避开顶栏/底栏/侧栏 */
  /* 只压暗、不模糊：模糊交给 .popup，否则父层成为 backdrop root，面板就糊不到背后画面 */
  background: rgba(8, 6, 8, 0.42);
  display: flex;
  justify-content: flex-end;
  z-index: 50;
}
.popup {
  width: 380px;
  max-width: 80%;
  margin: 16px;
  background: var(--glass-sheen), var(--popup-bg);
  border: 1px solid var(--line);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--glass-edge), var(--shadow-pop);
}
.phead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}
.tabs {
  display: flex;
  gap: 8px;
}
.tab {
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 15px;
  font-weight: 700;
  padding: 6px 4px;
  cursor: pointer;
}
.tab.on {
  color: var(--accent);
  border-bottom: 2px solid var(--accent);
}
.x {
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 16px;
  cursor: pointer;
}
.x:hover {
  color: var(--text-0);
}
.plist {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  /* 行间留缝，每行的玻璃底才分得开（与 .list 一致） */
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.prow {
  /* 外观（默认玻璃底 / 悬停 / 选中）见全局 style.css「列表行统一外观」，这里只留布局 */
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 12px;
  cursor: pointer;
}
.no {
  width: 24px;
  text-align: center;
  color: var(--accent-2);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.meta {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tag {
  font-size: 10px;
  color: var(--accent);
  border: 1px solid var(--accent-line);
  border-radius: 3px;
  padding: 0 4px;
  margin-left: 4px;
}
.artist {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 2px;
}
.dur {
  font-size: 12px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.req {
  font-size: 11px;
  color: var(--accent);
  border: 1px solid var(--accent-line);
  border-radius: 999px;
  padding: 1px 8px;
  flex-shrink: 0;
}
.pin {
  border: none;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  opacity: 0.6;
}
.pin:hover {
  opacity: 1;
  color: var(--accent);
}
.del {
  border: none;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  opacity: 0.6;
}
.del:hover {
  opacity: 1;
}
.empty {
  text-align: center;
  color: var(--text-2);
  padding: 40px 10px;
  font-size: 13px;
}
</style>
