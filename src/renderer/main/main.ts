import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import './style.css'
import App from './App.vue'
import { initRemoteBridge } from './remote'

createApp(App).use(Antd).mount('#app')
initRemoteBridge()
