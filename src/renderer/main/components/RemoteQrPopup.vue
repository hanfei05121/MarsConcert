<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import type { RemoteInfo } from '../../../shared/types'

const emit = defineEmits<{ (e: 'close'): void }>()

const info = ref<RemoteInfo | null>(null)
const err = ref('')
const loading = ref(true)

onMounted(async () => {
  try {
    const r = await window.api.getRemoteInfo()
    info.value = r
  } catch (e) {
    err.value = String(e)
  } finally {
    loading.value = false
  }
})

function copyUrl() {
  if (!info.value) return
  navigator.clipboard?.writeText(info.value.url).catch(() => {})
}
</script>

<template>
  <div class="qr-backdrop" @click="emit('close')">
    <div class="qr-panel" @click.stop>
      <button class="qr-close" title="关闭" @click="emit('close')"><CloseOutlined /></button>
      <div class="qr-title">手机遥控</div>
      <p class="qr-sub">用手机扫一扫，在手机上点歌 / 控制 / 发弹幕</p>

      <div v-if="loading" class="qr-body"><span class="muted">正在生成二维码…</span></div>
      <div v-else-if="err" class="qr-body"><span class="muted">二维码生成失败：{{ err }}</span></div>
      <img v-else-if="info?.qrDataUrl" :src="info.qrDataUrl" class="qr-img" alt="扫码进入手机遥控" />

      <div v-if="info" class="qr-url" @click="copyUrl" title="点击复制">
        {{ info.url }}
      </div>
      <p class="qr-tip">请将手机与电脑连接到同一个 Wi-Fi 后扫码</p>
    </div>
  </div>
</template>

<style scoped>
.qr-backdrop {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-panel {
  position: relative;
  width: 320px;
  padding: 26px 24px 22px;
  border-radius: 18px;
  background: linear-gradient(160deg, var(--bg-1), var(--bg-0));
  border: 1px solid var(--line);
  box-shadow: var(--shadow-pop);
  text-align: center;
}
.qr-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--bg-2);
  color: var(--text-1);
  cursor: pointer;
}
.qr-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-0);
}
.qr-sub {
  margin: 6px 0 16px;
  font-size: 12px;
  color: var(--text-2);
}
.qr-body {
  height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-img {
  width: 240px;
  height: 240px;
  border-radius: 12px;
  background: #fff;
  padding: 8px;
  display: block;
  margin: 0 auto;
}
.qr-url {
  margin-top: 14px;
  font-size: 13px;
  color: var(--accent);
  word-break: break-all;
  cursor: pointer;
  user-select: text;
}
.qr-tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--text-2);
}
.muted {
  color: var(--text-2);
}
</style>