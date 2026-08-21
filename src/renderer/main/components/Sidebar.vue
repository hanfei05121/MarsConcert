<script setup lang="ts">
import { computed } from 'vue'
import type { ViewName } from '../store'
import { store } from '../store'

const props = defineProps<{ view: ViewName }>()
const emit = defineEmits<{
  (e: 'nav', view: ViewName): void
}>()

const menus: { key: ViewName; label: string; icon: string }[] = [
  { key: 'recommend', label: '推荐', icon: '🏠' },
  { key: 'search', label: '歌曲', icon: '🎵' },
  { key: 'artists', label: '歌星', icon: '🎤' },
  { key: 'category', label: '分类', icon: '🏷️' },
  { key: 'playlists', label: '歌单', icon: '📃' },
  { key: 'mine', label: '我的', icon: '👤' }
]

/** 当前曲库目录的文件夹名（D:\song-lib → song-lib），左下角展示用 */
const libName = computed(() => {
  const p = store.state.config?.songLibPath
  if (!p) return '未设置'
  return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p
})
</script>

<template>
  <aside class="sidebar">
    <!-- 用户区 -->
    <div class="user">
      <div class="avatar">花</div>
      <div class="uinfo">
        <div class="nick">花花</div>
      </div>
    </div>

    <!-- 导航 -->
    <nav class="nav">
      <button
        v-for="m in menus"
        :key="m.key"
        class="item"
        :class="{ active: props.view === m.key }"
        @click="emit('nav', m.key)"
      >
        <span class="ic">{{ m.icon }}</span>
        <span class="lb">{{ m.label }}</span>
      </button>
    </nav>

    <!-- 我的资源：点击选择曲库目录 -->
    <div class="cloud" title="点击选择曲库目录" @click="store.chooseLib()">
      <span class="ic">📂</span>
      <div class="clbinfo">
        <span class="clbtitle">我的资源</span>
        <span class="clbpath">{{ libName }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 184px;
  flex-shrink: 0;
  background: var(--bg-1);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
}
.user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 12px;
  background: var(--bg-2);
  margin-bottom: 18px;
}
.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: var(--on-accent);
  font-weight: 800;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.nick {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-0);
}
.nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--text-1);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--ease);
}
.item:hover {
  background: var(--bg-3);
  transform: translateY(2px);
}
.item.active {
  background: var(--accent);
  color: var(--on-accent);
}
.ic {
  font-size: 18px;
}
.cloud {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--bg-2);
  color: var(--text-1);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-glow);
  transition: var(--ease);
}
.cloud:hover {
  background: var(--bg-3);
  color: var(--accent);
  transform: translateY(2px);
}
.clbinfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.clbtitle {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}
.clbpath {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}
</style>
