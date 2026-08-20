<script setup lang="ts">
import type { Song } from '../../../shared/types'

defineProps<{
  songs: Song[]
  currentId: number | null
}>()

const emit = defineEmits<{
  (e: 'select', song: Song): void
}>()

function fmt(d: number): string {
  if (!d || d <= 0) return '--:--'
  const m = Math.floor(d / 60)
  const s = Math.floor(d % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <div class="songlist">
    <div
      v-for="song in songs"
      :key="song.id"
      class="song"
      :class="{ active: song.id === currentId }"
      @click="emit('select', song)"
    >
      <div class="meta">
        <div class="name">{{ song.name }}</div>
        <div class="artist">{{ song.artist || '未知歌手' }}</div>
      </div>
      <div class="right">
        <span v-if="song.id === currentId" class="playing-tag">播放中</span>
        <span class="dur">{{ fmt(song.duration) }}</span>
      </div>
    </div>
    <div v-if="songs.length === 0" class="empty">没有匹配的歌曲，点右上角「重新扫描」试试</div>
  </div>
</template>

<style scoped>
.songlist {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.song {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}
.song:hover {
  background: var(--bg-3);
}
.song.active {
  background: linear-gradient(92deg, rgba(255, 61, 139, 0.18), rgba(124, 92, 255, 0.18));
  border-color: rgba(255, 61, 139, 0.5);
}
.meta .name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-0);
}
.meta .artist {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 2px;
}
.right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dur {
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
  font-size: 13px;
}
.playing-tag {
  font-size: 11px;
  color: var(--neon);
  border: 1px solid var(--neon);
  border-radius: 999px;
  padding: 1px 8px;
}
.empty {
  text-align: center;
  color: var(--text-2);
  padding: 40px 10px;
  font-size: 13px;
}
</style>
