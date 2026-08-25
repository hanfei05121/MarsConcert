<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'
import type { Song } from '../../shared/types'
import SongRow from '../components/SongRow.vue'
import { onAdd, onPlay } from '../useQueueActions'

const state = store.state

const langs: ('全部' | '国语' | '英语' | '日语' | '韩语' | '其他')[] = ['全部', '国语', '英语', '日语', '韩语', '其他']

const categorySongs = computed<Song[]>(() => {
  if (state.categoryFilter === '全部') return state.allSongs
  return state.allSongs.filter((s) => {
    // 复用 store.detectLang 的判定（本地推断）
    const text = `${s.name}${s.artist}`
    const map: Record<string, boolean> = {
      国语: /[一-鿿]/.test(text),
      英语: /^[\x00-\x7F\s]+$/.test(text),
      日语: /[぀-ヿ]/.test(text),
      韩语: /[가-힣]/.test(text),
      其他: !/[一-鿿぀-ヿ가-힣]/.test(text) && !/^[\x00-\x7F\s]+$/.test(text)
    }
    return map[state.categoryFilter as string] ?? false
  })
})
</script>

<template>
  <div class="scroll">
    <div class="chips">
      <button
        v-for="l in langs"
        :key="l"
        class="chip"
        :class="{ on: state.categoryFilter === l }"
        @click="state.categoryFilter = l"
      >
        {{ l }}
      </button>
    </div>
    <div class="list">
      <SongRow
        v-for="s in categorySongs"
        :key="s.id"
        :song="s"
        :show-lang="true"
        :active="s.id === state.currentSong?.id"
        @add="onAdd"
        @play="onPlay"
      />
      <div v-if="categorySongs.length === 0" class="empty">该分类暂无歌曲</div>
    </div>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}
.chip {
  padding: 8px 18px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--bg-1);
  color: var(--text-1);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.chip.on {
  background: var(--accent);
  color: var(--on-accent);
  border-color: var(--accent);
}
</style>