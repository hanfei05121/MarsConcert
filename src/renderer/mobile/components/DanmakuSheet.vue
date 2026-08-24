<script setup lang="ts">
import { ref } from 'vue'
import { mobile, api } from '../remote'

defineEmits<{ (e: 'close'): void }>()
const text = ref('')

async function send() {
  const t = text.value.trim()
  if (!t) return
  const r = await api.danmaku(t)
  if (r.ok) text.value = ''
}
</script>

<template>
  <div class="backdrop" @click="$emit('close')">
    <div class="sheet" @click.stop>
      <div class="grab" />
      <div class="title">发弹幕 · 副屏会实时滚动</div>

      <div class="input-row">
        <input
          v-model="text"
          class="dm-input"
          placeholder="想说点什么，发到副屏上…"
          maxlength="80"
          @keydown.enter="send"
        />
        <button class="send" :disabled="!text.trim()" @click="send">发送</button>
      </div>

      <div class="hint">支持回车发送 · 弹幕会从副屏右侧向左滚动</div>
      <div v-if="mobile.danmakus.length" class="recent">
        <div v-for="d in [...mobile.danmakus].slice(-3).reverse()" :key="d.id" class="rdm">{{ d.text }}</div>
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
  background: linear-gradient(160deg, var(--bg-1), var(--bg-0));
  border-radius: 20px 20px 0 0;
  padding: 10px 18px calc(22px + env(safe-area-inset-bottom));
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
  margin-bottom: 12px;
}
.input-row {
  display: flex;
  gap: 10px;
}
.dm-input {
  flex: 1;
  height: 46px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--bg-2);
  color: var(--text-0);
  padding: 0 14px;
  font-size: 14px;
}
.dm-input:focus {
  border-color: var(--accent);
}
.send {
  width: 70px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: var(--on-accent);
  font-size: 15px;
  font-weight: 700;
}
.send:disabled {
  opacity: 0.4;
}
.hint {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-2);
}
.recent {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rdm {
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--accent-soft);
  border-left: 3px solid var(--accent);
  font-size: 13px;
}
</style>