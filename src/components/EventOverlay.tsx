import React, { useState, useEffect } from 'react';
import { type GameState, type NodeState } from '../types';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { SoundManager } from '../lib/SoundManager';

interface EventOverlayProps {
  gameState: GameState;
}

export const EventOverlay: React.FC<EventOverlayProps> = ({ gameState }) => {
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(gameState.eventCountdown);
  const [showEventUI, setShowEventUI] = useState(false);

  const [betPlaced, setBetPlaced] = useState(false);
  const [betRed, setBetRed] = useState(0);
  const [betBlue, setBetBlue] = useState(0);
  const [betGreen, setBetGreen] = useState(0);
  const [wheelSpinning, setWheelSpinning] = useState(false);

  const me = gameState.players.find(p => p.id === user?.uid);
  const isHost = gameState.hostId === user?.uid;

  useEffect(() => {
    if (gameState.eventCountdown > 0) {
      setCountdown(gameState.eventCountdown);
    }
  }, [gameState.eventCountdown]);

  useEffect(() => {
    if (gameState.activeEvent && countdown > 0) {
      const t = setTimeout(() => {
        setCountdown(c => c - 1);
        if (countdown - 1 === 0) {
          SoundManager.play('eventAlert');
          setShowEventUI(true);

          if (isHost) {
            handleEventLogicTrigger();
          }
        }
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [gameState.activeEvent, countdown, isHost]);


  const handleEventLogicTrigger = async () => {
    const roomRef = doc(db, 'rooms', gameState.roomId);

    if (gameState.activeEvent === '地产泡沫破裂') {
      const updatedNodes: Record<string, NodeState> = {};
      Object.values(gameState.nodes).forEach(n => {
        updatedNodes[n.id] = {
          ...n,
          currentPrice: n.basePrice
        };
      });
      await updateDoc(roomRef, {
        activeEvent: null,
        turnDeadline: Date.now() + 120000,
        nodes: updatedNodes,
        logs: arrayUnion({
          id: Date.now().toString(),
          timestamp: Date.now(),
          message: '[全球事件] 地产泡沫破裂！所有领地标价已恢复为初始底价。',
          playerId: 'system',
          type: 'event'
        })
      });
    }
    else if (gameState.activeEvent === '战时通货膨胀') {
      const updatedNodes: Record<string, NodeState> = {};
      Object.values(gameState.nodes).forEach(n => {
        updatedNodes[n.id] = {
          ...n,
          currentPrice: n.currentPrice + 4
        };
      });
      await updateDoc(roomRef, {
        activeEvent: null,
        turnDeadline: Date.now() + 120000,
        nodes: updatedNodes,
        logs: arrayUnion({
          id: Date.now().toString(),
          timestamp: Date.now(),
          message: '[全球事件] 战时通货膨胀！所有领地当前标价暴涨 $4。',
          playerId: 'system',
          type: 'event'
        })
      });
    }
    else if (gameState.activeEvent === '雾境风暴封锁') {
      const middleNodes = Object.values(gameState.nodes).filter(n => n.id !== 'START' && n.id !== 'END');
      const shuffled = middleNodes.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 3);

      const updatedNodes: Record<string, NodeState> = { ...gameState.nodes };
      Object.values(updatedNodes).forEach(n => { n.isStormLocked = false; });

      selected.forEach(n => {
        updatedNodes[n.id].isStormLocked = true;
      });

      await updateDoc(roomRef, {
        activeEvent: null,
        turnDeadline: Date.now() + 120000,
        nodes: updatedNodes,
        logs: arrayUnion({
          id: Date.now().toString(),
          timestamp: Date.now(),
          message: `[全球事件] 雾境风暴肆虐！【${selected.map(n=>n.name).join('】、【')}】被风暴封锁，持续4轮无法攻占！`,
          playerId: 'system',
          type: 'event'
        })
      });
    }
    else if (gameState.activeEvent === '地下赌局') {
      await updateDoc(roomRef, {
        eventData: { bets: [], resolved: false }
      });
    }
  };

  const submitBet = async () => {
    if (!me || !gameState.eventData) return;
    const totalSelected = betRed + betBlue + betGreen;

    const totalOwned = me.resources.red + me.resources.blue + me.resources.green;

    if (totalOwned >= 2 && totalSelected !== 2) {
      alert("必须上缴正好 2 个代币！");
      return;
    }
    if (totalOwned < 2 && totalSelected !== totalOwned) {
      alert("您的代币不足2个，必须全部上缴！");
      return;
    }
    if (betRed > me.resources.red || betBlue > me.resources.blue || betGreen > me.resources.green) {
      alert("余额不足！");
      return;
    }

    setBetPlaced(true);

    const roomRef = doc(db, 'rooms', gameState.roomId);

    const updatedPlayers = gameState.players.map(p => {
      if (p.id === me.id) {
        return {
          ...p,
          resources: {
            red: p.resources.red - betRed,
            blue: p.resources.blue - betBlue,
            green: p.resources.green - betGreen,
          }
        };
      }
      return p;
    });

    const currentBets = gameState.eventData.bets || [];

    await updateDoc(roomRef, {
      players: updatedPlayers,
      'eventData.bets': [...currentBets, { playerId: me.id }]
    });
  };

  useEffect(() => {
    if (isHost && gameState.activeEvent === '地下赌局' && gameState.eventData?.bets) {
      if (gameState.eventData.bets.length === gameState.players.length && !gameState.eventData.resolved) {
        resolveRoulette();
      }
    }
  }, [gameState.eventData?.bets, isHost]);

  const resolveRoulette = async () => {
    const roomRef = doc(db, 'rooms', gameState.roomId);
    await updateDoc(roomRef, { 'eventData.resolved': true });

    setWheelSpinning(true);

    setTimeout(async () => {
      const winnerIndex = Math.floor(Math.random() * gameState.players.length);
      const winner = gameState.players[winnerIndex];

      const updatedPlayers = gameState.players.map(p => {
        if (p.id === winner.id) {
          return {
            ...p,
            resources: {
              red: p.resources.red + 2,
              blue: p.resources.blue + 2,
              green: p.resources.green + 2,
            }
          };
        }
        return p;
      });

      await updateDoc(roomRef, {
        activeEvent: null,
        turnDeadline: Date.now() + 120000,
        eventData: null,
        players: updatedPlayers,
        logs: arrayUnion({
          id: Date.now().toString(),
          timestamp: Date.now(),
          message: `[全球事件] 地下赌局结束！幸运儿 ${winner.name} 赢得了 2红 2蓝 2绿 丰厚奖金！`,
          playerId: 'system',
          type: 'event'
        })
      });
      setWheelSpinning(false);
    }, 3000);
  };

  if (!gameState.activeEvent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {countdown > 0 && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center pointer-events-none">
          <h1 className="text-8xl font-black text-red-600 animate-pulse drop-shadow-[0_0_50px_rgba(220,38,38,1)]">
            {gameState.activeEvent}
          </h1>
        </div>
      )}

      {showEventUI && gameState.activeEvent === '地下赌局' && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-8">
          <h2 className="text-5xl font-bold text-yellow-500 mb-8 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]">地下赌局</h2>

          {!wheelSpinning ? (
            <div className="bg-slate-800 p-8 rounded-xl max-w-md w-full border border-yellow-600">
              <p className="text-slate-300 text-center mb-6">
                所有玩家必须上缴 2 个任意代币（若不足则全缴）。<br/>
                最终将随机抽取 1 名赢家，获得 2红 2蓝 2绿！
              </p>

              {betPlaced ? (
                <div className="text-center text-xl text-green-400 font-bold py-8">
                  已下注，等待其他玩家... ({gameState.eventData?.bets?.length || 0} / {gameState.players.length})
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-900 p-4 rounded">
                    <span className="text-red-500 font-bold">红 ({me?.resources.red})</span>
                    <input type="number" min="0" max={me?.resources.red} value={betRed} onChange={e=>setBetRed(Number(e.target.value))} className="w-20 bg-slate-700 px-2 py-1 rounded text-white text-center"/>
                  </div>
                  <div className="flex justify-between items-center bg-slate-900 p-4 rounded">
                    <span className="text-blue-500 font-bold">蓝 ({me?.resources.blue})</span>
                    <input type="number" min="0" max={me?.resources.blue} value={betBlue} onChange={e=>setBetBlue(Number(e.target.value))} className="w-20 bg-slate-700 px-2 py-1 rounded text-white text-center"/>
                  </div>
                  <div className="flex justify-between items-center bg-slate-900 p-4 rounded">
                    <span className="text-green-500 font-bold">绿 ({me?.resources.green})</span>
                    <input type="number" min="0" max={me?.resources.green} value={betGreen} onChange={e=>setBetGreen(Number(e.target.value))} className="w-20 bg-slate-700 px-2 py-1 rounded text-white text-center"/>
                  </div>
                  <button
                    onClick={submitBet}
                    className="w-full mt-6 py-4 bg-yellow-600 hover:bg-yellow-500 text-black font-black text-xl rounded-lg"
                  >
                    确认下注
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-64 h-64 rounded-full border-8 border-yellow-500 animate-[spin_0.2s_linear_infinite] border-t-red-500 border-b-blue-500 border-l-green-500 shadow-[0_0_50px_rgba(234,179,8,1)]"></div>
              <p className="mt-8 text-3xl font-bold text-white animate-bounce">转盘抽奖中...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
