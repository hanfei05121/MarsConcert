<script setup lang="ts">
import { ref, computed } from 'vue'
import { ArrowUpOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { mobile, api } from '../remote'

defineEmits<{ (e: 'close'): void }>()

const tab = ref<'queued' | 'sung'>('queued')
const list = computed(() => (tab.value === 'queued' ? mobile.queue : mobile.history))

/** 点击已点行 = 置顶并立即播放（和桌面端一致） */
async function onRowTap(s: { id: number }, index: number) {
  if (tab.value === 'queued') {
    await api.queueAction('top', index)
  } else {
    // 已唱：点击重新点歌，加到队尾（同桌面端 addToQueue）
    await api.play(s.id)
  }
}
/** 置顶到下一首：当前播完就唱它，不打断当前 */
async function pinNext(index: number) {
  await api.queueAction('pin', index)
}
async function removeQueue(index: number) {
  await api.queueAction('remove', index)
}

function fmtSec(d?: number): string {
  if (!d || d <= 0) return '--:--'
  const m = Math.floor(d / 60)
  const s = Math.floor(d % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <div class="backdrop" @click="$emit('close')">
    <div class="sheet" @click.stop>
      <div class="grab" />

      <div class="tabs">
        <button class="tab" :class="{ on: tab === 'queued' }" @click="tab = 'queued'">
          已点 ({{ mobile.queue.length }})
        </button>
        <button class="tab" :class="{ on: tab === 'sung' }" @click="tab = 'sung'">
          已唱 ({{ mobile.history.length }})
        </button>
      </div>

      <div class="list">
        <div v-if="list.length === 0" class="empty">
          {{ tab === 'queued' ? '还没有已点歌曲，去首页搜索点歌吧' : '还没有唱过的歌' }}
        </div>
        <div v-for="(s, i) in list" :key="s.id" class="qrow" :class="{ active: mobile.currentSong && mobile.currentSong.id === s.id }" @click="onRowTap(s, i)">
          <span class="qidx">{{ String(i + 1).padStart(2, '0') }}</span>
          <div class="qinfo">
            <div class="qname">
              {{ s.name }}
              <span v-if="tab === 'sung'" class="req">+ 重唱</span>
            </div>
            <div class="qart">{{ s.artist || '未知歌手' }}</div>
          </div>
          <span class="qdur">{{ fmtSec(s.duration) }}</span>
          <span v-if="tab === 'queued' && mobile.currentSong && mobile.currentSong.id === s.id" class="qplaying">播放中</span>
          <button
            v-if="tab === 'queued' && !(mobile.currentSong && mobile.currentSong.id === s.id)"
            class="qop pin"
            title="置顶到下一首"
            @click.stop="pinNext(i)"
          >
            <ArrowUpOutlined />
          </button>
          <button v-if="tab === 'queued'" class="qop del" title="删除" @click.stop="removeQueue(i)">
            <DeleteOutlined />
          </button>
        </div>
      </div>
      <div v-if="tab === 'queued'" class="hint">点击歌曲 = 置顶播放；⏫ = 置顶到下一首</div>
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
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, var(--bg-1), var(--bg-0));
  border-radius: 20px 20px 0 0;
  padding: 10px 18px calc(14px + env(safe-area-inset-bottom));
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.5);
}
.grab {
  width: 40px;
  height: 4px;
  border-radius: 4px;
  background: var(--line);
  margin: 2px auto 8px;
}
.tabs {
  display: flex;
  gap: 16px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 6px;
}
.tab {
  background: transparent;
  color: var(--text-2);
  font-size: 15px;
  font-weight: 700;
  padding: 8px 2px;
}
.tab.on {
  color: var(--accent);
  border-bottom: 2px solid var(--accent);
}
.list {
  flex: 1;
  overflow-y: auto;
}
.qrow {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 4px;
  border-bottom: 1px solid rgba(65, 48, 38, 0.5);
  border-radius: 10px;
}
.qrow.active {
  background: var(--accent-soft);
}
.qidx {
  width: 26px;
  flex-shrink: 0;
  text-align: center;
  color: var(--accent);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.qinfo {
  flex: 1;
  min-width: 0;
}
.qname {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.qart {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 1px;
}
.req {
  margin-left: 5px;
  font-size: 10px;
  color: var(--accent);
  border: 1px solid var(--accent-line, rgba(255, 95, 55, 0.4));
  border-radius: 999px;
  padding: 0 6px;
}
.qdur {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.qplaying {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--accent-2);
}
.qop {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  font-size: 15px;
  background: var(--bg-2);
}
.qop.pin {
  color: var(--text-1);
}
.qop.del {
  color: var(--danger);
}
.empty {
  text-align: center;
  color: var(--text-2);
  padding: 40px 10px;
  font-size: 14px;
  line-height: 1.8;
}
.hint {
  padding-top: 8px;
  font-size: 11px;
  color: var(--text-2);
  border-top: 1px solid rgba(65, 48, 38, 0.4);
}
</style>