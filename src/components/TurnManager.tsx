import React, { useState, useEffect } from 'react';
import { type GameState } from '../types';
import { useAuth } from './AuthProvider';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SoundManager } from '../lib/SoundManager';

interface TurnManagerProps {
  gameState: GameState;
}

export const TurnManager: React.FC<TurnManagerProps> = ({ gameState }) => {
  const { user } = useAuth();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [showExtensionPrompt, setShowExtensionPrompt] = useState(false);
  const [supplyOptions, setSupplyOptions] = useState<{A: any, B: any} | null>(null);

  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  const isMyTurn = currentPlayer.id === user?.uid;

  useEffect(() => {
    if (!gameState.turnDeadline || gameState.activeEvent !== null) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remain = Math.max(0, Math.floor((gameState.turnDeadline! - now) / 1000));
      setTimeLeft(remain);

      if (isMyTurn && remain === 0) {
        if (!gameState.extendedTime && !showExtensionPrompt) {
          setShowExtensionPrompt(true);
        } else if (gameState.extendedTime || showExtensionPrompt) {
          handleTimeout();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.turnDeadline, gameState.extendedTime, isMyTurn, showExtensionPrompt, gameState.activeEvent]);

  useEffect(() => {
    if (showExtensionPrompt) {
      const timeout = setTimeout(() => {
        handleTimeout();
      }, 15000);
      return () => clearTimeout(timeout);
    }
  }, [showExtensionPrompt]);

  const handleTimeout = async () => {
    if (!isMyTurn) return;
    const roomRef = doc(db, 'rooms', gameState.roomId);

    const updatedPlayers = gameState.players.map(p => {
      if (p.id === user?.uid) {
        return { ...p, isBot: true, name: `${p.name} (接管)` };
      }
      return p;
    });

    await updateDoc(roomRef, {
      players: updatedPlayers,
      logs: arrayUnion({
        id: Date.now().toString(),
        timestamp: Date.now(),
        message: `[系统] ${currentPlayer.name} 长时间未响应，已由智能机器接管。`,
        playerId: 'system',
        type: 'system'
      })
    });

    endTurn();
  };

  const acceptExtension = async () => {
    setShowExtensionPrompt(false);
    const roomRef = doc(db, 'rooms', gameState.roomId);
    await updateDoc(roomRef, {
      extendedTime: true,
      turnDeadline: Date.now() + 30000
    });
  };

  const endTurn = async () => {
    const nextIndex = (gameState.currentTurnIndex + 1) % gameState.players.length;
    const isNewRound = nextIndex === 0;
    const newRoundCount = isNewRound ? gameState.roundCount + 1 : gameState.roundCount;

    const updates: Partial<GameState> = {
      currentTurnIndex: nextIndex,
      turnDeadline: Date.now() + 120000,
      extendedTime: false,
    };

    if (isNewRound) {
      updates.roundCount = newRoundCount;
      if (newRoundCount % 4 === 1 && newRoundCount > 1) {
         triggerRandomEvent(updates);
      }
    }

    const roomRef = doc(db, 'rooms', gameState.roomId);
    await updateDoc(roomRef, updates);
  };

  const triggerRandomEvent = (updates: Partial<GameState>) => {
    const events = ['地下赌局', '地产泡沫破裂', '战时通货膨胀', '雾境风暴封锁'];
    const chosen = events[Math.floor(Math.random() * events.length)];
    updates.activeEvent = chosen as any;
    updates.eventCountdown = 3;
    updates.turnDeadline = null;
  };

  const generateSupply = () => {
    SoundManager.play('supply');
    const N = Math.floor(Math.random() * 3) + 3;

    const genCard = () => {
      let r = 0, b = 0, g = 0;
      for (let i=0; i<N; i++) {
        const rand = Math.random();
        if (rand < 0.33) r++;
        else if (rand < 0.66) b++;
        else g++;
      }
      return { red: r, blue: b, green: g };
    };

    let cardA = genCard();
    let cardB = genCard();

    while (cardA.red === cardB.red && cardA.blue === cardB.blue && cardA.green === cardB.green) {
      cardB = genCard();
    }

    setSupplyOptions({ A: cardA, B: cardB });
  };

  const selectSupply = async (choice: 'A' | 'B') => {
    // 阻止重复点击
    if (!supplyOptions) return;

    SoundManager.play('supply');
    const card = supplyOptions[choice];
    // 先清空本地选项，防止多次点击
    setSupplyOptions(null);

    const updatedPlayers = gameState.players.map(p => {
      if (p.id === currentPlayer.id) {
        return {
          ...p,
          resources: {
            red: p.resources.red + card.red,
            blue: p.resources.blue + card.blue,
            green: p.resources.green + card.green,
          }
        };
      }
      return p;
    });

    const roomRef = doc(db, 'rooms', gameState.roomId);

    // 我们必须手动调用 endTurn 的逻辑，并在一次 updateDoc 中合并所有的改变
    // 防止出现并发写入导致的一致性问题

    const nextIndex = (gameState.currentTurnIndex + 1) % gameState.players.length;
    const isNewRound = nextIndex === 0;
    const newRoundCount = isNewRound ? gameState.roundCount + 1 : gameState.roundCount;

    const updates: any = {
      players: updatedPlayers,
      currentTurnIndex: nextIndex,
      turnDeadline: Date.now() + 120000,
      extendedTime: false,
    };

    if (isNewRound) {
      updates.roundCount = newRoundCount;
      if (newRoundCount % 4 === 1 && newRoundCount > 1) {
         triggerRandomEvent(updates);
      }
    }

    await updateDoc(roomRef, {
      ...updates,
      logs: arrayUnion({
        id: Date.now().toString(),
        timestamp: Date.now(),
        message: `[前线战报] ${currentPlayer.name} 呼叫了后勤补给，获得了神秘物资。`,
        playerId: currentPlayer.id,
        type: 'supply'
      })
    });
  };

  return (
    <>
      <div className="bg-slate-800 p-4 flex justify-between items-center border-t border-slate-700">
        <div className="flex gap-4">
          {gameState.players.map((p, idx) => (
            <div
              key={p.id}
              className={`p-2 rounded flex items-center gap-2 ${idx === gameState.currentTurnIndex ? 'ring-2 ring-white bg-slate-700' : 'opacity-50'}`}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
              <span className="text-sm font-bold truncate max-w-[80px]">{p.name}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xl font-mono bg-black/50 px-4 py-2 rounded text-red-400">
            剩余 {timeLeft} 秒
          </div>
          {isMyTurn && !supplyOptions && (
            <button
              onClick={generateSupply}
              className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded font-bold transition-colors"
            >
              呼叫后勤补给
            </button>
          )}
        </div>
      </div>

      {showExtensionPrompt && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-8 rounded-xl max-w-md text-center border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]">
            <h2 className="text-2xl font-bold mb-4 text-white">需要更多思考时间吗？</h2>
            <p className="text-slate-400 mb-8">倒计时结束将自动由智能机器接管。</p>
            <button
              onClick={acceptExtension}
              className="px-8 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-bold text-xl w-full"
            >
              确认 (额外 30 秒)
            </button>
          </div>
        </div>
      )}

      {supplyOptions && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-8 rounded-xl max-w-2xl w-full border border-slate-600">
            <h2 className="text-3xl font-bold mb-8 text-center text-white">二选一：后勤补给</h2>
            <div className="grid grid-cols-2 gap-8 mb-8">
              <button
                onClick={() => selectSupply('A')}
                className="p-6 bg-slate-700 hover:bg-slate-600 rounded-xl flex flex-col items-center gap-4 transition-transform hover:scale-105 border border-transparent hover:border-slate-400"
              >
                <h3 className="text-xl font-bold">选择甲</h3>
                <div className="flex gap-2 text-2xl font-bold">
                  <span className="text-red-500">{supplyOptions.A.red} 红</span>
                  <span className="text-blue-500">{supplyOptions.A.blue} 蓝</span>
                  <span className="text-green-500">{supplyOptions.A.green} 绿</span>
                </div>
              </button>

              <button
                onClick={() => selectSupply('B')}
                className="p-6 bg-slate-700 hover:bg-slate-600 rounded-xl flex flex-col items-center gap-4 transition-transform hover:scale-105 border border-transparent hover:border-slate-400"
              >
                <h3 className="text-xl font-bold">选择乙</h3>
                <div className="flex gap-2 text-2xl font-bold">
                  <span className="text-red-500">{supplyOptions.B.red} 红</span>
                  <span className="text-blue-500">{supplyOptions.B.blue} 蓝</span>
                  <span className="text-green-500">{supplyOptions.B.green} 绿</span>
                </div>
              </button>
            </div>

            <button
              onClick={() => setSupplyOptions(null)}
              className="w-full py-3 bg-slate-600 hover:bg-slate-500 rounded-lg font-bold text-lg"
            >
              取消 / 返回地图
            </button>
          </div>
        </div>
      )}
    </>
  );
};
