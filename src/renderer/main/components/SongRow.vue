<script setup lang="ts">
import type { Song } from '../../../shared/types'
import { detectLang } from '../store'

const props = defineProps<{
  song: Song
  rank?: number // 榜单序号（1 起）
  active?: boolean
  showLang?: boolean
}>()

const emit = defineEmits<{
  (e: 'add', song: Song): void
  (e: 'play', song: Song): void
}>()

function fmt(d: number): string {
  if (!d || d <= 0) return '--:--'
  const m = Math.floor(d / 60)
  const s = Math.floor(d % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <div
    class="row"
    :class="{ active }"
    @click="emit('add', song)"
    @dblclick="emit('play', song)"
  >
    <div class="rank" :class="{ top: rank && rank <= 3 }">
      {{ rank != null ? String(rank).padStart(2, '0') : '' }}
    </div>
    <div class="meta">
      <div class="name">{{ song.name }}</div>
      <div class="sub">
        <span class="artist">{{ song.artist || '未知歌手' }}</span>
        <span v-if="showLang" class="lang">{{ detectLang(song) }}</span>
      </div>
    </div>
    <div class="dur">{{ fmt(song.duration) }}</div>
    <button class="add" title="加入已点" @click.stop="emit('add', song)">＋</button>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.row:hover {
  background: var(--bg-3);
}
.row.active {
  background: rgba(169, 173, 184, 0.14);
  box-shadow: inset 3px 0 0 var(--accent);
}
.rank {
  width: 30px;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
}
.rank.top {
  color: var(--accent);
}
.meta {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
}
.artist {
  font-size: 12px;
  color: var(--text-2);
}
.lang {
  font-size: 11px;
  color: var(--accent);
  border: 1px solid rgba(169, 173, 184, 0.5);
  border-radius: 4px;
  padding: 0 5px;
}
.dur {
  font-size: 13px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.add {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #232631;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.1s ease;
}
.add:hover {
  transform: scale(1.12);
}
</style>
