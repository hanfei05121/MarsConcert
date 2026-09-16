import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import './style.css'
import App from './App.vue'
import router from './router'
import { initRemoteBridge } from './remote'
import { spotlight } from './spotlight'

// v-spotlight：列表行上「跟随鼠标的圆形渐变光斑」，见 ./spotlight 与 style.css 的 --spot-*
createApp(App).use(Antd).use(router).directive('spotlight', spotlight).mount('#app')
initRemoteBridge()