<script setup lang="ts">
import type { Song } from '../../../shared/types'
import SongRow from './SongRow.vue'

const props = defineProps<{
  title: string
  badge?: string // 如 "日榜"
  songs: Song[]
}>()

const emit = defineEmits<{
  (e: 'add', song: Song, ev: MouseEvent): void
  (e: 'play', song: Song, ev: MouseEvent): void
}>()
</script>

<template>
  <section class="chart glass">
    <header class="head">
      <div class="title">
        {{ title }}
        <span v-if="badge" class="badge">{{ badge }}</span>
      </div>
      <span class="more">更多 ›</span>
    </header>
    <div class="list">
      <SongRow
        v-for="(song, i) in songs"
        :key="song.id"
        :song="song"
        :rank="i + 1"
        :show-lang="true"
      @add="(s, e) => emit('add', s, e)"
      @play="(s, e) => emit('play', s, e)"
      />
      <div v-if="songs.length === 0" class="empty">暂无歌曲，点右上角「重新扫描」导入素材</div>
    </div>
  </section>
</template>

<style scoped>
.chart {
  padding: 14px 8px 8px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 10px;
  border-bottom: 1px solid var(--line);
}
.title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-0);
  display: flex;
  align-items: center;
  gap: 8px;
}
.badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--on-accent);
  background: var(--accent);
  border-radius: 4px;
  padding: 1px 6px;
}
.more {
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
}
.more:hover {
  color: var(--accent);
}
.list {
  margin-top: 6px;
  max-height: 320px;
  overflow-y: auto;
}
.empty {
  text-align: center;
  color: var(--text-2);
  padding: 30px 10px;
  font-size: 13px;
}
</style>
