import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';
import { type GameState, PLAYER_COLORS, type Player, type NodeState } from '../types';
import { INITIAL_NODES } from '../lib/mapData';
import { GameMap } from '../components/GameMap';
import { TurnManager } from '../components/TurnManager';
import { BidModal } from '../components/BidModal';
import { Sidebar } from '../components/Sidebar';
import { EventOverlay } from '../components/EventOverlay';
import { BotController } from '../components/BotController';
import { WinDetector } from '../components/WinDetector';

export const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<GameState | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeState | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, 'rooms', roomId), (docSnap) => {
      if (docSnap.exists()) {
        setRoom(docSnap.data() as GameState);
      } else {
        alert('房间已关闭或不存在');
        navigate('/');
      }
    });
    return () => unsub();
  }, [roomId, navigate]);

  if (!room || !user) return <div className="text-center mt-20 text-xl">加载中...</div>;

  const isHost = room.hostId === user.uid;
  const me = room.players.find(p => p.id === user.uid);

  if (!me) {
    return <div className="text-center mt-20 text-xl">你不在该房间中。</div>;
  }

  const toggleReady = async () => {
    const updatedPlayers = room.players.map(p =>
      p.id === user.uid ? { ...p, isReady: !p.isReady } : p
    );
    await updateDoc(doc(db, 'rooms', roomId!), { players: updatedPlayers });
  };

  const addBot = async () => {
    if (room.players.length >= room.maxPlayers) return;
    const usedColors = room.players.map(p => p.color);
    const availableColors = PLAYER_COLORS.filter(c => !usedColors.includes(c));
    const botId = `bot_${Date.now()}`;

    const newBot: Player = {
      id: botId,
      name: `机器僚机 ${room.players.filter(p => p.isBot).length + 1}`,
      color: availableColors[0] || 'red',
      isBot: true,
      isReady: true,
      resources: { red: 0, blue: 0, green: 0 },
      connected: true
    };

    await updateDoc(doc(db, 'rooms', roomId!), {
      players: [...room.players, newBot]
    });
  };

  const removePlayer = async (playerId: string) => {
    const updatedPlayers = room.players.filter(p => p.id !== playerId);
    await updateDoc(doc(db, 'rooms', roomId!), { players: updatedPlayers });
  };

  const startGame = async () => {
    const allReady = room.players.every(p => p.isReady);
    if (!allReady) {
      alert('还有玩家未准备！');
      return;
    }

    const secrets = {
      red: Math.floor(Math.random() * 5) + 1,
      blue: Math.floor(Math.random() * 5) + 1,
      green: Math.floor(Math.random() * 5) + 1,
    };

    const nodesRecord: Record<string, NodeState> = {};
    INITIAL_NODES.forEach(n => nodesRecord[n.id] = { ...n });

    await updateDoc(doc(db, 'rooms', roomId!), {
      status: 'playing',
      secretValues: secrets,
      currentTurnIndex: 0,
      roundCount: 1,
      turnDeadline: Date.now() + 120000,
      extendedTime: false,
      activeEvent: null,
      nodes: nodesRecord,
      logs: [{
        id: Date.now().toString(),
        timestamp: Date.now(),
        message: '游戏开始！情报显示，各色晶石隐藏价值已确认。',
        playerId: 'system',
        type: 'system'
      }]
    });
  };

  if (room.status === 'playing') {
    return (
      <div className="min-h-screen flex">
        <div className="flex-1 flex flex-col p-4 overflow-hidden relative">
          <header className="mb-4 flex justify-between items-center text-white">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-blue-500 to-green-500">
              雾境占拓
            </h1>
            <div className="flex gap-4 items-center">
               <span className="bg-slate-800 px-3 py-1 rounded">第 {room.roundCount} 轮</span>
               <button
                 onClick={() => {
                   const rules = `
游戏规则说明：

核心目标： 占领地图上的领地，将【大本营】与【敌军之腹】连通，成为最终赢家！

代币与竞价：
- 游戏内有红、蓝、绿三种晶石代币。
- 开局系统会为红蓝绿各随机分配一个隐藏面值（1~5）。
- 出价占领领地时，投入的代币必须包含至少 1红 1蓝 1绿。
- 如果总隐藏面值 ≥ 领地标价，占领成功。否则全额退款。
- 占领领地后，该领地标价翻倍。

回合行动（二选一）：
- 攻占领地：出价购买任意一个领地（无需相邻）。
- 呼叫后勤补给：无法占领时，抽取资源卡。两张卡资源总数相等，但配比不同。
- 每回合思考时间 120 秒，超时可续 30 秒，再超时自动踢出或由智能机器托管。

地图动态：
- 1-4人局领地最多易主3次，5-8人局最多易主6次。达上限后永久锁定。
- 每 4 轮必定触发特殊事件：地下赌局、地产泡沫破裂、战时通货膨胀 或 雾境风暴封锁。

间谍系统：
- 消费隐藏面值 ≥ 5 的代币组合，可以随时查阅其他玩家的隐藏战报或钱包资产。`;
                   alert(rules);
                 }}
                 className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
               >
                 ❓ 规则
               </button>
            </div>
          </header>

          <div className="flex-1 overflow-hidden flex flex-col items-center mt-4">
            <GameMap
              gameState={room}
              onNodeClick={(node) => {
                if (room.players[room.currentTurnIndex].id === user?.uid) {
                  setSelectedNode(node);
                } else {
                  alert('还没轮到你的回合！');
                }
              }}
            />
          </div>

          <TurnManager gameState={room} />
        </div>

        <Sidebar gameState={room} />

        <EventOverlay gameState={room} />
        <BotController gameState={room} />
        <WinDetector gameState={room} />

        {selectedNode && (
          <BidModal
            gameState={room}
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            currentPlayerId={user!.uid}
            onEndTurn={() => {
              const nextIndex = (room.currentTurnIndex + 1) % room.players.length;
              const isNewRound = nextIndex === 0;
              const newRoundCount = isNewRound ? room.roundCount + 1 : room.roundCount;

              const updates: any = {
                currentTurnIndex: nextIndex,
                turnDeadline: Date.now() + 120000,
                extendedTime: false,
              };

              if (isNewRound) {
                updates.roundCount = newRoundCount;
                if (room.roundCount % 4 === 0) {
                  const events = ['地下赌局', '地产泡沫破裂', '战时通货膨胀', '雾境风暴封锁'];
                  updates.activeEvent = events[Math.floor(Math.random() * events.length)];
                  updates.eventCountdown = 3;
                  updates.turnDeadline = null;
                }
              }

              updateDoc(doc(db, 'rooms', room.roomId), updates);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-slate-800 rounded-xl shadow-2xl">
      <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <h2 className="text-3xl font-bold">房间准备大厅</h2>
        <div className="text-slate-400">
          房间号: <span className="font-mono text-white bg-slate-700 px-2 py-1 rounded">{roomId}</span>
        </div>
      </div>

      <div className="mb-6 flex justify-between items-center">
        <h3 className="text-xl">玩家列表 ({room.players.length}/{room.maxPlayers})</h3>
        {isHost && (
          <button
            onClick={addBot}
            disabled={room.players.length >= room.maxPlayers}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded"
          >
            + 添加智能机器
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {room.players.map(p => (
          <div key={p.id} className="flex items-center justify-between bg-slate-700 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full`}
                style={{ backgroundColor: p.color }}
              ></div>
              <span className="font-bold text-lg">{p.name} {p.isBot ? '(机器)' : ''}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${p.isReady ? 'bg-green-600' : 'bg-slate-600'}`}>
                {p.isReady ? '已准备' : '未准备'}
              </span>
              {isHost && p.id !== user.uid && (
                <button onClick={() => removePlayer(p.id)} className="text-red-400 hover:text-red-300">
                  踢出
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-4">
        {!isHost || !me.isReady ? (
           <button
             onClick={toggleReady}
             className={`px-8 py-3 rounded-lg font-bold text-xl ${me.isReady ? 'bg-orange-600 hover:bg-orange-500' : 'bg-green-600 hover:bg-green-500'}`}
           >
             {me.isReady ? '取消准备' : '准备就绪'}
           </button>
        ) : null}

        {isHost && (
          <button
            onClick={startGame}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-xl disabled:opacity-50"
            disabled={!room.players.every(p => p.isReady)}
          >
            开始游戏
          </button>
        )}
      </div>
    </div>
  );
};
