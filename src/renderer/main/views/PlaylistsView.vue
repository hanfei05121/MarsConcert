<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeftOutlined, HeartOutlined, ClockCircleOutlined, ProfileOutlined } from '@ant-design/icons-vue'
import { store } from '../store'
import SongRow from '../components/SongRow.vue'
import { onAdd, onPlay } from '../useQueueActions'

const state = store.state

function openPlaylist(key: string) {
  state.selectedPlaylist = key
}
function backToPlaylistList() {
  state.selectedPlaylist = null
}
const playlistTitle = computed(() => {
  if (state.selectedPlaylist === '__fav__') return '我的收藏'
  if (state.selectedPlaylist === '__history__') return '最近播放'
  return state.selectedPlaylist || '歌单'
})
</script>

<template>
  <div class="scroll">
    <div v-if="!state.selectedPlaylist" class="grid pls">
      <button class="plcard fav" @click="openPlaylist('__fav__')">
        <div class="pic"><HeartOutlined /></div>
        <div class="pn">我的收藏</div>
        <div class="pc">{{ store.favSongs.value.length }} 首</div>
      </button>
      <button class="plcard" @click="openPlaylist('__history__')">
        <div class="pic"><ClockCircleOutlined /></div>
        <div class="pn">最近播放</div>
        <div class="pc">{{ state.history.length }} 首</div>
      </button>
      <button
        v-for="p in state.playlists"
        :key="p.name"
        class="plcard"
        @click="openPlaylist(p.name)"
      >
        <div class="pic"><ProfileOutlined /></div>
        <div class="pn">{{ p.name }}</div>
        <div class="pc">{{ p.songs.length }} 首</div>
      </button>
      <div v-if="state.playlists.length === 0" class="empty">
        还没有保存的歌单，在「已点」弹窗里点「保存歌单」即可创建
      </div>
    </div>
    <div v-else>
      <div class="plhead">
        <button class="back-link" @click="backToPlaylistList"><ArrowLeftOutlined /> 返回歌单</button>
        <span class="ptitle">{{ playlistTitle }}</span>
        <button
          v-if="state.selectedPlaylist && !state.selectedPlaylist.startsWith('__')"
          class="delpl"
          @click="store.deletePlaylist(state.selectedPlaylist)"
        >
          删除歌单
        </button>
      </div>
      <div class="list">
        <SongRow
          v-for="s in store.playlistDetail.value"
          :key="s.id"
          :song="s"
          :active="s.id === state.currentSong?.id"
          @add="onAdd"
          @play="onPlay"
        />
        <div v-if="store.playlistDetail.value.length === 0" class="empty">这个歌单还是空的</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 歌单页：返回键与标题在同一行，去掉多余下边距 */
.plhead .back-link {
  margin-bottom: 0;
}
.pls {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}
.plcard {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--bg-1);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}
.plcard:hover {
  border-color: var(--accent);
  transform: translateY(2px);
}
.pic {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: var(--bg-3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
}
.plcard.fav .pic {
  background: rgba(255, 77, 79, 0.18);
}
.pn {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-0);
}
.pc {
  font-size: 12px;
  color: var(--text-2);
}
.plhead {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}
.ptitle {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-0);
}
.delpl {
  margin-left: auto;
  border: 1px solid var(--danger);
  background: transparent;
  color: var(--danger);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}
</style>