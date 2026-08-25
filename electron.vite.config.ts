import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import pxtorem from 'postcss-pxtorem'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main'
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload'
    }
  },
  renderer: {
    root: 'src/renderer',
    css: {
      postcss: {
        plugins: [
          pxtorem({
            // rem 适配基准：375 设计宽对应 1rem=16px。
            // 注意：只有 mobile 页会动态改根字号实现等比缩放；
            // main/player（桌面端窗口）根字号固定 16px，转换后像素值不变，布局不受影响。
            rootValue: 16,
            propList: ['*'],
            minPixelValue: 1, // 1px 边框等不转 rem，避免缩放时比边框跟着变粗
            mediaQuery: false
          })
        ]
      }
    },
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          player: resolve(__dirname, 'src/renderer/player.html'),
          mobile: resolve(__dirname, 'src/renderer/mobile.html')
        }
      }
    },
    plugins: [vue()]
  }
})
