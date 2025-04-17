<template>
  <!-- 玩家区域 -->
  <div class="poker-room">
      <div class="result"> {{ result?result:this.message()}}</div>
    <!-- 牌桌中央 -->
    <div class="table-center">
      <button @click="start" v-if="isHost">开始游戏</button>
      <div class="deck">奖池: {{ pot }}</div>
    </div>

    <!-- 玩家区域 -->
    <div
      v-for="player in players"
      :key="player.id"
      :class="[
        'player-area',
        { 'current-player': player.id === currentPlayerId },
      ]"
      :style="getPlayerPosition($index)"
    >
      <div class="player-info">
        <h3>{{ player.id == this.player ? "您" : player.name }}</h3>
        <div class="chips">筹码: {{ player.stats.score }}</div>
      </div>

      <!-- 手牌区域 -->
      <div class="cards">
        <div
          v-for="(card, index) in player.cards"
          :key="index"
          :class="['card', { revealed: gameStarted }]"
          :style="getCardStyle(index)"
        >
          <div
            class="front"
            :class="[card.suit == '♠' || card.suit == '♣' ? 'black' : 'red']"
          >
            <div class="poker-card">
              <div class="card-face card-front">
                <div class="card-corner top-left">
                  {{
                    player.id == this.player || index >= 2||showCard
                      ? getCardNum(card.rank) + card.suit
                      : ""
                  }}
                </div>
                <div class="center-suit">
                  {{
                    player.id == this.player || index >= 2||showCard
                      ? getCardNum(card.rank) + card.suit
                      : ""
                  }}
                </div>
                <div class="card-corner bottom-right">
                  {{
                    player.id == this.player || index >= 2||showCard
                      ? getCardNum(card.rank) + card.suit
                      : ""
                  }}
                </div>
              </div>
            </div>
          </div>
          <div class="back"></div>
        </div>
      </div>
    </div>

    <div class="action-buttons" v-if="gamePlayer==player">
      <button v-show="round==1" class="game-btn handle-btn" @click="handle(1)">1</button>
      <button v-show="round==1" class="game-btn handle-btn" @click="handle(2)">2</button>
      <button v-show="round==1" class="game-btn handle-btn" @click="handle(3)">3</button>
      <button v-show="round!=5" class="game-btn fold-btn"  @click="handleFold">
        <svg-icon icon="fold" />弃牌
      </button>
      <button v-show="round==2" class="game-btn bet-btn"  @click="handleGo">
        <svg-icon icon="chips" /> 跟注
      </button>
      <button v-show="round==3" class="game-btn confirm-btn" @click="handleBet(0)">不踹</button>
      <button v-show="round==3" class="game-btn confirm-btn" @click="handleBet(1)">踹1</button>
      <button v-show="round==3" class="game-btn confirm-btn" @click="handleBet(2)">踹2</button>
      <button v-show="round==3" class="game-btn confirm-btn" @click="handleBet(3)">踹3</button>
      <button v-show="round==4" class="game-btn fly-btn" @click="handleFly(0)">不飞</button>
      <button v-show="round==4" class="game-btn fly-btn" @click="handleFly(10)">飞10</button>
      <button v-show="round==4" class="game-btn fly-btn" @click="handleFly(20)">飞20</button>
      <button v-show="round==4" class="game-btn fly-btn" @click="handleFly(30)">飞30</button>
    </div>
  </div>
</template>
<script >
import { io } from "socket.io-client";
let game;
export default {
  name: "HelloWorld",
  data() {
    return {
      socket: null,
      gameState: null,
      players: [],
      gamePlayer: null,
      currentPlayerId: null,
      gameStarted: false,
      deckCount: 52,
      player: null,
      showBetInput: true,
      round: 0,
      index: 0,
      pot: 0,
      num:0,
      result:'',
      showCard:false
    };
  },
  props: {
    msg: String,
  },
  computed: {
    isHost() {
      return this.players[0]?.id === this.socket?.id;
    },
  },
  mounted() {
    this.initVisibilityListener();
    this.socket = io("http://localhost:3000", {
      transports: ["websocket"], // 强制使用 WebSocket
      withCredentials: true, // 携带凭证（如 cookies）
      query: {
        token: "用户Token",
      },
    });
    // 监听基础事件
      this.socket.on('connect', this.handleConnect);
      this.socket.on('disconnect', this.handleDisconnect);
      
      // 强制同步事件
      this.socket.on('full-sync', this.handleFullSync);
    

    this.socket.on("addPlayer", (players, player) => {
      this.players = players;
      this.player = player;
    });
    this.socket.on("disPlayer", (player) => {
      this.players = player;
    });
    this.socket.on("game-start", (player, round, index,pot) => {
      this.players = player;
      this.gameStarted = true;
      this.round = round;
      this.index = index;
      this.pot = pot;
      this.gamePlayer = this.players[index].id;
    });

    this.socket.on("handle-num-back", (player, index, pot,round) => {
      this.players = player;
      this.index = index;
      this.gamePlayer = this.players[index].id;
      this.pot = pot;
      this.round = round;
    });
      this.socket.on("handle-go-back", (player, index, pot,round) => {
      this.players = player;
      this.index = index;
      this.gamePlayer = this.players[index].id;
      this.pot = pot;
      this.round = round;
    });
    this.socket.on("handle-bet-back", (player, index, pot,round) => {
      this.players = player;
      this.index = index;
      this.gamePlayer = this.players[index].id;
      this.pot = pot;
      this.round = round;
    });
     this.socket.on("result", (player,result, pot,round,showCard) => {
      this.players = player;
      this.pot = pot;
      this.round = round;
      this.result=result
      this.showCard=showCard
      });
  },
  methods: {
    message(){
      let name=''
      this.players.forEach((value, key) => {
      if (value.id==this.gamePlayer) {
        name=value.name
      }
    });
    if (this.player==this.gamePlayer) {
      name='您'
    }
      if (this.round==1) {
        return name+'请下注'
      }
      if (this.round==2) {
         return '注额为'+this.num +' '+ name+'是否跟注?'
      }
        if (this.round==3) {
         return name+'是否要踹?'
      }
      if (this.round==4) {
         return name+'要飞吗?'
      }

    },
    handle(num) {
      this.num=num
      this.socket.emit("handle-num", num, this.gamePlayer);
    },
    handleFold() {
      if (this.players.length<=2) { 
        this.socket.emit("player-action", this.gamePlayer);
      }else{
          if (this.round==1) {
          this.socket.emit("handle-num", 0, this.gamePlayer,true);
        }
        if (this.round==2) {
          this.socket.emit("handle-go",  this.gamePlayer,0,this.index==this.players.length-1,true);
        }
        if (this.round==3) {
          this.socket.emit("handle-bet",  this.gamePlayer,0,this.index,true);
        }
        if (this.round==4) {
          this.socket.emit("handle-fly",  this.gamePlayer,0,this.index,true);
         }

         this.socket.emit("handle-fold",this.gamePlayer);

      }
     
    },
    handleGo() {
      this.socket.emit("handle-go",this.gamePlayer,this.num,this.index==this.players.length-1);
    },
    handleFly(flyNum) {
      this.num=flyNum
      this.socket.emit("handle-fly",this.gamePlayer,flyNum,this.index);
    },
    handleBet(num) {
      this.num=num
      this.socket.emit("handle-bet",this.gamePlayer,this.num,this.index);

      // this.socket.emit("player-action");
      // this.socket.on("susult", (player) => {
      //   this.players = player;
      // });
     
    },
  // 页面可见性监听
    initVisibilityListener() {
        window.addEventListener("focus", () => {
          this.handleVisibilityChange()
    });
    },

    // 可见性变化处理
    handleVisibilityChange() {
       
      if (document.hasFocus()) {
        // 页面恢复时主动同步
        this.socket.emit('force-sync');
        this.resetHeartbeat();
      }
    },

    // 心跳机制
    resetHeartbeat() {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = setInterval(() => {
        if (this.socket.connected) {
          this.socket.volatile.emit('ping'); // volatile表示允许丢弃过时心跳
        }
      }, 20000); // 20秒心跳
    },

    // 连接成功处理
    handleConnect() {
      this.resetHeartbeat();
    },

    // 断开处理
    handleDisconnect(reason) {
      console.log('Socket disconnected:', reason);
      if (!this.isPageActive) {
        // 页面在后台时延迟重连
        this.reconnectTimer = setTimeout(() => {
          this.socket.connect();
        }, 5000);
      }
    },

    // 处理全量同步
    handleFullSync(data) {
     
      this.players=data.players
      this.gamePlayer = data.players[data.index].id;
      this.pot =data.pot;
      this.round = data.round;
      this.index = data.index;
      this.num=data.num
      this.result=data.result
      this.showCard=data.showCard
    },
    getPlayerPosition(index) {
      // 根据玩家数量计算环形位置
      const radius = 200;
      const angle = (index * 2 * Math.PI) / this.players.length;
      return {
        transform: `translate(
          ${radius * Math.cos(angle)}px,
          ${radius * Math.sin(angle)}px
        )`,
      };
    },
    getCardNum(num) {
      let JOK = num;
      if (num == 11) {
        JOK = "J";
      }
      if (num == 12) {
        JOK = "Q";
      }
      if (num == 13) {
        JOK = "K";
      }
      if (num == 14) {
        JOK = "A";
      }
      return JOK;
    },
    getCardStyle(index) {
      return {
        transform: `rotate(${index * 10}deg)`,
        zIndex: index,
      };
    },
    // 发送玩家动作
    playCard(card) {
      this.socket.emit("player-action", {
        type: "play-card",
        cardId: card.id,
      });
    },
    start() {
      // 接收服务端响应
      // this.gameStarted=true
      this.socket.emit("start");
      this.result=''
      this.showCard=false
    },
    beforeDestroy() {
      // 组件销毁时断开连接
      if (this.socket) {
        this.socket.disconnect();
      }
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      clearTimeout(this.reconnectTimer);
    },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->

<style scoped>
.poker-room {
  position: relative;
  height: 100vh;
  background: #2c5f2d;
}

.table-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.player-area {
  /* position: absolute; */
  transition: transform 0.5s ease;
  min-width: 200px;
  text-align: center;
  display: flex;
  margin-bottom: 60px;
}

.player-info {
  color: white;
  margin-bottom: 20px;
}
.chips {
  font-size: 18px;
}

.cards {
  display: flex;
  justify-content: center;
  gap: 10px;
}

/* .card {
  width: 100px;
  height: 140px;
  border-radius: 8px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.5s;
  cursor: pointer;
} */

.card.revealed {
  transform: rotateY(180deg);
}

.back {
  background: white;
  transform: rotateY(0deg);
}
.deck2 {
  width: auto;
  height: 50px;
  background: #95a5a6;
  border-radius: 8px;
  margin: 0 auto;
  color: #ee850e;
  font-size: 26px;
}
.deck {
  width: 100px;
  height: 50px;
  background: #95a5a6;
  border-radius: 8px;
  margin: 0 auto;
  color: #23c2f3;
  font-size: 26px;
}
.result{
  white-space: pre;
  position: absolute;
  top: 20px;
  right: 10px;
  color: #e7b307;
  font-size: 24px;
  font-weight: 400;
}
</style>

<style >
.cards {
  display: flex;
  gap: 10px;
  margin: 10px 0;
}
.card {
  width: 80px;
  height: 120px;
  background: white;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: black;
  font-size: 10px;
}
.hidden {
  background: #3498db;
  color: white;
}
.controls {
  margin-top: 20px;
}
button {
  padding: 10px;
  margin: 5px;
  cursor: pointer;
}
.chip-count {
  font-size: 20px;
}

.poker-card {
  width: 80px;
  height: 120px;
  position: relative;
  perspective: 1000px;
  cursor: pointer;
  margin: 15px;
  transition: transform 0.3s;
}

/* 悬停放大效果 */
.poker-card:hover {
  transform: scale(1.05);
}

/* 正反面通用样式 */
.card-face {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  backface-visibility: hidden;
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: #fff;
}

/* 卡片正面 */
.card-front {
  transform-style: preserve-3d;
  font-size: 8px;
}

/* 卡片背面（默认翻转状态） */
.card-back {
  transform: rotateY(180deg);
  background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
}

/* 翻转动画 */
.poker-card.flipped .card-front {
  transform: rotateY(-180deg);
}

.poker-card.flipped .card-back {
  transform: rotateY(0deg);
}

/* 扑克牌数字/字母样式 */
.card-corner {
  position: absolute;
  font-size: 1.9em;
  font-weight: 700;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
}

.top-left {
  top: 12px;
  left: 12px;
  text-align: left;
}

.bottom-right {
  bottom: 12px;
  right: 12px;
  transform: rotate(180deg);
}

/* 花色颜色 */
.red {
  color: #e74c3c;
}
.black {
  color: #2c3e50;
}

/* 中心花色图案 */
.center-suit {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 50px;
  opacity: 0.9;
}

/* 卡片背面图案 */
.card-back::before {
  content: "";
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  bottom: 20px;
  background: repeating-linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.1),
    rgba(255, 255, 255, 0.1) 10px,
    rgba(0, 0, 0, 0.05) 10px,
    rgba(0, 0, 0, 0.05) 20px
  );
  border-radius: 8px;
  border: 3px solid rgba(255, 255, 255, 0.2);
}

/* 特殊卡片样式（例如鬼牌） */
.joker-card .center-suit {
  font-size: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.joker-card .center-suit::after {
  content: "JOKER";
  font-size: 24px;
  margin-top: 10px;
  letter-spacing: 2px;
}

h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}

/* 按钮容器 */
.action-buttons {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 15px;
  z-index: 100;
}

/* 通用按钮样式 */
.game-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 下注按钮 */
.bet-btn {
  background: linear-gradient(145deg, #27ae60, #2ecc71);
  color: white;
}

.bet-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 8px rgba(46, 204, 113, 0.3);
}

/* 弃牌按钮 */
.fold-btn {
  background: linear-gradient(145deg, #c0392b, #e74c3c);
  color: white;
}

.fold-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 8px rgba(231, 76, 60, 0.3);
}

/* 飞按钮 */
.fly-btn {
  background: linear-gradient(145deg, black, #2c5f2d);
  color: white;
}

.fly-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 8px rgba(84, 90, 86, 0.3);
}

/* 踹按钮 */
.confirm-btn {
  background: linear-gradient(145deg, rgb(167, 7, 241), #1c06e2);
  color: white;
}

.confirm-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 8px rgba(198, 76, 235, 0.3);
}

.handle-btn {
  background: linear-gradient(145deg, rgb(226, 241, 10), #e7b307);
  color: white;
}

.handle-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 8px rgba(248, 193, 73, 0.3);
}

/* 禁用状态 */
.game-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  filter: grayscale(0.5);
}

/* 筹码输入框 */
.bet-input {
  padding: 8px 12px;
  border: 2px solid #2ecc71;
  border-radius: 6px;
  font-size: 16px;
  width: 120px;
  background: rgba(0, 0, 0, 0.3);
  color: white;
  margin-left: 10px;
}

.bet-input:focus {
  outline: none;
  border-color: #27ae60;
  box-shadow: 0 0 8px rgba(46, 204, 113, 0.5);
}

/* 添加按钮入场动画 */
.bet-input-wrapper {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>