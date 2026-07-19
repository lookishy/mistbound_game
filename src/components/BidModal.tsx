import React, { useState } from 'react';
import { type GameState, type NodeState } from '../types';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SoundManager } from '../lib/SoundManager';

interface BidModalProps {
  gameState: GameState;
  node: NodeState;
  onClose: () => void;
  onEndTurn: () => void;
  currentPlayerId: string;
}

export const BidModal: React.FC<BidModalProps> = ({ gameState, node, onClose, onEndTurn, currentPlayerId }) => {
  const [red, setRed] = useState(0);
  const [blue, setBlue] = useState(0);
  const [green, setGreen] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const me = gameState.players.find(p => p.id === currentPlayerId)!;

  const submitBid = async () => {
    if (red < 1 || blue < 1 || green < 1) {
      setErrorMsg("战术受限！攻占每个领地必须至少投入 1红、1蓝、1绿晶！");
      return;
    }

    if (red > me.resources.red || blue > me.resources.blue || green > me.resources.green) {
      setErrorMsg("资金不足，攻势被击退！（您的钱包中没有那么多晶石）");
      return;
    }

    const { secretValues } = gameState;
    if (!secretValues) return;

    const totalHiddenValue =
      (red * secretValues.red) +
      (blue * secretValues.blue) +
      (green * secretValues.green);

    const roomRef = doc(db, 'rooms', gameState.roomId);

    let updatedPlayers = gameState.players.map(p => {
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

    if (totalHiddenValue >= node.currentPrice) {
      const actualPlayerCount = gameState.players.length;
      const maxCaptures = actualPlayerCount <= 4 ? 3 : 6;
      const newCaptureCount = node.captureCount + 1;
      const isLocked = newCaptureCount >= maxCaptures;

      const updatedNode = {
        ...node,
        ownerId: me.id,
        currentPrice: node.currentPrice * 2,
        captureCount: newCaptureCount,
        captureHistory: [...node.captureHistory, me.color],
        isLocked: isLocked
      };

      await updateDoc(roomRef, {
        players: updatedPlayers,
        [`nodes.${node.id}`]: updatedNode,
        logs: arrayUnion({
          id: Date.now().toString(),
          timestamp: Date.now(),
          message: `[前线战报] ${me.name} 成功夺取了【${node.name}】！花费了 *红、*蓝、*绿晶。`,
          playerId: me.id,
          type: 'capture',
          hiddenCosts: { red, blue, green },
          spiedBy: []
        })
      });

      SoundManager.play('conquestSuccess');
      alert('占领成功！');
    } else {
      updatedPlayers = gameState.players.map(p => {
        if (p.id === me.id) {
          return {
            ...p,
            resources: {
              red: p.resources.red,
              blue: p.resources.blue,
              green: p.resources.green,
            }
          };
        }
        return p;
      });

      await updateDoc(roomRef, {
        players: updatedPlayers,
        logs: arrayUnion({
          id: Date.now().toString(),
          timestamp: Date.now(),
          message: `[前线战报] ${me.name} 对【${node.name}】发起了进攻，但资金不足，攻势被击退！`,
          playerId: me.id,
          type: 'capture'
        })
      });

      SoundManager.play('conquestFail');
      alert('资金不足，攻势被击退！您的晶石已全额退回。');
    }

    onEndTurn();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 p-8 rounded-xl max-w-md w-full border border-slate-600">
        <h2 className="text-3xl font-bold mb-2 text-center text-white">攻占领地：{node.name}</h2>
        <p className="text-slate-400 text-center mb-6">当前底价：${node.currentPrice}</p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="mb-6 bg-slate-900 p-4 rounded-lg">
          <p className="text-sm text-slate-400 mb-2">你的钱包余额：</p>
          <div className="flex gap-4 font-bold">
            <span className="text-red-500">{me.resources.red} 红</span>
            <span className="text-blue-500">{me.resources.blue} 蓝</span>
            <span className="text-green-500">{me.resources.green} 绿</span>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between">
            <label className="text-red-500 font-bold w-20">投入红晶</label>
            <input
              type="number" min="1" max={me.resources.red}
              value={red} onChange={e => setRed(Number(e.target.value))}
              className="w-full ml-4 bg-slate-700 px-3 py-2 rounded border border-slate-600 text-white"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-blue-500 font-bold w-20">投入蓝晶</label>
            <input
              type="number" min="1" max={me.resources.blue}
              value={blue} onChange={e => setBlue(Number(e.target.value))}
              className="w-full ml-4 bg-slate-700 px-3 py-2 rounded border border-slate-600 text-white"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-green-500 font-bold w-20">投入绿晶</label>
            <input
              type="number" min="1" max={me.resources.green}
              value={green} onChange={e => setGreen(Number(e.target.value))}
              className="w-full ml-4 bg-slate-700 px-3 py-2 rounded border border-slate-600 text-white"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="w-1/2 py-3 bg-slate-600 hover:bg-slate-500 rounded-lg font-bold"
          >
            取消
          </button>
          <button
            onClick={submitBid}
            className="w-1/2 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-bold"
          >
            确认出价
          </button>
        </div>
      </div>
    </div>
  );
};
