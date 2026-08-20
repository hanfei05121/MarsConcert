<script setup lang="ts">
import type { ViewName } from '../store'

const props = defineProps<{ view: ViewName }>()
const emit = defineEmits<{
  (e: 'nav', view: ViewName): void
}>()

const menus: { key: ViewName; label: string; icon: string }[] = [
  { key: 'recommend', label: '推荐', icon: '🏠' },
  { key: 'artists', label: '歌星', icon: '🎤' },
  { key: 'category', label: '分类', icon: '🏷️' },
  { key: 'playlists', label: '歌单', icon: '📃' },
  { key: 'mine', label: '我的', icon: '👤' }
]
</script>

<template>
  <aside class="sidebar">
    <!-- 用户区 -->
    <div class="user">
      <div class="avatar">浪</div>
      <div class="uinfo">
        <div class="nick">70后后浪</div>
        <div class="vip">开通VIP</div>
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

    <!-- 云盘 -->
    <div class="cloud">
      <span class="ic">☁️</span>
      <span>我的云盘</span>
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
  color: #1a1205;
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
.vip {
  margin-top: 4px;
  display: inline-block;
  font-size: 11px;
  color: #fff;
  background: var(--danger);
  border-radius: 4px;
  padding: 1px 6px;
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
  transition: all 0.15s ease;
}
.item:hover {
  background: var(--bg-2);
}
.item.active {
  background: var(--accent);
  color: #1a1205;
}
.ic {
  font-size: 18px;
}
.cloud {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--bg-2);
  color: var(--text-1);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.cloud:hover {
  color: var(--accent);
}
</style>
