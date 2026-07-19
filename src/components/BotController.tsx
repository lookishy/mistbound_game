import React, { useEffect } from 'react';
import { type GameState } from '../types';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';

interface BotControllerProps {
  gameState: GameState;
}

export const BotController: React.FC<BotControllerProps> = ({ gameState }) => {
  const { user } = useAuth();

  const isHost = gameState.hostId === user?.uid;

  useEffect(() => {
    if (!isHost) return;

    const currentPlayer = gameState.players[gameState.currentTurnIndex];

    if (currentPlayer.isBot && gameState.status === 'playing' && !gameState.activeEvent) {
      const timer = setTimeout(() => {
        executeBotTurn(currentPlayer.id);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [gameState.currentTurnIndex, gameState.activeEvent, isHost]);

  useEffect(() => {
    if (!isHost) return;

    if (gameState.activeEvent === '地下赌局' && gameState.eventData?.bets) {
      const bots = gameState.players.filter(p => p.isBot);

      let newBets = [...gameState.eventData.bets];
      let hasUpdates = false;

      let updatedPlayers = [...gameState.players];

      bots.forEach(bot => {
        const alreadyBet = newBets.some((b: any) => b.playerId === bot.id);
        if (!alreadyBet) {
          hasUpdates = true;
          let needed = 2;
          let payRed = 0, payBlue = 0, payGreen = 0;

          let botObj = updatedPlayers.find(p => p.id === bot.id)!;

          while (needed > 0 && (botObj.resources.red > 0 || botObj.resources.blue > 0 || botObj.resources.green > 0)) {
            if (botObj.resources.red > 0) { payRed++; botObj.resources.red--; needed--; continue; }
            if (botObj.resources.blue > 0) { payBlue++; botObj.resources.blue--; needed--; continue; }
            if (botObj.resources.green > 0) { payGreen++; botObj.resources.green--; needed--; continue; }
          }

          newBets.push({ playerId: bot.id });
        }
      });

      if (hasUpdates) {
        updateDoc(doc(db, 'rooms', gameState.roomId), {
          players: updatedPlayers,
          'eventData.bets': newBets
        });
      }
    }
  }, [gameState.activeEvent, gameState.eventData, isHost]);

  const executeBotTurn = async (botId: string) => {
    const bot = gameState.players.find(p => p.id === botId);
    if (!bot || !gameState.secretValues) return;

    const totalHiddenValue =
      (bot.resources.red * gameState.secretValues.red) +
      (bot.resources.blue * gameState.secretValues.blue) +
      (bot.resources.green * gameState.secretValues.green);

    const availableNodes = Object.values(gameState.nodes).filter(
      n => !n.isLocked && !n.isStormLocked && n.id !== 'START' && n.id !== 'END' && n.ownerId !== bot.id
    );

    const affordableNodes = availableNodes.filter(n => totalHiddenValue >= n.currentPrice);

    const roomRef = doc(db, 'rooms', gameState.roomId);
    let updatedPlayers = [...gameState.players];
    let updates: any = {};

    if (affordableNodes.length > 0 && bot.resources.red >= 1 && bot.resources.blue >= 1 && bot.resources.green >= 1) {
      const targetNode = affordableNodes[Math.floor(Math.random() * affordableNodes.length)];

      let payR = 1, payB = 1, payG = 1;
      let botR = bot.resources.red - 1;
      let botB = bot.resources.blue - 1;
      let botG = bot.resources.green - 1;

      const price = targetNode.currentPrice;
      const calcValue = (r: number, b: number, g: number) => r*gameState.secretValues!.red + b*gameState.secretValues!.blue + g*gameState.secretValues!.green;

      const tokens = [
        { c: 'red', v: gameState.secretValues.red },
        { c: 'blue', v: gameState.secretValues.blue },
        { c: 'green', v: gameState.secretValues.green }
      ].sort((a,b) => a.v - b.v);

      while (calcValue(payR, payB, payG) < price) {
        if (tokens[0].c === 'red' && botR > 0) { payR++; botR--; }
        else if (tokens[0].c === 'blue' && botB > 0) { payB++; botB--; }
        else if (tokens[0].c === 'green' && botG > 0) { payG++; botG--; }
        else if (tokens[1].c === 'red' && botR > 0) { payR++; botR--; }
        else if (tokens[1].c === 'blue' && botB > 0) { payB++; botB--; }
        else if (tokens[1].c === 'green' && botG > 0) { payG++; botG--; }
        else if (tokens[2].c === 'red' && botR > 0) { payR++; botR--; }
        else if (tokens[2].c === 'blue' && botB > 0) { payB++; botB--; }
        else if (tokens[2].c === 'green' && botG > 0) { payG++; botG--; }
      }

      updatedPlayers = updatedPlayers.map(p => {
        if (p.id === bot.id) {
          return {
            ...p,
            resources: { red: botR, blue: botB, green: botG }
          };
        }
        return p;
      });

      const actualPlayerCount = gameState.players.length;
      const maxCaptures = actualPlayerCount <= 4 ? 3 : 6;
      const newCaptureCount = targetNode.captureCount + 1;
      const isLocked = newCaptureCount >= maxCaptures;

      updates[`nodes.${targetNode.id}`] = {
        ...targetNode,
        ownerId: bot.id,
        currentPrice: targetNode.currentPrice * 2,
        captureCount: newCaptureCount,
        captureHistory: [...targetNode.captureHistory, bot.color],
        isLocked: isLocked
      };

      updates.logs = arrayUnion({
        id: Date.now().toString(),
        timestamp: Date.now(),
        message: `[前线战报] ${bot.name} 成功夺取了【${targetNode.name}】！花费了 *红、*蓝、*绿晶。`,
        playerId: bot.id,
        type: 'capture',
        hiddenCosts: { red: payR, blue: payB, green: payG },
        spiedBy: []
      });

    } else {
      const N = Math.floor(Math.random() * 3) + 3;
      let r = 0, b = 0, g = 0;
      for (let i=0; i<N; i++) {
        const rand = Math.random();
        if (rand < 0.33) r++;
        else if (rand < 0.66) b++;
        else g++;
      }

      updatedPlayers = updatedPlayers.map(p => {
        if (p.id === bot.id) {
          return {
            ...p,
            resources: {
              red: p.resources.red + r,
              blue: p.resources.blue + b,
              green: p.resources.green + g,
            }
          };
        }
        return p;
      });

      updates.logs = arrayUnion({
        id: Date.now().toString(),
        timestamp: Date.now(),
        message: `[前线战报] ${bot.name} 呼叫了后勤补给，获得了神秘物资。`,
        playerId: bot.id,
        type: 'supply'
      });
    }

    const nextIndex = (gameState.currentTurnIndex + 1) % gameState.players.length;
    const isNewRound = nextIndex === 0;
    const newRoundCount = isNewRound ? gameState.roundCount + 1 : gameState.roundCount;

    updates.currentTurnIndex = nextIndex;
    updates.turnDeadline = Date.now() + 120000;
    updates.extendedTime = false;
    updates.players = updatedPlayers;

    if (isNewRound) {
      updates.roundCount = newRoundCount;
      if (gameState.roundCount % 4 === 0) {
        const events = ['地下赌局', '地产泡沫破裂', '战时通货膨胀', '雾境风暴封锁'];
        updates.activeEvent = events[Math.floor(Math.random() * events.length)];
        updates.eventCountdown = 3;
        updates.turnDeadline = null;
      }
    }

    await updateDoc(roomRef, updates);
  };

  return null;
};
