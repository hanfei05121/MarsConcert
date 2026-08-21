import { reactive, computed } from 'vue'
import type { AppConfig, Song, VideoMode, Volumes } from '../../shared/types'

export type ViewName = 'recommend' | 'artists' | 'category' | 'playlists' | 'mine' | 'search'
export type QueueTab = 'queued' | 'sung'
export type PlayMode = 'order' | 'random'
export type Lang = '国语' | '英语' | '日语' | '韩语' | '其他'

const FAV_KEY = 'ktv-favs'
const PL_KEY = 'ktv-playlists'

export interface SavedPlaylist {
  name: string
  songs: Song[]
  createdAt: string
}

interface State {
  allSongs: Song[]
  songs: Song[] // 搜索结果
  search: string
  config: AppConfig | null
  currentSong: Song | null
  mode: VideoMode
  playing: boolean
  currentTime: number
  duration: number
  volumes: Volumes
  scanning: boolean
  // —— 新增：播放队列 / 历史 / 收藏 / 模式 / 弹窗 / 视图 ——
  queue: Song[] // 已点
  history: Song[] // 已唱
  favs: number[] // 收藏歌曲 id
  playlists: SavedPlaylist[]
  playMode: PlayMode
  queueOpen: boolean
  queueTab: QueueTab
  view: ViewName
  viewHistory: ViewName[]
  artistFilter: string | null
  categoryFilter: Lang | '全部'
  selectedPlaylist: string | null // 歌单详情标识：歌单名 | '__fav__' | '__history__'
}

function loadFavs(): number[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || '[]')
  } catch {
    return []
  }
}
function saveFavs(ids: number[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(ids))
}
function loadPlaylists(): SavedPlaylist[] {
  try {
    return JSON.parse(localStorage.getItem(PL_KEY) || '[]')
  } catch {
    return []
  }
}
function savePlaylists(list: SavedPlaylist[]) {
  localStorage.setItem(PL_KEY, JSON.stringify(list))
}

/** 本地素材无语种标注，按字符范围做最佳推断（粤语/闽南语无法区分，归入国语） */
export function detectLang(s: Song): Lang {
  const text = `${s.name}${s.artist}`
  if (/[가-힣]/.test(text)) return '韩语'
  if (/[぀-ヿ]/.test(text)) return '日语'
  if (/^[\x00-\x7F\s]+$/.test(text)) return '英语'
  if (/[一-鿿]/.test(text)) return '国语'
  return '其他'
}

export const state = reactive<State>({
  allSongs: [],
  songs: [],
  search: '',
  config: null,
  currentSong: null,
  mode: 'orig',
  playing: false,
  currentTime: 0,
  duration: 0,
  volumes: { orig: 1, accomp: 1, master: 1, mic: 1 },
  scanning: false,
  queue: [],
  history: [],
  favs: loadFavs(),
  playlists: loadPlaylists(),
  playMode: 'order',
  queueOpen: false,
  queueTab: 'queued',
  view: 'recommend',
  viewHistory: [],
  artistFilter: null,
  categoryFilter: '全部',
  selectedPlaylist: null
})

async function init() {
  const cfg = await window.api.getConfig()
  state.config = cfg
  state.mode = cfg.videoMode
  state.volumes = cfg.volumes
  await loadAll()
  await refresh()
}

async function loadAll() {
  state.allSongs = await window.api.getSongs()
}

async function refresh() {
  state.songs = await window.api.getSongs(state.search)
}

/** 顶部搜索：模糊查询本地曲库，并跳转到歌曲列表页展示结果 */
async function doSearch(q: string) {
  state.search = q
  state.songs = await window.api.getSongs(q)
  // 无论在哪个页面，搜索都切到「歌曲」列表页；清空其他筛选态避免干扰
  state.artistFilter = null
  state.categoryFilter = '全部'
  state.selectedPlaylist = null
  state.view = 'search'
}

function currentQueueIndex(): number {
  if (!state.currentSong) return -1
  return state.queue.findIndex((s) => s.id === state.currentSong!.id)
}

async function ensurePlay(song: Song) {
  state.currentSong = song
  state.currentTime = 0
  state.duration = song.duration || 0
  // Vue reactive 会给对象包一层 Proxy，IPC 无法克隆，需转成纯数据
  await window.api.playSong({ ...song })
  state.playing = true
}

/** 点击歌曲：加入已点队列；若无正在播放则立即播放 */
async function addToQueue(song: Song) {
  state.queue.push(song)
  if (!state.currentSong) await ensurePlay(song)
}

/** 切到队列中第 i 首并播放（不 reorder） */
async function playQueueAt(i: number) {
  const song = state.queue[i]
  if (song) await ensurePlay(song)
}

/** 置顶并切歌（双击已点列表） */
async function topQueue(i: number) {
  const song = state.queue[i]
  if (!song) return
  state.queue.splice(i, 1)
  state.queue.unshift(song)
  await ensurePlay(song)
}

/** 删除队列中第 i 首 */
async function removeQueueAt(i: number) {
  const removed = state.queue[i]
  state.queue.splice(i, 1)
  if (removed && state.currentSong && removed.id === state.currentSong.id) {
    if (state.queue.length > 0) await ensurePlay(state.queue[0])
    else {
      state.currentSong = null
      state.playing = false
    }
  }
}

/** 置顶到下一首：把第 i 首排到当前歌曲之后，播完这首就轮到它 */
function pinToNext(i: number) {
  const song = state.queue[i]
  if (!song) return
  const cur = currentQueueIndex()
  if (cur === -1) {
    state.queue.splice(i, 1)
    state.queue.unshift(song)
    return
  }
  if (cur === i) return
  if (cur + 1 === i) return // 本来就是下一首
  state.queue.splice(i, 1)
  const target = i < cur ? cur : cur + 1
  state.queue.splice(target, 0, song)
}

/** 调整队列顺序 */
function moveQueue(from: number, to: number) {
  if (from < 0 || to < 0 || from >= state.queue.length || to >= state.queue.length) return
  const [item] = state.queue.splice(from, 1)
  state.queue.splice(to, 0, item)
}

async function playPrev() {
  const i = currentQueueIndex()
  if (i > 0) await playQueueAt(i - 1)
  else if (i === -1 && state.queue.length) await playQueueAt(0)
  else if (i === 0) await seek(0)
}
async function playNext() {
  const i = currentQueueIndex()
  if (i >= 0 && i < state.queue.length - 1) await playQueueAt(i + 1)
  else if (i === -1 && state.queue.length) await playQueueAt(0)
}

async function toggleMode() {
  const next: VideoMode = state.mode === 'orig' ? 'accomp' : 'orig'
  state.mode = next
  await window.api.setMode(next)
}

async function togglePlay() {
  await window.api.control(state.playing ? 'pause' : 'play')
}

async function seek(time: number) {
  state.currentTime = time
  await window.api.control('seek', time)
}

/** 重唱：当前曲从头播放 */
async function reSing() {
  if (!state.currentSong) return
  state.currentTime = 0
  await window.api.control('seek', 0)
}

async function applyVolumes() {
  await window.api.setVolumes({ ...state.volumes })
}

async function rescan() {
  state.scanning = true
  try {
    await window.api.rescan()
    await loadAll()
    await refresh()
  } finally {
    state.scanning = false
  }
}

function togglePlayMode() {
  state.playMode = state.playMode === 'order' ? 'random' : 'order'
}

function toggleQueueOpen() {
  state.queueOpen = !state.queueOpen
}
function setQueueTab(tab: QueueTab) {
  state.queueTab = tab
}

function isFav(id: number): boolean {
  return state.favs.includes(id)
}
function toggleFav(song: Song) {
  if (!song) return
  const i = state.favs.indexOf(song.id)
  if (i >= 0) state.favs.splice(i, 1)
  else state.favs.push(song.id)
  saveFavs([...state.favs])
}

/** 保存当前队列为歌单（本地 localStorage 持久化） */
function saveCurrentPlaylist(name?: string) {
  if (state.queue.length === 0) return false
  const n = state.playlists.length + 1
  const pl: SavedPlaylist = {
    name: name?.trim() || `我的歌单 ${n}`,
    songs: [...state.queue],
    createdAt: new Date().toISOString()
  }
  state.playlists.push(pl)
  savePlaylists(state.playlists)
  return true
}

function deletePlaylist(name: string) {
  state.playlists = state.playlists.filter((p) => p.name !== name)
  savePlaylists(state.playlists)
  if (state.selectedPlaylist === name) state.selectedPlaylist = null
}

// —— 视图导航 ——
function navigate(view: ViewName) {
  if (state.view === view) return
  state.viewHistory.push(state.view)
  state.view = view
  state.artistFilter = null
  state.categoryFilter = '全部'
  state.selectedPlaylist = null
}
function back() {
  const prev = state.viewHistory.pop()
  if (prev) {
    state.view = prev
    state.artistFilter = null
    state.categoryFilter = '全部'
    state.selectedPlaylist = null
  }
}

// 接收播放窗同步事件
window.api.onSyncTime((d) => {
  state.currentTime = d.currentTime
  state.duration = d.duration || state.duration
})
window.api.onSyncState((d) => {
  state.playing = d.playing
})
window.api.onSyncEnded(() => {
  state.playing = false
  const idx = currentQueueIndex()
  if (idx >= 0) {
    const ended = state.queue[idx]
    state.history.unshift(ended)
    if (state.history.length > 50) state.history.length = 50
    state.queue.splice(idx, 1) // 移除已播
    let next: Song | undefined
    if (state.playMode === 'random') {
      next = state.queue[Math.floor(Math.random() * state.queue.length)]
    } else {
      next = state.queue[idx] ?? state.queue[0] // 顺序：播原下一首，空则回到队首
    }
    if (next) ensurePlay(next)
    else state.currentSong = null
  } else {
    state.currentSong = null
  }
})

const artists = computed(() => {
  const map = new Map<string, Song[]>()
  for (const s of state.allSongs) {
    const key = s.artist || '未知歌手'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  }
  return Array.from(map.entries()).map(([name, list]) => ({
    name,
    count: list.length,
    cover: list[0],
    avatar: list[0]?.artistAvatar || ''
  }))
})

const favSongs = computed(() => state.allSongs.filter((s) => state.favs.includes(s.id)))
const playlistDetail = computed<Song[]>(() => {
  if (state.selectedPlaylist === '__fav__') return favSongs.value
  if (state.selectedPlaylist === '__history__') return state.history
  const pl = state.playlists.find((p) => p.name === state.selectedPlaylist)
  return pl ? pl.songs : []
})

export const store = {
  state,
  init,
  doSearch,
  addToQueue,
  playQueueAt,
  topQueue,
  removeQueueAt,
  moveQueue,
  pinToNext,
  playPrev,
  playNext,
  toggleMode,
  togglePlay,
  seek,
  reSing,
  applyVolumes,
  rescan,
  togglePlayMode,
  toggleQueueOpen,
  setQueueTab,
  isFav,
  toggleFav,
  saveCurrentPlaylist,
  deletePlaylist,
  navigate,
  back,
  currentQueueIndex,
  artists,
  favSongs,
  playlistDetail
}

export const progress = computed(() =>
  state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0
)
