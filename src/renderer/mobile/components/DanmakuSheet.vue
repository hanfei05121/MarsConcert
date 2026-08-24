<script setup lang="ts">
import { ref } from 'vue'
import { mobile, api } from '../remote'
import { DANMAKU_PRESETS } from '../danmaku-presets'

defineEmits<{ (e: 'close'): void }>()

const text = ref('')
const active = ref(DANMAKU_PRESETS[0].key)

const activeGroup = () => DANMAKU_PRESETS.find((g) => g.key === active.value) ?? DANMAKU_PRESETS[0]

/** 点击快捷语：填入输入框，可再编辑后发送 */
function pick(item: string) {
  text.value = item
}

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
      <div class="title">发个弹幕看看吧</div>

      <div class="input-row">
        <input
          v-model="text"
          class="dm-input"
          placeholder="给他/她写点什么呢……"
          maxlength="80"
          @keydown.enter="send"
        />
        <button class="send" :disabled="!text.trim()" @click="send">发送</button>
      </div>
      <div class="tip">点下方快捷语即可填入，可再编辑后发送</div>

      <!-- 快捷语分类 -->
      <div class="cats">
        <button
          v-for="g in DANMAKU_PRESETS"
          :key="g.key"
          class="cat"
          :class="{ on: active === g.key }"
          @click="active = g.key"
        >
          {{ g.icon }} {{ g.label }}
        </button>
      </div>

      <!-- 快捷语列表 -->
      <div class="quick">
        <button v-for="p in activeGroup().items" :key="p" class="q" @click="pick(p)">{{ p }}</button>
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
  max-height: 78vh;
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
  margin-bottom: 10px;
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
.tip {
  margin: 8px 0 10px;
  font-size: 12px;
  color: var(--text-2);
}
.cats {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  flex-shrink: 0;
}
.cat {
  flex-shrink: 0;
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--bg-2);
  color: var(--text-1);
  font-size: 12px;
  font-weight: 600;
}
.cat.on {
  background: var(--accent);
  color: var(--on-accent);
  border-color: var(--accent);
}
.quick {
  flex: 1;
  overflow-y: auto;
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
}
.q {
  padding: 8px 13px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--bg-2);
  color: var(--text-1);
  font-size: 13px;
  max-width: 100%;
  text-align: left;
}
.q:active {
  background: var(--accent-soft);
  border-color: var(--accent);
}
</style>