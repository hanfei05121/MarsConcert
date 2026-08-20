<script setup lang="ts">
import { ref } from 'vue'
import { store } from '../store'

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'search', q: string): void
}>()

const kw = ref('')

function onInput() {
  emit('search', kw.value)
}
function win(action: 'min' | 'max' | 'close') {
  window.api.windowControl(action)
}
</script>

<template>
  <header class="topbar">
    <button class="back" title="返回" @click="emit('back')">‹</button>

    <div class="search">
      <span class="si">🔍</span>
      <input
        v-model="kw"
        class="sinput"
        placeholder="搜索歌曲、歌星、歌单"
        @input="onInput"
      />
      <button v-if="kw" class="clear" @click="kw = ''; emit('search', '')">✕</button>
    </div>

    <div class="spacer" />

    <div class="icons">
      <span class="sep" />
      <button class="ic" title="最小化" @click="win('min')">—</button>
      <button class="ic" title="最大化" @click="win('max')">▢</button>
      <button class="ic close" title="关闭" @click="win('close')">✕</button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 18px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--line);
}
.back {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--bg-2);
  color: var(--text-0);
  font-size: 22px;
  cursor: pointer;
}
.back:hover {
  border-color: var(--accent);
}
.search {
  position: relative;
  flex: 1;
  max-width: 520px;
  display: flex;
  align-items: center;
}
.si {
  position: absolute;
  left: 14px;
  font-size: 14px;
  opacity: 0.7;
}
.sinput {
  width: 100%;
  height: 40px;
  border-radius: 20px;
  border: 1px solid var(--line);
  background: var(--bg-0);
  color: var(--text-0);
  padding: 0 40px 0 40px;
  font-size: 14px;
  outline: none;
}
.sinput:focus {
  border-color: var(--accent);
}
.clear {
  position: absolute;
  right: 12px;
  border: none;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  font-size: 14px;
}
.spacer {
  flex: 1;
}
.icons {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ic {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: var(--bg-2);
  color: var(--text-0);
  font-size: 15px;
  cursor: pointer;
}
.ic:hover {
  border-color: var(--accent);
}
.ic.close:hover {
  background: var(--danger);
  border-color: var(--danger);
}
.sep {
  width: 1px;
  height: 22px;
  background: var(--line);
  margin: 0 4px;
}
</style>
