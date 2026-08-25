<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { QrcodeOutlined } from '@ant-design/icons-vue'
import { store } from './store'
import Sidebar from './components/Sidebar.vue'
import TopBar from './components/TopBar.vue'
import PlaylistPopup from './components/PlaylistPopup.vue'
import BottomBar from './components/BottomBar.vue'
import RemoteQrPopup from './components/RemoteQrPopup.vue'

const router = useRouter()

/** 「手机遥控」二维码弹窗开关 */
const remoteOpen = ref(false)

const state = store.state
onMounted(() => store.init())

/** 返回上一视图；没有历史记录时回推荐页 */
function goBack() {
  if (window.history.length > 1) router.back()
  else router.push({ name: 'recommend' })
}

/** 顶部搜索：查询后跳到歌曲列表页展示结果 */
async function doSearch(q: string) {
  await store.doSearch(q)
  if (router.currentRoute.value.name !== 'search') router.push({ name: 'search' })
}
</script>

<template>
  <div class="app">
    <Sidebar />

    <div class="main">
      <TopBar @back="goBack" @search="doSearch" />

      <!-- 路由出口：各主视图由 vue-router 渲染 -->
      <main class="content">
        <router-view />
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