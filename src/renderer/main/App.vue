<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { store } from './store'
import type { Song } from '../../shared/types'
import Sidebar from './components/Sidebar.vue'
import TopBar from './components/TopBar.vue'
import Banner from './components/Banner.vue'
import ChartBlock from './components/ChartBlock.vue'
import SongRow from './components/SongRow.vue'
import PlaylistPopup from './components/PlaylistPopup.vue'
import BottomBar from './components/BottomBar.vue'

const state = store.state
onMounted(() => store.init())

// —— 首页榜单（本地库派生，无播放量数据，用入库顺序近似）——
const rising = computed(() => state.allSongs.slice(0, 8)) // 飙升榜：取前面批次
const fresh = computed(() => [...state.allSongs].slice(-8).reverse()) // 新歌榜：最新入库在前

function onAdd(song: Song) {
  store.addToQueue(song)
}
function onPlay(song: Song) {
  store.addToQueue(song)
  const i = state.queue.findIndex((s) => s.id === song.id)
  if (i >= 0) store.topQueue(i)
}

// —— 歌星视图 ——
const artistSongs = computed<Song[]>(() =>
  state.artistFilter ? state.allSongs.filter((s) => (s.artist || '未知歌手') === state.artistFilter) : []
)

// —— 分类视图 ——
const langs: ('全部' | '国语' | '英语' | '日语' | '韩语' | '其他')[] = ['全部', '国语', '英语', '日语', '韩语', '其他']
const categorySongs = computed<Song[]>(() =>
  state.categoryFilter === '全部'
    ? state.allSongs
    : state.allSongs.filter((s) => {
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
)

// —— 歌单 / 我的 视图 ——
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
  <div class="app">
    <Sidebar :view="state.view" @nav="store.navigate" />

    <div class="main">
      <TopBar @back="store.back" @search="store.doSearch" />

      <main class="content">
        <!-- 推荐首页 -->
        <div v-if="state.view === 'recommend'" class="scroll">
          <Banner />
          <div class="charts">
            <ChartBlock title="飙升榜" badge="日榜" :songs="rising" @add="onAdd" @play="onPlay" />
            <ChartBlock title="新歌排行榜" badge="日榜" :songs="fresh" @add="onAdd" @play="onPlay" />
          </div>
        </div>

        <!-- 歌星 -->
        <div v-else-if="state.view === 'artists'" class="scroll">
          <div v-if="!state.artistFilter" class="grid artists">
            <button
              v-for="a in store.artists.value"
              :key="a.name"
              class="card"
              @click="state.artistFilter = a.name"
            >
              <div class="ava">{{ a.name.slice(0, 1) }}</div>
              <div class="an">{{ a.name }}</div>
              <div class="ac">{{ a.count }} 首</div>
            </button>
            <div v-if="store.artists.value.length === 0" class="empty">暂无歌手，先去扫描素材库</div>
          </div>
          <div v-else>
            <button class="back-link" @click="state.artistFilter = null">‹ 返回歌手列表</button>
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

        <!-- 分类 -->
        <div v-else-if="state.view === 'category'" class="scroll">
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

        <!-- 歌单 -->
        <div v-else-if="state.view === 'playlists'" class="scroll">
          <div v-if="!state.selectedPlaylist" class="grid pls">
            <button class="plcard fav" @click="openPlaylist('__fav__')">
              <div class="pic">❤️</div>
              <div class="pn">我的收藏</div>
              <div class="pc">{{ store.favSongs.value.length }} 首</div>
            </button>
            <button class="plcard" @click="openPlaylist('__history__')">
              <div class="pic">🕒</div>
              <div class="pn">最近播放</div>
              <div class="pc">{{ state.history.length }} 首</div>
            </button>
            <button
              v-for="p in state.playlists"
              :key="p.name"
              class="plcard"
              @click="openPlaylist(p.name)"
            >
              <div class="pic">📃</div>
              <div class="pn">{{ p.name }}</div>
              <div class="pc">{{ p.songs.length }} 首</div>
            </button>
            <div v-if="state.playlists.length === 0" class="empty">
              还没有保存的歌单，在「已点」弹窗里点「保存歌单」即可创建
            </div>
          </div>
          <div v-else>
            <div class="plhead">
              <button class="back-link" @click="backToPlaylistList">‹ 返回歌单</button>
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

        <!-- 我的 -->
        <div v-else-if="state.view === 'mine'" class="scroll">
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
      </main>

      <!-- 已点悬浮弹窗 -->
      <PlaylistPopup v-if="state.queueOpen" @close="store.toggleQueueOpen()" />

      <BottomBar />
    </div>
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: flex;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.content {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 0;
}
.scroll {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  padding: 18px;
}
.charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-top: 18px;
}
.grid {
  display: grid;
  gap: 14px;
}
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
  transform: translateY(-2px);
}
.ava {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #1a1205;
  font-size: 28px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
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
  color: #1a1205;
  border-color: var(--accent);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.back-link {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 12px;
  padding: 4px 0;
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
  transform: translateY(-2px);
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
.empty {
  text-align: center;
  color: var(--text-2);
  padding: 40px 10px;
  font-size: 13px;
  grid-column: 1 / -1;
}
</style>
