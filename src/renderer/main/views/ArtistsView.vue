<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeftOutlined } from '@ant-design/icons-vue'
import { store } from '../store'
import type { Song } from '../../shared/types'
import SongRow from '../components/SongRow.vue'
import { onAdd, onPlay } from '../useQueueActions'

const state = store.state

const artistSongs = computed<Song[]>(() =>
  state.artistFilter ? state.allSongs.filter((s) => (s.artist || '未知歌手') === state.artistFilter) : []
)
</script>

<template>
  <div class="scroll">
    <div v-if="!state.artistFilter" class="grid artists">
      <button
        v-for="a in store.artists.value"
        :key="a.name"
        class="card"
        @click="state.artistFilter = a.name"
      >
        <div class="ava">
          <img v-if="a.avatar" :src="a.avatar" :alt="a.name" />
          <template v-else>{{ a.name.slice(0, 1) }}</template>
        </div>
        <div class="an">{{ a.name }}</div>
        <div class="ac">{{ a.count }} 首</div>
      </button>
      <div v-if="store.artists.value.length === 0" class="empty">暂无歌手，先去扫描素材库</div>
    </div>
    <div v-else>
      <button class="back-link" @click="state.artistFilter = null"><ArrowLeftOutlined /> 返回歌手列表</button>
      <div class="list">
        <SongRow
          v-for="s in artistSongs"
          :key="s.id"
          :song="s"
          :active="s.id === state.currentSong?.id"
          @add="onAdd"
          @play="onPlay"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.artists {
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 10px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--bg-1);
  cursor: pointer;
  transition: all 0.15s ease;
}
.card:hover {
  border-color: var(--accent);
  transform: translateY(2px);
}
.ava {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: var(--on-accent);
  font-size: 28px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.ava img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.an {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-0);
}
.ac {
  font-size: 12px;
  color: var(--text-2);
}
</style>