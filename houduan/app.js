const { log } = require('console');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
// const mongoose = require('mongoose');

//优化花色判断
//登录系统
//房间设定
//准备判定
//计时器自动操作
//样式设计
//拖段断线重连机制
//战绩回顾
//外挂系统

// 初始化服务器
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 25000,  // 25秒心跳间隔
  pingTimeout: 10000,     // 10秒无响应视为断开
  cors: {
    origin: "http://192.168.1.9:8088", // 你的前端地址
    // origin: "http://192.168.1.9:8088", // 你的前端地址
    methods: ["GET", "POST"],           // 允许的 HTTP 方法
    allowedHeaders: ["my-custom-header"], // 自定义请求头（如有）
    credentials: true                   // 允许跨域携带凭证
  }
});

// 游戏房间存储
const rooms = new Map(); 
// 服务端使用 Map 或对象临时存储
let playerArr = new Array();
class Player {
  constructor(socketId, name = 'Guest') {
    this.id = socketId;
    this.name = name;
    this.connectedAt = Date.now();
    this.lastActive = Date.now();
    this.num=0;
    this.position = { x: 0, y: 0 }; // 示例游戏位置
    this.cards=[]
    this.stats = {
      score: 0,
      health: 100
    };
  }

  updatePosition(x, y) {
    this.position = { x, y };
    this.lastActive = Date.now();
  }
}

class PlayerManager {
  constructor() {
    this.players = new Map(); // 使用 Map 存储玩家
    this.foldPlayers = new Map();
    // this.initAutoCleanup();
  }
  deleteFoldPlayers(){
    this.foldPlayers.forEach((value, key) => {
        this.players.set(key, value);
      });
      this.foldPlayers=new Map()
  }
  setFoldPlayers(player){
    this.players.forEach((value, key) => {
      if (key==player) {
        this.players.delete(key);
      }
    });
  }
  setCards(card){
    this.players.cards.push(card)
  }

  // 玩家连接时调用
  addPlayer(socketId, playerName) {
    const player = new Player(socketId, playerName);
    this.players.set(socketId, player);
    console.log(`[玩家加入] ID: ${socketId} 名称: ${playerName}`);
    return player;
  }

  // 玩家断开时调用
  removePlayer(socketId) {
    if (this.players.has(socketId)) {
      const player = this.players.get(socketId);
      console.log(`[玩家离开] ID: ${socketId} 名称: ${player.name}`);
      this.players.delete(socketId);
      return true;
    }
    return false;
  }

  // 获取所有在线玩家
  getOnlinePlayers() {
    return Array.from(this.players.values());
  }

  // 自动清理不活跃玩家（每5分钟）
  initAutoCleanup() {
    setInterval(() => {
      const now = Date.now();
      this.players.forEach((player, id) => {
        if (now - player.lastActive > 300000) { // 5分钟不活跃
          this.players.delete(id);
          console.log(`[自动清理] 移除不活跃玩家: ${player.name}`);
        }
      });
    }, 300000);
  }
  setScore(socketId,score){
    this.num=score
    this.players.get(socketId).stats.score-=score;
  }
  getNum(){
    return this.num
  }
  setPotScore(socketId,pot){
    this.players.get(socketId).stats.score+=pot
  }
  replay(index){
    let entriesArray = Array.from(this.players.entries());
    let item=entriesArray.splice(index,1)[0]
    entriesArray.unshift(item)
    this.players = new Map(entriesArray);
  }
  // 通过ID获取玩家
  getPlayer(socketId) {
    return this.players.get(socketId);
  }
}
class ShowHandGame {
  constructor() {
    this.deck = [];
    this.player = { chips: 0, cards: [] };
    this.dealer = { chips: 0, cards: [] };
    this.currentBet = 0;
    this.gamePhase = "betting"; // betting, dealing, showdown
  }
  getDeck(){
    return this.deck
  }

  // 生成牌堆
  generateDeck(length) {
    let n=8
    if (length) {
    
    if (Math.abs(length)<3) {
      n=9
    }
     if (2<length&&length<5) {
      n=8
    }
     if (4<length&&length<7) {
      n=7
    }
    }
    const ranks=Array.from({ length: Math.abs(14 - n) + 1 }, (_, i) => 
       n + i
    );
    
    const suits = ["♠", "♥", "♦", "♣"];
    this.deck = [];
    for (let suit of suits) {
      for (let rank of ranks) {
        this.deck.push({ suit, rank });
      }
    }
  }

  // 洗牌
  shuffleDeck() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  // 发牌
  dealCard(target) {
    const card = this.deck.pop();
    target.cards.push(card);
  }
  deleteCard(target) {
    target.cards=[];
  }
  // 游戏流程控制
  proceedGame(player,players) {
    if (player.cards.length < 5) {
      this.dealCard(player);
      return false
    }
    // 简化的自动庄家逻辑
    if (player.cards.length === 5) {
      let [a,b]=this.compareHands(players);
      return [a,b]
    }
  }

  // 牌型评估（同之前实现）
  sortSpecialArray(arr) {
    // 统计每个数字的出现频率
    const freqMap = arr.reduce((map, num) => {
      map[num] = (map[num] || 0) + 1;
      return map;
    }, {});
  
    // 获取最高重复次数
    const maxFreq = Math.max(...Object.values(freqMap));
  
    // 分离高频项与单次项
    const highFreqItems = [];
    const singleItems = [];
  
    // 按数值降序处理原始数组（确保后续排序稳定性）
    const sortedUnique = [...new Set(arr)].sort((a, b) => b - a);
  
    // 先收集高频项（按数值降序排列）
    sortedUnique.forEach(num => {
      if (freqMap[num] === maxFreq) {
        highFreqItems.push(...Array(freqMap[num]).fill(num));
      }
    });
  
    // 再收集单次项（已按降序排列）
    sortedUnique.forEach(num => {
      if (freqMap[num] === 1) {
        singleItems.push(num);
      }
    });
  
    return [...highFreqItems, ...singleItems];
  }
  
  evaluateHand(cards) {
    const arr = cards.map((c) => c.rank).sort((a, b) => a - b);
    //处理排序
    let ranks = this.sortSpecialArray(arr)
    ranks=[ranks[0],ranks[1],ranks[2],ranks[3],ranks[4]]
    const suits = cards.map((c) => c.suit);

    // 辅助函数：统计点数出现次数
    const countRanks = () => {
      let count = {};
      ranks.forEach((r) => (count[r] = (count[r] || 0) + 1));
      return Object.values(count).sort((a, b) => b - a);
    };

    // 判断是否顺子
    const isStraight = () => {
      // 处理A-2-3-4-5的特殊情况
      if (ranks.join(",") === "2,3,4,5,14") return true;
      for (let i = 0; i < 4; i++) {
        if (ranks[i] - ranks[i + 1] !== 1) return false;
      }
      return true;
    };

    // 判断是否同花
    const isFlush = () => new Set(suits).size === 1;

    const counts = countRanks();
    const straight = isStraight();
    const flush = isFlush();

    // 牌型判断
    if (flush && straight) {
      return { type: 9, name: "同花顺", ranks }; // 同花顺
    } else if (counts[0] === 4) {
      return { type: 8, name: "四条", ranks }; // 四条
    } else if (counts[0] === 3 && counts[1] === 2) {
      return { type: 7, name: "葫芦", ranks }; // 葫芦
    } else if (flush) {
      return { type: 6, name: "同花", ranks }; // 同花
    } else if (straight) {
      return { type: 5, name: "顺子", ranks }; // 顺子
    } else if (counts[0] === 3) {
      return { type: 4, name: "三条", ranks }; // 三条
    } else if (counts[0] === 2 && counts[1] === 2) {
      return { type: 3, name: "两对", ranks }; // 两对
    } else if (counts[0] === 2) {
      return { type: 2, name: "一对", ranks }; // 一对
    } else {
      return { type: 1, name: "高牌", ranks }; // 高牌
    }
  }

  // ================== 比较胜负 ==================
  compareHands(players) {
    let index=0 ;
    let type=1
    let playerHand=[]
        // 牌型相同时比较具体点数
    const compareRanks = (a, b) => {
          // 处理A-2-3-4-5顺子的特殊情况
          if (a.ranks.join(",") === "2,3,4,5,14") a.ranks = [5, 4, 3, 2, 1];
          if (b.ranks.join(",") === "2,3,4,5,14") b.ranks = [5, 4, 3, 2, 1];
          
          for (let i = 0;  i<a.ranks.length; i++) {
            if (a.ranks[i] > b.ranks[i]) return true;
            if (a.ranks[i] < b.ranks[i]) return false;
          }
          // a.ranks
          //待优化花色
          return true;
   };
    for(let i=0;i<players.length;i++){
         playerHand.push (this.evaluateHand(players[i].cards));
    }

    for (let i = 0; i < playerHand.length; i++) {
      if(playerHand[i].type>type){
        type=playerHand[i].type
        index=i
        
      }else if (playerHand[i].type==type) {
        if(compareRanks(playerHand[i], playerHand[index])){
           index=i
        }
      }
      
    }
    return [players[index],playerHand[index]]

  }
}

class GameState {
  constructor() {
    this.currentRound = 5; // 当前轮次
    this.pot = 0; // 总底池
    this.currentBet = 0; // 当前轮次最高下注额
    this.index = 0; // 
    this.lastRaisePlayer = null; // 最后加注玩家
    this.actionQueue = []; // 行动队列
    this.actionIndex = 0; // 当前行动指针
    this.cishu=0;
    this.flyCishu=0;
    this.result='';
    this.showCard=false;
  }
  getShowCard(){
    return this.showCard
  }
  setShowCard(bool){
    this.showCard=bool
  }
  getResult(){
    return this.result
  }
  setResult(a,b){
    this.result=a+b
  }
  setFlyCishu(bool){
    bool?this.flyCishu=0:this.flyCishu+=1
  }
  setCishu(bool){
    bool?this.cishu=0:this.cishu+=1
  }
  getFlyCishu(){
    return this.flyCishu
  }
  getCishu(){
    return this.cishu
  }
  startCurrentRound(num){
    //开始1 跟注2 踹3 飞4
    this.currentRound=num||this.currentRound
    return this.currentRound
  }
  setIndex(){
    this.index=0
  }
  getIndex(){
    return this.index
  }
  countIndex(){
    this.index-=1
    return this.index
  }
  addIndex(){
    this.index+=1
    
    return this.index
  }
  setCurrentRound(round){
     this.currentRound=round+1
     return this.currentRound
  }
  rePot(){
    this.pot=0
  }
  getPot(){
    return this.pot
 }
  setPot(pot){
     this.pot+=pot
     return this.pot
  }
  overGame(){
    this.currentRound = 0;
    this.pot = 0;
    this.currentBet = 0; // 当前轮次最高下注额
    this.lastRaisePlayer = null; 
    this.actionQueue = []; // 行动队列
    this.actionIndex = 0; // 当前行动指针
  }
}

// 创建玩家管理器实例
const playerManager = new PlayerManager();
const showHandGame = new ShowHandGame();
const gameState = new GameState();

//调试
// const compareRanks = (a, b) => {
//   // 处理A-2-3-4-5顺子的特殊情况
//   if (a.ranks.join(",") === "2,3,4,5,14") a.ranks = [1, 2, 3, 4, 5];
//   if (b.ranks.join(",") === "2,3,4,5,14") b.ranks = [1, 2, 3, 4, 5];
  
//   for (let i = a.ranks.length - 1; i >= 0; i--) {
//     if (a.ranks[i] > b.ranks[i]) return true;
//     if (a.ranks[i] < b.ranks[i]) return false;
//   }
//   console.log(a,b);
  
//   // a.ranks
//   //待优化花色
//   return true;
// };
// let arr1=[ 
//   { suit: '♠', rank: 10 },
//   { suit: '♥', rank: 11 },
//   { suit: '♠', rank: 9 },
//   { suit: '♣', rank: 8 },
//   { suit: '♣', rank: 12 }]
//   let arr2=[ 
//     { suit: '♠', rank: 10 },
//     { suit: '♥', rank: 11 },
//     { suit: '♠', rank: 9 },
//     { suit: '♣', rank: 8 },
//     { suit: '♣', rank: 12 }]
//     let playerHand=[]
//   playerHand.push (showHandGame.evaluateHand(arr1));
//   playerHand.push (showHandGame.evaluateHand(arr2));

//  compareRanks(playerHand[0], playerHand[1])
  


io.on('connection', async (socket) => {
  const playerName = `Player_${Math.random().toString(36).substr(2, 5)}`;
  playerManager.addPlayer(socket.id, playerName);
  socket.emit('addPlayer',playerManager.getOnlinePlayers(),socket.id);

  socket.on('start', () => {
    showHandGame.generateDeck()
    showHandGame.shuffleDeck()
    playerManager.deleteFoldPlayers()
    let playersArr=playerManager.getOnlinePlayers()

    for (let index = 0; index < playersArr.length; index++) {
      showHandGame.deleteCard(playersArr[index])
      showHandGame.dealCard(playersArr[index])
      showHandGame.dealCard(playersArr[index])
      showHandGame.dealCard(playersArr[index])
      playerManager.setScore(playersArr[index].id,1)
    }
    gameState.rePot()
    gameState.setPot(playersArr.length)
    gameState.setIndex()
    gameState.setCishu(true)
    gameState.setFlyCishu(true)
    gameState.setShowCard(false)
    gameState.setResult('','')

    socket.emit('game-start', playerManager.getOnlinePlayers(),gameState.startCurrentRound(1),gameState.getIndex(),gameState.getPot());
  });

   //弃牌
   socket.on('handle-fold', (gamePlayer) => {
    playerManager.setFoldPlayers(gamePlayer)
   });

  //下注
  socket.on('handle-num', (num,gamePlayer,controlIndex) => {
          
      playerManager.setScore(gamePlayer,num)
      if (gameState.getIndex()<playerManager.getOnlinePlayers().length-1) {
        socket.emit('handle-num-back', playerManager.getOnlinePlayers(),controlIndex?gameState.getIndex():gameState.addIndex(),gameState.setPot(num),gameState.startCurrentRound(2));
      }else{
        socket.emit('handle-num-back', playerManager.getOnlinePlayers(),controlIndex?gameState.countIndex():gameState.getIndex(),gameState.setPot(num),gameState.startCurrentRound(2));
      }

  });
  
  //跟注
  socket.on('handle-go', (gamePlayer,num,bool,controlIndex) => {
    playerManager.setScore(gamePlayer,num)
    let playersArr=playerManager.getOnlinePlayers()

      if (bool) {
        if (gameState.getCishu()==0&&playerManager.getOnlinePlayers()[0].cards.length==3) {
           socket.emit('handle-go-back', playerManager.getOnlinePlayers(),controlIndex?gameState.countIndex():gameState.getIndex(),gameState.setPot(num),gameState.startCurrentRound(3));
          
        }else if(gameState.getCishu()<3&&playerManager.getOnlinePlayers()[0].cards.length==4){
           socket.emit('handle-go-back', playerManager.getOnlinePlayers(),controlIndex?gameState.countIndex():gameState.getIndex(),gameState.setPot(num),gameState.startCurrentRound(3));
        }else if (playerManager.getOnlinePlayers()[0].cards.length==5&&gameState.getFlyCishu()==0) {
          socket.emit('handle-go-back', playerManager.getOnlinePlayers(),controlIndex?gameState.countIndex():gameState.getIndex(),gameState.setPot(num),gameState.startCurrentRound(3));
        }else{
          if (gameState.getFlyCishu()>0) {

            gameState.setPot(num)
            gameState.setIndex()
            //开牌
            let [a,b]=showHandGame.compareHands(playersArr)
            //底池结算
            playerManager.setPotScore(a.id,gameState.getPot())
            gameState.rePot()
            gameState.setShowCard(true)
            gameState.setResult(a.name+'玩家胜 牌型为:',b.name)
            socket.emit('result', playerManager.getOnlinePlayers(),gameState.getResult(),gameState.getPot(),gameState.startCurrentRound(5),gameState.getShowCard());
            //清零


          }else{
            //发牌
            for (let index = 0; index < playersArr.length; index++) {
              showHandGame.dealCard(playersArr[index])
            }
            gameState.setIndex()
            socket.emit('handle-go-back', playerManager.getOnlinePlayers(),gameState.getIndex(),gameState.setPot(num),gameState.startCurrentRound(1));
          }
           
        }
      }else{
        socket.emit('handle-go-back', playerManager.getOnlinePlayers(),controlIndex?gameState.getIndex():gameState.addIndex(),gameState.setPot(num),gameState.startCurrentRound(2));
      }
  });
   //踹
   socket.on('handle-bet', (gamePlayer,num,index,controlIndex) => {
      let playersArr=playerManager.getOnlinePlayers()
      gameState.setCishu()
      if (num==0) {
        if (index<2) {
          gameState.setIndex()
          if (playerManager.getOnlinePlayers()[0].cards.length==5) {
            socket.emit('handle-bet-back', playerManager.getOnlinePlayers(),gameState.getIndex(),gameState.setPot(num),gameState.startCurrentRound(4));
          }else{
             //发牌
            for (let index = 0; index < playersArr.length; index++) {
              showHandGame.dealCard(playersArr[index])
            }
            socket.emit('handle-bet-back', playerManager.getOnlinePlayers(),gameState.getIndex(),gameState.setPot(num),gameState.startCurrentRound(1));
          }
       
        }else{
          controlIndex?gameState.countIndex():null
          socket.emit('handle-bet-back', playerManager.getOnlinePlayers(),gameState.countIndex(),gameState.setPot(num),gameState.startCurrentRound(3));
        }
      }else{

        playerManager.setScore(gamePlayer,num)
        //处理顺序 
        playerManager.replay(index)
        gameState.setIndex()
        socket.emit('handle-bet-back', playerManager.getOnlinePlayers(),gameState.addIndex(),gameState.setPot(num),gameState.startCurrentRound(2));
      }
  });
   //飞
    socket.on('handle-fly', (gamePlayer,num,index,controlIndex) => {
      let playersArr=playerManager.getOnlinePlayers()

      playerManager.setScore(gamePlayer,num)

      if (num==0) {
        if (index<2) {


          gameState.setIndex()
          //开牌
          let [a,b]=showHandGame.compareHands(playersArr)
          //底池结算
          playerManager.setPotScore(a.id,gameState.getPot())
          gameState.rePot()
          gameState.setShowCard(true)
          gameState.setResult(a.name+'玩家胜 牌型为:',b.name)
          socket.emit('result', playerManager.getOnlinePlayers(),gameState.getResult(),gameState.getPot(),gameState.startCurrentRound(5),gameState.getShowCard());
          //清零
          


        }else{
          controlIndex?gameState.countIndex():null
          socket.emit('handle-bet-back', playerManager.getOnlinePlayers(),gameState.countIndex(),gameState.setPot(num),gameState.startCurrentRound(4));
        }
        
      }else{
        gameState.setFlyCishu(null)
        // playerManager.setScore(gamePlayer,num)
        //处理顺序 
        playerManager.replay(index)
        gameState.setIndex()
        socket.emit('handle-bet-back', playerManager.getOnlinePlayers(),gameState.addIndex(),gameState.setPot(num),gameState.startCurrentRound(2));
      }
      
    });

  socket.on('player-action', (gamePlayer) => {
    playerManager.getOnlinePlayers().forEach((value, key) => {
      
      if (value.id!=gamePlayer) {
        gameState.setIndex()
        //开牌
        //底池结算
        playerManager.setPotScore(value.id,gameState.getPot())
        gameState.rePot()
        gameState.setShowCard(true)
        gameState.setResult(value.name+'玩家开牌前胜','')
        socket.emit('result', playerManager.getOnlinePlayers(),gameState.getResult(),gameState.getPot(),gameState.startCurrentRound(5),gameState.getShowCard());
      }
    });
  
 
  });

// 心跳响应
socket.on('pong', () => {
  playerManager.getOnlinePlayers().get(socket.id).lastPong = Date.now();
});

// 强制同步请求处理
socket.on('force-sync', () => {
  socket.emit('full-sync', {
    players: Array.from(playerManager.getOnlinePlayers().values()),
    timestamp: Date.now(),
    index:gameState.getIndex(),
    pot:gameState.setPot(0),
    round:gameState.startCurrentRound(null),
    num:playerManager.getNum(),
    showCard:gameState.getShowCard(),
    result:gameState.getResult()
  });
});

  // 断线处理
  socket.on('disconnect', () => {
    playerManager.removePlayer(socket.id);
    // 通知其他玩家
    socket.broadcast.emit('disPlayer', playerManager.getOnlinePlayers());
  });

  //跟注
  socket.on('come',  (token) => {
      socket.emit('comeSuccess',token);
  });
  // 用户认证
  socket.on('authenticate', async (token) => {
    const user = await verifyUserToken(token); // JWT验证
    if (user) {
      socket.user = user;
      socket.emit('auth-success');
    }
  });

  // 创建房间
  socket.on('create-room', (config) => {
    const roomId = generateRoomId();
    rooms.set(roomId, {
      players: new Map([[socket.id, { cards: [], bet: 0 }]]),
      deck: [],
      pot: 0,
      state: 'waiting'
    });
    socket.join(roomId);
    socket.emit('room-created', roomId);
  });

  // 加入房间
  socket.on('join-room', (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.players.size < 6) {
      room.players.set(socket.id, { cards: [], bet: 0 });
      socket.join(roomId);
      io.to(roomId).emit('player-joined', socket.id);
    }
  });

  // 处理玩家动作
  socket.on('player-action111', (action) => {
    const room = getPlayerRoom(socket);
    switch(action.type) {
      case 'bet':
        handleBet(room, socket, action.amount);
        break;
      case 'fold':
        handleFold(room, socket);
        break;
      case 'all-in':
        handleAllIn(room, socket);
        break;
    }
  });

});
// 启动服务器
server.listen(3000, () => {
  console.log('Server running on port 3000');
});