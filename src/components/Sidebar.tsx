import React, { useState } from 'react';
import { type GameState, type Player, type LogEntry } from '../types';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';

interface SidebarProps {
  gameState: GameState;
}

export const Sidebar: React.FC<SidebarProps> = ({ gameState }) => {
  const { user } = useAuth();
  const [spyTarget, setSpyTarget] = useState<Player | LogEntry | null>(null);
  const [red, setRed] = useState(0);
  const [blue, setBlue] = useState(0);
  const [green, setGreen] = useState(0);
  const [spyError, setSpyError] = useState('');

  const me = gameState.players.find(p => p.id === user?.uid);

  const formatLogMessage = (log: LogEntry) => {
    if (!me) return log.message;

    if (log.hiddenCosts && log.type === 'capture') {
      const isMine = log.playerId === me.id;
      const isSpied = log.spiedBy?.includes(me.id);

      if (isMine || isSpied) {
        return log.message.replace('*红、*蓝、*绿', `${log.hiddenCosts.red}红、${log.hiddenCosts.blue}蓝、${log.hiddenCosts.green}绿`);
      }
    }
    return log.message;
  };

  const handleSpy = async () => {
    if (!me || !gameState.secretValues) return;

    const totalHiddenValue =
      (red * gameState.secretValues.red) +
      (blue * gameState.secretValues.blue) +
      (green * gameState.secretValues.green);

    if (totalHiddenValue < 5) {
      setSpyError("间谍经费不足！隐藏价值总和必须 ≥ 5。");
      return;
    }

    if (red > me.resources.red || blue > me.resources.blue || green > me.resources.green) {
      setSpyError("余额不足！");
      return;
    }

    const roomRef = doc(db, 'rooms', gameState.roomId);

    const updatedPlayers = gameState.players.map(p => {
      if (p.id === me.id) {
        return {
          ...p,
          resources: {
            red: p.resources.red - red,
            blue: p.resources.blue - blue,
            green: p.resources.green - green,
          }
        };
      }
      return p;
    });

    if ('message' in spyTarget!) {
      const log = spyTarget as LogEntry;
      const updatedLogs = gameState.logs.map(l => {
        if (l.id === log.id) {
          return { ...l, spiedBy: [...(l.spiedBy || []), me.id] };
        }
        return l;
      });

      await updateDoc(roomRef, {
        players: updatedPlayers,
        logs: updatedLogs
      });
      alert('情报获取成功！账本已解密。');
    } else {
      const targetPlayer = spyTarget as Player;
      const r = targetPlayer.resources.red;
      const b = targetPlayer.resources.blue;
      const g = targetPlayer.resources.green;

      await updateDoc(roomRef, {
        players: updatedPlayers,
        logs: arrayUnion({
          id: Date.now().toString(),
          timestamp: Date.now(),
          message: `[绝密情报] 间谍传回了 ${targetPlayer.name} 的钱包数据：${r}红、${b}蓝、${g}绿晶。`,
          playerId: me.id,
          type: 'spy'
        })
      });
      alert('情报获取成功！密报已发送至战报日志。');
    }

    setSpyTarget(null);
    setRed(0);
    setBlue(0);
    setGreen(0);
    setSpyError('');
  };

  return (
    <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col min-h-full">
      <div className="p-4 border-b border-slate-700">
        <h3 className="font-bold text-lg mb-4 text-white">阵营情报</h3>
        <div className="space-y-3">
          {gameState.players.map(p => (
            <div
              key={p.id}
              className="flex justify-between items-center bg-slate-700 p-2 rounded cursor-pointer hover:bg-slate-600"
              onClick={() => {
                if (p.id !== me?.id) setSpyTarget(p);
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
                <span className="text-sm font-bold truncate w-20">{p.name}</span>
              </div>
              {p.id === me?.id ? (
                <div className="text-xs font-bold bg-black/50 px-2 py-1 rounded">
                  <span className="text-red-500">{p.resources.red}</span>/
                  <span className="text-blue-500">{p.resources.blue}</span>/
                  <span className="text-green-500">{p.resources.green}</span>
                </div>
              ) : (
                <span className="text-xs text-slate-400 bg-black/50 px-2 py-1 rounded border border-slate-600 hover:text-white">
                  潜入查钱包
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        <h3 className="font-bold text-lg sticky top-0 bg-slate-800 pb-2 text-white">前线战报</h3>
        {gameState.logs
          .filter(log => log.type !== 'spy' || log.playerId === me?.id)
          .slice().reverse()
          .map(log => (
            <div
              key={log.id}
              className={`text-sm p-2 rounded ${log.type === 'system' ? 'bg-blue-900/30 text-blue-300' : log.type === 'spy' ? 'bg-purple-900/30 text-purple-300 border border-purple-800' : 'bg-slate-700/50 text-slate-300'}`}
            >
              <div className="text-xs text-slate-500 mb-1">
                {new Date(log.timestamp).toLocaleTimeString()}
              </div>
              <div>{formatLogMessage(log)}</div>
              {log.hiddenCosts && log.playerId !== me?.id && !log.spiedBy?.includes(me?.id!) && (
                <button
                  onClick={() => setSpyTarget(log)}
                  className="mt-2 text-xs text-yellow-500 hover:text-yellow-400 underline"
                >
                  派间谍查账
                </button>
              )}
            </div>
          ))}
      </div>

      {spyTarget && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 p-8 rounded-xl max-w-sm w-full border border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
            <h2 className="text-2xl font-bold mb-4 text-purple-400">
              间谍行动
            </h2>
            <p className="text-slate-300 mb-6 text-sm">
              目标：{'message' in spyTarget ? '查阅绝密账本' : `潜入 ${spyTarget.name} 的钱包`}<br/><br/>
              请支付间谍经费。隐藏价值总和必须 <strong className="text-white text-lg">≥ 5</strong>。
            </p>

            {spyError && <div className="text-red-400 text-sm mb-4">{spyError}</div>}

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between">
                <label className="text-red-500 font-bold">红晶</label>
                <input type="number" min="0" max={me?.resources.red} value={red} onChange={e => setRed(Number(e.target.value))} className="w-20 bg-slate-700 px-2 py-1 rounded text-white" />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-blue-500 font-bold">蓝晶</label>
                <input type="number" min="0" max={me?.resources.blue} value={blue} onChange={e => setBlue(Number(e.target.value))} className="w-20 bg-slate-700 px-2 py-1 rounded text-white" />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-green-500 font-bold">绿晶</label>
                <input type="number" min="0" max={me?.resources.green} value={green} onChange={e => setGreen(Number(e.target.value))} className="w-20 bg-slate-700 px-2 py-1 rounded text-white" />
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setSpyTarget(null)} className="w-1/2 py-2 bg-slate-600 hover:bg-slate-500 rounded font-bold">取消</button>
              <button onClick={handleSpy} className="w-1/2 py-2 bg-purple-600 hover:bg-purple-500 rounded font-bold text-white">执行任务</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
