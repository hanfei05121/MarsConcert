import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { connect } from './remote'

createApp(App).mount('#app')
connect()