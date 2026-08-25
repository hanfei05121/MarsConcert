<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { store } from '../store'
import type { Song } from '../../shared/types'
import SongRow from '../components/SongRow.vue'
import Pagination from '../components/Pagination.vue'
import { onAdd, onPlay } from '../useQueueActions'

const state = store.state

/** 歌曲列表每页条数（两列布局 = 每页 10 行） */
const PAGE_SIZE = 20

// 有搜索词时展示模糊查询结果，否则展示全部本地歌曲
const searchList = computed<Song[]>(() =>
  state.search.trim() ? state.songs : state.allSongs
)

const searchScroll = ref<HTMLElement | null>(null)
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(searchList.value.length / PAGE_SIZE)))
const pagedSongs = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return searchList.value.slice(start, start + PAGE_SIZE)
})
watch(searchList, () => {
  page.value = 1
})
function onPageChange(p: number) {
  page.value = p
  searchScroll.value?.scrollTo({ top: 0 })
}
</script>

<template>
  <div class="searchwrap">
    <div class="scroll" ref="searchScroll">
      <div class="searchhead">
        <h2 class="sh-title">
          {{ state.search.trim() ? `搜索 “${state.search}”` : '歌曲列表' }}
        </h2>
        <span class="sh-count">{{ searchList.length }} 首</span>
      </div>
      <div class="list grid2">
        <SongRow
          v-for="s in pagedSongs"
          :key="s.id"
          :song="s"
          :active="s.id === state.currentSong?.id"
          @add="onAdd"
          @play="onPlay"
        />
        <div v-if="searchList.length === 0" class="empty">
          {{
            state.search.trim()
              ? '没有找到匹配的歌曲，换个关键词试试'
              : '暂无歌曲，先去扫描素材库'
          }}
        </div>
      </div>
    </div>
    <!-- 有歌曲时始终显示分页条（仅 1 页时按钮禁用，方便知道有分页能力） -->
    <Pagination
      v-if="searchList.length > 0"
      :total="searchList.length"
      :page-size="PAGE_SIZE"
      :current="page"
      @change="onPageChange"
    />
  </div>
</template>

<style scoped>
/* 歌曲列表视图：上方内容滚动区 + 底部固定分页条（压在底部操作栏上方） */
.searchwrap {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.searchwrap > .scroll {
  position: static;
  flex: 1;
  min-height: 0;
}
/* —— 歌曲列表 / 搜索结果头 —— */
.searchhead {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}
.sh-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-0);
  margin: 0;
}
.sh-count {
  font-size: 13px;
  color: var(--text-2);
}
</style>