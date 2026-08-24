<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  SearchOutlined,
  CloseOutlined,
  ControlOutlined,
  CommentOutlined,
  CustomerServiceOutlined
} from '@ant-design/icons-vue'
import { mobile, api } from './remote'
import type { RemoteSong } from '../../shared/types'
import ControlSheet from './components/ControlSheet.vue'
import DanmakuSheet from './components/DanmakuSheet.vue'
import QueueSheet from './components/QueueSheet.vue'

type Sheet = 'none' | 'control' | 'danmaku' | 'queue'
const sheet = ref<Sheet>('none')
const kw = ref('')
const songs = ref<RemoteSong[]>([])
const loading = ref(false)
const toast = ref('')

let sTimer: ReturnType<typeof setTimeout> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(text: string) {
  toast.value = text
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 1800)
}

async function runSearch(q: string) {
  kw.value = q
  if (sTimer) clearTimeout(sTimer)
  sTimer = setTimeout(async () => {
    loading.value = true
    const r = await api.search(q)
    loading.value = false
    if (r.ok) songs.value = r.songs
  }, 180)
}
onMounted(() => runSearch(''))
onBeforeUnmount(() => sTimer && clearTimeout(sTimer))

/** 手机点歌：转发主进程 -> 控制窗 store.addToQueue，并飞一个亮点到「已点」Tab */
async function order(s: RemoteSong, ev: Event) {
  const r = await api.play(s.id)
  if (r.ok) {
    flyToQueue(ev)
    showToast(`已点：${s.name}`)
  } else {
    showToast('点歌失败，请稍后再试')
  }
}

/** 从被点歌曲行飞一个亮点到「已点」Tab，呼应数字 +1 */
function flyToQueue(ev: Event) {
  const src = ev.currentTarget as HTMLElement | null
  const btn = document.getElementById('qtab')
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
    btn.classList.remove('bump')
    void btn.offsetWidth
    btn.classList.add('bump')
    window.setTimeout(() => btn.classList.remove('bump'), 420)
  }
}

function tapTab(name: Sheet) {
  sheet.value = sheet.value === name ? 'none' : name
}

function fmtSec(d: number): string {
  if (!d || d <= 0) return '00:00'
  const m = Math.floor(d / 60)
  const s = Math.floor(d % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const curPlayName = computed(() => mobile.currentSong?.name || '等待点歌…')
const curPlaySub = computed(() => {
  if (!mobile.currentSong) return '扫码到这里，点一首歌吧'
  return `${mobile.currentSong.artist || ''}  ·  ${fmtSec(mobile.currentTime)} / ${fmtSec(mobile.duration)}`
})

// —— 弹幕回显的稳定随机参数（以 id 为种子，避免每次渲染跳动）——
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
function dkTop(id: number): number {
  return 6 + seeded(id) * 52
}
function dkSize(id: number): number {
  return 22 + Math.floor(seeded(id + 1) * 8)
}
function dkDur(id: number): number {
  return 7 + seeded(id + 2) * 4
}
</script>

<template>
  <div class="app">
    <!-- 顶部：正在播放 + 连接状态 -->
    <header class="head">
      <div class="brand">
        <span class="bdot" />
        <span class="bt">火星点歌台</span>
        <span class="dot" :class="mobile.connected ? 'on' : ''" />
      </div>
      <button class="now" @click="tapTab('control')">
        <div class="now-i">
          <svg v-if="mobile.playing" viewBox="0 0 24 24" width="18" height="18"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
        </div>
        <div class="now-t">
          <div class="now-name">{{ curPlayName }}</div>
          <div class="now-sub">{{ curPlaySub }}</div>
        </div>
        <span class="now-go">控制 ›</span>
      </button>
    </header>

    <!-- 搜索栏 -->
    <div class="searchbar">
      <span class="si"><SearchOutlined /></span>
      <input v-model="kw" class="sinput" placeholder="搜索歌曲 / 歌星" @input="runSearch(kw)" />
      <button v-if="kw" class="clear" @click="runSearch('')"><CloseOutlined /></button>
    </div>

    <!-- 主内容：歌曲列表 -->
    <main class="list">
      <div class="list-head">
        <span class="lh-t">{{ kw ? `搜索 “${kw}”` : '全部歌曲' }}</span>
        <span class="lh-c">{{ songs.length }} 首</span>
      </div>
      <div v-if="loading" class="empty">加载中…</div>
      <button v-else v-for="s in songs" :key="s.id" class="row" @click="order(s, $event)">
        <div class="r-info">
          <div class="r-name">{{ s.name }}</div>
          <div class="r-art">{{ s.artist || '未知歌手' }}</div>
        </div>
        <span class="r-add">＋ <i>点歌</i></span>
      </button>
      <div v-if="!loading && songs.length === 0" class="empty">没有找到相关歌曲</div>
    </main>

    <!-- 弹幕回显：和副屏一样从右向左滚动，多条不互相遮挡 -->
    <div v-if="mobile.danmakus.length" class="dk-layer">
      <div
        v-for="d in mobile.danmakus"
        :key="d.id"
        class="dk-item"
        :style="{ top: dkTop(d.id) + '%', fontSize: dkSize(d.id) + 'px', animationDuration: dkDur(d.id) + 's' }"
      >
        {{ d.text }}
      </div>
    </div>

    <!-- 轻提示 -->
    <Transition name="toast">
      <div v-if="toast" class="toastbar">{{ toast }}</div>
    </Transition>

    <!-- 底部三键：控制 / 发弹幕 / 已点歌曲 -->
    <nav class="nav">
      <button class="tab" :class="{ on: sheet === 'control' }" @click="tapTab('control')">
        <span class="ti"><ControlOutlined /></span><span class="tt">控制台</span>
      </button>
      <button class="tab" :class="{ on: sheet === 'danmaku' }" @click="tapTab('danmaku')">
        <span class="ti"><CommentOutlined /></span><span class="tt">发弹幕</span>
      </button>
      <button id="qtab" class="tab" :class="{ on: sheet === 'queue' }" @click="tapTab('queue')">
        <span class="ti"><CustomerServiceOutlined /></span>
        <span class="tt">已点
          <span v-if="mobile.queue.length" class="badge">{{ mobile.queue.length }}</span>
        </span>
      </button>
    </nav>

    <!-- 底部弹层面板 -->
    <ControlSheet v-if="sheet === 'control'" @close="sheet = 'none'" />
    <DanmakuSheet v-else-if="sheet === 'danmaku'" @close="sheet = 'none'" />
    <QueueSheet v-else-if="sheet === 'queue'" @close="sheet = 'none'" />
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding-bottom: 64px;
}
.head {
  padding: 14px 16px 6px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: 15px;
}
.bdot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, var(--accent-3), var(--accent));
  box-shadow: 0 0 8px var(--accent);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #555;
}
.dot.on {
  background: #3ddc84;
  box-shadow: 0 0 6px #3ddc84;
}
.now {
  margin-top: 10px;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: linear-gradient(120deg, var(--bg-2), var(--bg-1));
  border: 1px solid var(--line);
  text-align: left;
}
.now-i {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: var(--on-accent);
}
.now-t {
  flex: 1;
  min-width: 0;
}
.now-name {
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.now-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-2);
}
.now-go {
  font-size: 12px;
  color: var(--accent);
  flex-shrink: 0;
}
.searchbar {
  position: relative;
  display: flex;
  align-items: center;
  margin: 10px 16px 4px;
}
.si {
  position: absolute;
  left: 12px;
  font-size: 15px;
  opacity: 0.7;
}
.sinput {
  flex: 1;
  height: 42px;
  border-radius: 21px;
  border: 1px solid var(--line);
  background: var(--bg-1);
  color: var(--text-0);
  padding: 0 40px 0 38px;
  font-size: 14px;
}
.sinput:focus {
  border-color: var(--accent);
}
.clear {
  position: absolute;
  right: 12px;
  color: var(--text-2);
  font-size: 14px;
}
.list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 16px 12px;
}
.list-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 8px 2px 10px;
}
.lh-t {
  font-size: 17px;
  font-weight: 800;
}
.lh-c {
  font-size: 12px;
  color: var(--text-2);
}
.row {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 12px 6px;
  border-bottom: 1px solid rgba(65, 48, 38, 0.6);
  text-align: left;
}
.r-info {
  flex: 1;
  min-width: 0;
}
.r-name {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.r-art {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-2);
}
.r-add {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--accent);
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-line, rgba(255,95,55,0.4));
}
.r-add i {
  font-style: normal;
}
.empty {
  text-align: center;
  color: var(--text-2);
  padding: 40px 10px;
  font-size: 13px;
}
.nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 64px;
  display: flex;
  border-top: 1px solid var(--line);
  background: var(--bg-1);
  z-index: 40;
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--text-2);
}
.tab.on {
  color: var(--accent-2);
}
.ti {
  font-size: 20px;
  line-height: 1;
}
.tt {
  font-size: 12px;
  font-weight: 600;
  position: relative;
}
.badge {
  display: inline-block;
  min-width: 16px;
  height: 16px;
  line-height: 16px;
  margin-left: 3px;
  border-radius: 999px;
  background: var(--danger);
  color: #fff;
  font-size: 11px;
  text-align: center;
}
/* 弹幕回显层：从右向左滚动，覆盖在主内容上方、底部栏下方 */
.dk-layer {
  position: fixed;
  left: 0;
  right: 0;
  top: 64px;
  bottom: 78px;
  z-index: 80;
  overflow: hidden;
  pointer-events: none;
}
.dk-item {
  position: absolute;
  left: 0;
  white-space: nowrap;
  color: #fff;
  font-weight: 600;
  text-shadow:
    0 2px 4px rgba(0, 0, 0, 0.9),
    0 0 10px rgba(255, 77, 46, 0.55);
  will-change: transform;
  animation: dkfly linear forwards;
}
@keyframes dkfly {
  from {
    transform: translateX(100vw);
  }
  to {
    transform: translateX(-100vw);
  }
}
/* 轻提示 */
.toastbar {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  padding: 10px 20px;
  border-radius: 999px;
  background: rgba(20, 16, 14, 0.92);
  border: 1px solid var(--accent);
  color: var(--text-0);
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  max-width: 80vw;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
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
#qtab.bump .badge {
  animation: mobile-bump 0.42s ease;
}
@keyframes mobile-bump {
  0% {
    transform: scale(1);
  }
  35% {
    transform: scale(1.35);
  }
  100% {
    transform: scale(1);
  }
}
</style>