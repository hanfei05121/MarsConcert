<script setup lang="ts">
import { ArrowUpOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { mobile, api } from '../remote'

defineEmits<{ (e: 'close'): void }>()

async function remove(index: number) {
  await api.queueAction('remove', index)
}
async function top(index: number) {
  await api.queueAction('top', index)
}
</script>

<template>
  <div class="backdrop" @click="$emit('close')">
    <div class="sheet" @click.stop>
      <div class="grab" />
      <div class="title">
        已点歌曲
        <span class="count">{{ mobile.queue.length }} 首</span>
      </div>

      <div class="list">
        <div v-if="mobile.queue.length === 0" class="empty">
          还没有已点歌曲<br />去首页搜索点歌吧
        </div>
        <div v-for="(s, i) in mobile.queue" :key="s.id" class="qrow">
          <span class="qidx" :class="{ cur: mobile.currentSong && mobile.currentSong.id === s.id }">
            {{ i + 1 }}
          </span>
          <div class="qinfo">
            <div class="qname">{{ s.name }}</div>
            <div class="qart">{{ s.artist || '未知歌手' }}</div>
          </div>
          <span v-if="mobile.currentSong && mobile.currentSong.id === s.id" class="qplaying">播放中</span>
          <button class="qop top" title="置顶" @click="top(i)"><ArrowUpOutlined /></button>
          <button class="qop del" title="删除" @click="remove(i)"><DeleteOutlined /></button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, var(--bg-1), var(--bg-0));
  border-radius: 20px 20px 0 0;
  padding: 10px 18px calc(20px + env(safe-area-inset-bottom));
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.5);
}
.grab {
  width: 40px;
  height: 4px;
  border-radius: 4px;
  background: var(--line);
  margin: 2px auto 10px;
}
.title {
  font-size: 16px;
  font-weight: 800;
  margin-bottom: 8px;
}
.count {
  font-size: 12px;
  color: var(--text-2);
  margin-left: 6px;
}
.list {
  flex: 1;
  overflow-y: auto;
}
.qrow {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 2px;
  border-bottom: 1px solid rgba(65, 48, 38, 0.5);
}
.qidx {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--bg-3);
  color: var(--text-2);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qidx.cur {
  background: var(--accent);
  color: var(--on-accent);
}
.qinfo {
  flex: 1;
  min-width: 0;
}
.qname {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.qart {
  font-size: 12px;
  color: var(--text-2);
}
.qplaying {
  font-size: 11px;
  color: var(--accent-2);
  flex-shrink: 0;
}
.qop {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  font-size: 15px;
  background: var(--bg-2);
}
.qop.top {
  color: var(--text-1);
}
.qop.del {
  color: var(--danger);
}
.empty {
  text-align: center;
  color: var(--text-2);
  padding: 40px 10px;
  font-size: 14px;
  line-height: 1.8;
}
</style>