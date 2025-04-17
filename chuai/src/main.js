import { createApp } from 'vue'
import App from './App.vue'
import VueSocketIO from "../node_modules/vue-socket.io"
import SocketIO from '../node_modules/socket.io-client'
createApp(App).mount('#app')

createApp(App).use(new VueSocketIO({
  // debug: true,
  connection: SocketIO('ws://localhost:3000', {   //需要连接socket的地址
    autoConnect: false  //禁止自动连接socket，由于不需要一直连socket服务，所以这里设置关闭
  }),  //可以连接socket
  options: {
    transports: ['websocket', 'polling']   //socket.io的参数请看文档
  }
}));
