import React, { useEffect, useState } from 'react';
import { type GameState } from '../types';
import { MAP_EDGES } from '../lib/mapData';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { SoundManager } from '../lib/SoundManager';

interface WinDetectorProps {
  gameState: GameState;
}

export const WinDetector: React.FC<WinDetectorProps> = ({ gameState }) => {
  const navigate = useNavigate();
  const [showWinModal, setShowWinModal] = useState(false);
  const [winnerName, setWinnerName] = useState('');
  const [isDraw, setIsDraw] = useState(false);

  useEffect(() => {
    if (gameState.status === 'finished') {
      if (gameState.winnerId === 'DRAW') {
        setIsDraw(true);
      } else {
        const winner = gameState.players.find(p => p.id === gameState.winnerId);
        if (winner) setWinnerName(winner.name);
      }

      if (!showWinModal) {
         SoundManager.play('victory');
      }
      setShowWinModal(true);
      return;
    }

    if (gameState.status !== 'playing') return;

    const adj: Record<string, string[]> = {};
    Object.keys(gameState.nodes).forEach(n => adj[n] = []);

    MAP_EDGES.forEach(([u, v]) => {
      adj[u].push(v);
      adj[v].push(u);
    });

    let detectedWinner: string | null = null;

    for (const player of gameState.players) {
      const ownedIds = new Set(
        Object.values(gameState.nodes)
          .filter(n => n.ownerId === player.id)
          .map(n => n.id)
      );

      const startNeighbors = adj['START'].filter(nId => ownedIds.has(nId));

      const visited = new Set<string>();
      const queue: string[] = [...startNeighbors];

      let reachedEnd = false;

      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (visited.has(curr)) continue;
        visited.add(curr);

        if (adj[curr].includes('END')) {
          reachedEnd = true;
          break;
        }

        for (const neighbor of adj[curr]) {
          if (ownedIds.has(neighbor) && !visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }

      if (reachedEnd) {
        detectedWinner = player.id;
        break;
      }
    }

    if (detectedWinner) {
      if (gameState.hostId === gameState.players.find(p => p.id === gameState.hostId)?.id) {
         updateDoc(doc(db, 'rooms', gameState.roomId), {
           status: 'finished',
           winnerId: detectedWinner
         });
      }
    } else {
      const totalCaptureableNodes = Object.values(gameState.nodes).filter(n => n.id !== 'START' && n.id !== 'END');
      const allLocked = totalCaptureableNodes.every(n => n.isLocked);

      if (allLocked) {
        if (gameState.hostId === gameState.players.find(p => p.id === gameState.hostId)?.id) {
          updateDoc(doc(db, 'rooms', gameState.roomId), {
            status: 'finished',
            winnerId: 'DRAW'
          });
        }
      }
    }
  }, [gameState.nodes, gameState.status, gameState.hostId, gameState.roomId, gameState.players]);

  if (!showWinModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
      <div className="bg-gradient-to-br from-yellow-900 to-slate-900 p-1 rounded-2xl max-w-2xl w-full shadow-[0_0_100px_rgba(234,179,8,0.5)]">
        <div className="bg-slate-900 p-12 rounded-xl border border-yellow-700/50 flex flex-col items-center text-center">

          {isDraw ? (
            <h1 className="text-6xl font-black text-slate-300 mb-6 drop-shadow-lg">
              战线死锁，和平收场
            </h1>
          ) : (
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-700 mb-6 drop-shadow-lg animate-pulse">
              恭喜 {winnerName} 成功贯通战线，主宰雾境！
            </h1>
          )}

          <div className="w-full h-px bg-gradient-to-r from-transparent via-yellow-600 to-transparent my-8"></div>

          <h3 className="text-2xl text-white font-bold mb-8">本局终极谜底揭晓</h3>

          <div className="flex gap-8 mb-12">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] flex items-center justify-center text-3xl font-black text-white">
                {gameState.secretValues?.red}
              </div>
              <span className="text-red-400 font-bold">红晶真实价值</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] flex items-center justify-center text-3xl font-black text-white">
                {gameState.secretValues?.blue}
              </div>
              <span className="text-blue-400 font-bold">蓝晶真实价值</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)] flex items-center justify-center text-3xl font-black text-white">
                {gameState.secretValues?.green}
              </div>
              <span className="text-green-400 font-bold">绿晶真实价值</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="px-12 py-4 bg-yellow-600 hover:bg-yellow-500 text-black font-black text-2xl rounded-xl transition-transform hover:scale-105 shadow-[0_0_20px_rgba(234,179,8,0.4)]"
          >
            返回大厅
          </button>
        </div>
      </div>
    </div>
  );
};
