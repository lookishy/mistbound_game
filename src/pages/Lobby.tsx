import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export const Lobby: React.FC = () => {
  const { user, login } = useAuth();
  const [roomIdInput, setRoomIdInput] = useState('');
  const [showRules, setShowRules] = useState(false);
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-5xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-blue-500 to-green-500">
          雾境占拓
        </h1>
        <p className="text-slate-400 mb-8 max-w-md text-center">
          仅限 @tsunjin.edu.my 师生账号登录。在这场智慧与谋略的较量中，通过不完全信息博弈和隐藏晶石价值推理，连通大本营与敌军之腹。
        </p>
        <button
          onClick={login}
          className="px-8 py-4 bg-slate-800 hover:bg-slate-700 rounded-lg shadow-lg font-bold text-xl transition-all border border-slate-700 hover:border-slate-500"
        >
          使用循人中学 Google 账号登录
        </button>
      </div>
    );
  }

  const createRoom = async () => {
    try {
      const roomRef = await addDoc(collection(db, 'rooms'), {
        hostId: user.uid,
        status: 'waiting',
        maxPlayers: 8,
        createdAt: serverTimestamp(),
        players: [{
          id: user.uid,
          name: user.displayName || '玩家',
          color: 'red',
          isBot: false,
          isReady: true,
          resources: { red: 0, blue: 0, green: 0 },
          connected: true
        }]
      });
      navigate(`/room/${roomRef.id}`);
    } catch (error) {
      console.error("Error creating room: ", error);
      alert('创建房间失败，请重试。');
    }
  };

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomIdInput.trim()) return;

    try {
      const roomRef = doc(db, 'rooms', roomIdInput.trim());
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        alert('房间不存在！');
        return;
      }

      const roomData = roomSnap.data();
      if (roomData.status !== 'waiting') {
        alert('该房间已经在游戏中！');
        return;
      }

      if (roomData.players.length >= roomData.maxPlayers) {
        alert('房间已满！');
        return;
      }

      const isAlreadyIn = roomData.players.some((p: any) => p.id === user.uid);
      if (!isAlreadyIn) {
        const usedColors = roomData.players.map((p: any) => p.color);
        const availableColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'].filter(c => !usedColors.includes(c));

        await updateDoc(roomRef, {
          players: [...roomData.players, {
            id: user.uid,
            name: user.displayName || '玩家',
            color: availableColors[0] || 'red',
            isBot: false,
            isReady: false,
            resources: { red: 0, blue: 0, green: 0 },
            connected: true
          }]
        });
      }

      navigate(`/room/${roomIdInput.trim()}`);
    } catch (error) {
      console.error("Error joining room: ", error);
      alert('加入房间失败，请重试。');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="absolute top-4 right-4 flex items-center gap-4">
        <span className="text-slate-400">已登录: {user.displayName}</span>
        <button onClick={() => setShowRules(true)} className="px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700">
          ❓ 规则说明
        </button>
      </div>

      <h1 className="text-6xl font-bold mb-12 text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-blue-500 to-green-500 shadow-sm">
        雾境占拓
      </h1>

      <div className="flex flex-col gap-8 w-full max-w-md">
        <button
          onClick={createRoom}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg font-bold text-2xl transition-all"
        >
          创建房间
        </button>

        <div className="relative flex items-center py-5">
          <div className="flex-grow border-t border-slate-700"></div>
          <span className="flex-shrink-0 mx-4 text-slate-500">或者</span>
          <div className="flex-grow border-t border-slate-700"></div>
        </div>

        <form onSubmit={joinRoom} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="输入房间号"
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value)}
            className="w-full px-4 py-4 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 text-xl text-center"
          />
          <button
            type="submit"
            className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-lg shadow-lg font-bold text-xl transition-all"
          >
            加入房间
          </button>
        </form>
      </div>

      {showRules && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 p-8 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-3xl font-bold mb-6 text-center">游戏规则说明</h2>
            <div className="space-y-4 text-slate-300">
              <p><strong>核心目标：</strong> 占领地图上的领地，将【大本营】与【敌军之腹】连通，成为最终赢家！</p>

              <h3 className="text-xl text-white font-bold mt-6">代币与竞价</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>游戏内有红、蓝、绿三种晶石代币。</li>
                <li>开局系统会为红蓝绿各随机分配一个隐藏面值（1~5）。</li>
                <li>出价占领领地时，投入的代币必须包含<strong>至少 1红 1蓝 1绿</strong>。</li>
                <li>如果总隐藏面值 $\ge$ 领地标价，占领成功。否则全额退款。</li>
                <li>占领领地后，该领地标价翻倍。</li>
              </ul>

              <h3 className="text-xl text-white font-bold mt-6">回合行动（二选一）</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>攻占领地：</strong> 出价购买任意一个领地（无需相邻）。</li>
                <li><strong>呼叫后勤补给：</strong> 无法占领时，抽取资源卡。两张卡资源总数相等，但配比不同。</li>
                <li>每回合思考时间 120 秒，超时可续 30 秒，再超时自动踢出或由智能机器托管。</li>
              </ul>

              <h3 className="text-xl text-white font-bold mt-6">地图动态</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>1-4人局领地最多易主3次，5-8人局最多易主6次。达上限后永久锁定。</li>
                <li>每 4 轮必定触发特殊事件：地下赌局、地产泡沫破裂、战时通货膨胀 或 雾境风暴封锁。</li>
              </ul>

              <h3 className="text-xl text-white font-bold mt-6">间谍系统</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>消费隐藏面值 $\ge 5$ 的代币组合，可以随时查阅其他玩家的隐藏战报或钱包资产。</li>
              </ul>
            </div>
            <button
              onClick={() => setShowRules(false)}
              className="mt-8 w-full py-3 bg-red-600 hover:bg-red-500 rounded-lg font-bold"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
