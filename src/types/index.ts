export type PlayerColor =
  | 'red' | 'blue' | 'green' | 'yellow'
  | 'purple' | 'orange' | 'cyan' | 'pink';

export const PLAYER_COLORS: PlayerColor[] = [
  'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'
];

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  isBot: boolean;
  isReady: boolean;
  resources: {
    red: number;
    blue: number;
    green: number;
  };
  connected: boolean;
}

export type SpecialEventType =
  | '地下赌局'
  | '地产泡沫破裂'
  | '战时通货膨胀'
  | '雾境风暴封锁'
  | null;

export interface GameState {
  roomId: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  maxPlayers: number;
  currentTurnIndex: number;
  roundCount: number;

  secretValues?: {
    red: number;
    blue: number;
    green: number;
  };

  turnDeadline: number | null;
  extendedTime: boolean;

  activeEvent: SpecialEventType;
  eventCountdown: number;
  eventData?: any;

  nodes: Record<string, NodeState>;
  logs: LogEntry[];
  winnerId?: string | null;
}

export interface NodeState {
  id: string;
  name: string;
  ownerId: string | null;
  basePrice: number;
  currentPrice: number;
  captureCount: number;
  captureHistory: PlayerColor[];
  isLocked: boolean;
  isStormLocked: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  playerId: string;
  type: 'capture' | 'supply' | 'event' | 'system' | 'spy';
  hiddenCosts?: { red: number; blue: number; green: number };
  spiedBy?: string[];
}
