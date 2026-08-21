<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  total: number
  pageSize: number
  current: number
}>()

const emit = defineEmits<{
  (e: 'change', page: number): void
}>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

/** 页码列表（>7 页时收缩为 1 … x-1 x x+1 … N） */
const pages = computed<(number | '...')[]>(() => {
  const total = totalPages.value
  const cur = props.current
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const list: (number | '...')[] = [1]
  const start = Math.max(2, cur - 1)
  const end = Math.min(total - 1, cur + 1)
  if (start > 2) list.push('...')
  for (let i = start; i <= end; i++) list.push(i)
  if (end < total - 1) list.push('...')
  list.push(total)
  return list
})

function go(p: number) {
  if (p < 1 || p > totalPages.value || p === props.current) return
  emit('change', p)
}
</script>

<template>
  <div class="pager">
    <button class="pg" :disabled="current <= 1" @click="go(current - 1)">‹ 上一页</button>
    <template v-for="(p, i) in pages" :key="i">
      <span v-if="p === '...'" class="dots">…</span>
      <button v-else class="pg num" :class="{ on: p === current }" @click="go(p)">{{ p }}</button>
    </template>
    <button class="pg" :disabled="current >= totalPages" @click="go(current + 1)">下一页 ›</button>
    <span class="info">共 {{ total }} 首 · 第 {{ current }}/{{ totalPages }} 页</span>
  </div>
</template>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 18px;
  border-top: 1px solid var(--line);
  background: var(--bg-0);
  flex-shrink: 0;
}
.pg {
  min-width: 34px;
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--bg-1);
  color: var(--text-1);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.pg:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.pg.on {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}
.pg:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.dots {
  color: var(--text-2);
  padding: 0 2px;
}
.info {
  margin-left: 8px;
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
}
</style>
