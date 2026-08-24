<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeftOutlined, HeartOutlined, ClockCircleOutlined, ProfileOutlined, QrcodeOutlined } from '@ant-design/icons-vue'
import { store } from './store'
import type { Song } from '../../shared/types'
import Sidebar from './components/Sidebar.vue'
import TopBar from './components/TopBar.vue'
import ChartBlock from './components/ChartBlock.vue'
import SongRow from './components/SongRow.vue'
import Pagination from './components/Pagination.vue'
import PlaylistPopup from './components/PlaylistPopup.vue'
import BottomBar from './components/BottomBar.vue'
import RemoteQrPopup from './components/RemoteQrPopup.vue'
import coalBall from '../assets/coal-ball.jpg'

/** 「手机遥控」二维码弹窗开关 */
const remoteOpen = ref(false)

/** 歌曲列表每页条数（两列布局 = 每页 10 行） */
const PAGE_SIZE = 20

const state = store.state
onMounted(() => store.init())

// —— 首页榜单（本地库派生，无播放量数据，用入库顺序近似）——
const rising = computed(() => state.allSongs.slice(0, 8)) // 飙升榜：取前面批次
const fresh = computed(() => [...state.allSongs].slice(-8).reverse()) // 新歌榜：最新入库在前

// —— 点歌飞入「已点」动画：从点击的歌曲行/＋按钮飞一个亮点到已点按钮 ——
const QUEUE_FAB_ID = 'queue-fab'
function flyToQueue(song: Song, ev: MouseEvent) {
  store.addToQueue(song)
  const src = ev.currentTarget as HTMLElement | null
  const btn = document.getElementById(QUEUE_FAB_ID)
  if (!src || !btn) return
  const s = src.getBoundingClientRect()
  const t = btn.getBoundingClientRect()
  const x0 = s.left + s.width / 2
  const y0 = s.top + s.height / 2
  const x1 = t.left + t.width / 2
  const y1 = t.top + t.height / 2
  const dot = document.createElement('div')
  dot.className = 'fly-dot'
  dot.style.left = `${x0}px`
  dot.style.top = `${y0}px`
  document.body.appendChild(dot)
  const anim = dot.animate(
    [
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(${x1 - x0}px - 50%), calc(${y1 - y0}px - 50%)) scale(0.35)`, opacity: 0.85 }
    ],
    { duration: 620, easing: 'cubic-bezier(.45,.05,.3,1)' }
  )
  anim.onfinish = () => {
    dot.remove()
    // 亮点落位后让已点按钮弹一下，呼应数字 +1
    btn.classList.remove('bump')
    void btn.offsetWidth // 强制重绘以重启动画
    btn.classList.add('bump')
    window.setTimeout(() => btn.classList.remove('bump'), 420)
  }
}

function onAdd(song: Song, ev: MouseEvent) {
  flyToQueue(song, ev)
}
function onPlay(song: Song, ev: MouseEvent) {
  flyToQueue(song, ev)
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

// —— 歌曲列表 / 搜索结果视图 ——
// 有搜索词时展示模糊查询结果，否则展示全部本地歌曲
const searchList = computed<Song[]>(() =>
  state.search.trim() ? state.songs : state.allSongs
)

// 分页：切页后回到列表顶部；列表内容变化时重置回第 1 页
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
          <!-- 火星人专属 Hero -->
          <div class="mars-hero">
            <img class="hero-mascot" :src="coalBall" alt="黑煤球" />
            <div class="hero-text">
              <div class="hero-kicker">MARS EDITION · 火星人专属点歌台</div>
              <h1 class="hero-title">火星人，欢迎回家 🔥</h1>
              <p class="hero-sub">黑煤球已就位。点一首歌，把整座火星唱成你的主场。</p>
            </div>
          </div>

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

        <!-- 歌曲列表 / 搜索结果：内容滚动区 + 底部固定分页条 -->
        <div v-else-if="state.view === 'search'" class="searchwrap">
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

      <!-- 轻提示 -->
      <Transition name="toast">
        <div v-if="state.toast" :key="state.toast.key" class="toast">{{ state.toast.text }}</div>
      </Transition>

      <BottomBar />
    </div>

    <!-- 手机遥控：扫码进入手机端（右上角悬浮按钮 + 弹窗） -->
    <button class="remote-fab" title="手机遥控 · 扫码" @click="remoteOpen = true">
      <QrcodeOutlined />
    </button>
    <RemoteQrPopup v-if="remoteOpen" @close="remoteOpen = false" />
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
/* —— 手机遥控悬浮按钮 —— */
.remote-fab {
  position: fixed;
  top: 70px;
  right: 14px;
  z-index: 90;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1px solid var(--accent-line);
  background: linear-gradient(135deg, var(--bg-2), var(--bg-1));
  color: var(--accent);
  font-size: 22px;
  cursor: pointer;
  box-shadow: var(--shadow-glow);
}
.remote-fab:hover {
  background: var(--accent-soft);
  transform: translateY(-2px) scale(1.05);
}
.scroll {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  padding: 18px;
}
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
.charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-top: 18px;
}
/* —— 火星人 Hero —— */
.mars-hero {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 22px 24px;
  margin-bottom: 4px;
  border-radius: 18px;
  background:
    radial-gradient(560px 200px at 0% 0%, rgba(255, 77, 46, 0.18), transparent 60%),
    linear-gradient(120deg, var(--bg-2), var(--bg-1));
  border: 1px solid var(--line);
  box-shadow: var(--shadow-glow);
}
.hero-mascot {
  width: 92px;
  height: 92px;
  flex-shrink: 0;
  border-radius: 50%;
  filter: drop-shadow(0 6px 18px rgba(255, 77, 46, 0.4));
}
.hero-kicker {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--accent-2);
  text-transform: uppercase;
}
.hero-title {
  margin: 6px 0 4px;
  font-size: 26px;
  font-weight: 800;
  color: var(--text-0);
}
.hero-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
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
.list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
/* 歌曲列表两列布局 */
.list.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
  align-items: start;
}
.list.grid2 :deep(.row) {
  min-width: 0;
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--line);
  background: var(--bg-2);
  color: var(--text-1);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 14px;
  padding: 8px 16px 8px 13px;
  border-radius: 999px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  transition: all 0.2s ease;
}
.back-link:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text-0);
  box-shadow: 0 4px 16px var(--accent-soft);
}
.back-link:active {
  transform: scale(0.96);
}
/* 悬停时箭头向左轻移，强化「返回」语义 */
.back-link :deep(.anticon) {
  font-size: 14px;
  transition: transform 0.2s ease;
}
.back-link:hover :deep(.anticon) {
  transform: translateX(-3px);
}
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
/* —— 轻提示 —— */
.toast {
  position: fixed;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  padding: 10px 22px;
  border-radius: 999px;
  background: rgba(20, 24, 38, 0.92);
  border: 1px solid var(--accent);
  color: var(--text-0);
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  white-space: nowrap;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
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

<!-- 飞入「已点」的亮点：动态插入 body，scoped 样式不生效，故用全局块 -->
<style>
.fly-dot {
  position: fixed;
  z-index: 9999;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ffffff 0%, var(--accent) 70%);
  box-shadow: 0 0 14px 5px var(--accent);
  pointer-events: none;
  will-change: transform, opacity;
}
</style>
