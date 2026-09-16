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
    resolve: {
      // three 的 webgpu / tsl / addons 三个入口最终指向同一份 build 产物，
      // 去重避免 dev 预构建时出现两份实例 —— TSL 节点跨副本会互相认不出来。
      dedupe: ['three']
    },
    optimizeDeps: {
      // 海洋引擎（海洋背景）挂在动态 import 的 chunk 里，这里主动声明，
      // 让 dev 一开始就把它预构建好，而不是运行时才发现新依赖、页面重载一次。
      include: ['three/webgpu', 'three/tsl', 'three/addons/tsl/display/BloomNode.js']
    },
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
